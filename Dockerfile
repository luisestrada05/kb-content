# syntax=docker/dockerfile:1.7
#
# Data-only image for kb-content.
#
# Builder stage installs @kb/mcp-server from GitHub, then runs the ingest
# against the local rules/ tree. The final image is a busybox base
# containing only the resulting kb.db plus a tiny `cp` so the server's
# init-container pattern can publish it into a shared volume.
#
# Why busybox instead of FROM scratch:
#   The downstream docker-compose pattern uses an init-container that
#   runs `cp /kb.db /out/kb.db`. scratch has no shell and no cp; busybox
#   adds ~1.4MB and gives us a usable runtime.

FROM node:22-slim AS builder

WORKDIR /work

# Native build deps for better-sqlite3. Removed in the final stage.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

# Install deps. @kb/mcp-server is a git dep — `npm install` clones it,
# runs its `prepare` script (which compiles TS), and exposes kb-ingest
# on the PATH via npx.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Bring in the inputs only after deps are cached.
COPY plugin/ ./plugin/
COPY rules/ ./rules/
COPY vault/ ./vault/
COPY standards/ ./standards/
COPY lessons/ ./lessons/
COPY catalogo/ ./catalogo/
COPY precedentes/ ./precedentes/

# Init + ingest + embed in one go. If a YAML is malformed or any reference
# is unknown, ingest doesn't fail (kb-ingest is lenient about edge targets);
# the strict gate is the validate workflow in CI.
#
# `embed` vectorizes every rule (name + body) with a local model so the
# server's kb_find can match questions by meaning, not only by words. The
# .db is rebuilt from scratch on every build, so every rule — old and new —
# is embedded each time; nothing needs a separate backfill. The model
# (~130MB) is downloaded once into a BuildKit cache mount.
#
# Build time grows with the content: ~12ms per rule, ~150ms per 400-word
# document on 4 vCPU. With a few rules that's seconds. If the content grows
# to thousands of long documents and this step nears the workflow's timeout,
# reuse the previous image's vectors with `embed --reuse-from` — tested
# recipe in README, "Si el build tarda demasiado".
RUN --mount=type=cache,target=/root/.cache/kb-models \
    export KB_EMBED_CACHE_DIR=/root/.cache/kb-models && \
    npx kb-ingest init --db /work/kb.db && \
    npx kb-ingest ingest --db /work/kb.db --plugin ./plugin/ingest.mjs --opt root=./rules --opt vault=./vault --opt standards=./standards --opt lessons=./lessons \
      --opt catalogo=./catalogo --opt precedentes=./precedentes && \
    npx kb-ingest embed --db /work/kb.db


# ── Final stage: data-only image ────────────────────────────────────────────
# The server's docker-compose runs this image as an init-container with
# a shared volume mounted at /out. The default CMD copies the .db there
# and exits successfully; depends_on.service_completed_successfully on
# the server side waits for that exit.

FROM busybox:1.36-musl

COPY --from=builder /work/kb.db /kb.db
# The MCP server's instructions (KB_INSTRUCTIONS_FILE) ship with the content
# they describe, so both land in the shared volume at the same release.
COPY mcp-instructions.md /mcp-instructions.md

# After copying, chown the file AND the directory to uid 1000 — that's
# the `node` user in the downstream node:22-slim image. Without this the
# server container (running as `node`) cannot create SQLite's WAL/journal
# next to the .db and fails on startup with SQLITE_READONLY_DIRECTORY.
# We use a numeric uid because busybox has no /etc/passwd entry for
# `node`; the value matches Docker Hub's node:22-slim convention.
#
# Override at runtime if needed: `command: ["sh","-c","cp /kb.db /other/path"]`
CMD ["sh", "-c", "mkdir -p /out && cp /kb.db /mcp-instructions.md /out/ && chown -R 1000:1000 /out && echo '[kb-content] kb.db + mcp-instructions.md published to /out (owner 1000:1000)'"]
