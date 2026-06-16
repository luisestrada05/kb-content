#!/usr/bin/env node
/**
 * Recursively walks rules/** and runs `kb-ingest validate` on every YAML.
 *
 * Used by both `npm run validate` (local) and the CI workflow. Exits
 * non-zero on the first failure so CI fails fast and the dev sees the
 * offending file immediately.
 *
 * The shared SQLite file (./tmp.db) is created once and re-used so that
 * registered tables/SPs from one rule file count as "known" when the
 * next file references them — matches the production ingest behavior.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RULES_DIR = 'rules'
const DB = './tmp.db'

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.yaml') || full.endsWith('.yml')) out.push(full)
  }
  return out
}

if (existsSync(DB)) rmSync(DB)

const init = spawnSync('npx', ['kb-ingest', 'init', '--db', DB], { stdio: 'inherit' })
if (init.status !== 0) process.exit(init.status ?? 1)

const files = walk(RULES_DIR)
if (files.length === 0) {
  process.stderr.write(`[validate-all] no YAML files found under ${RULES_DIR}/\n`)
  process.exit(0)
}

process.stderr.write(`[validate-all] validating ${files.length} file(s)\n`)

let failed = 0
for (const f of files) {
  process.stderr.write(`\n── ${f} ──\n`)
  const r = spawnSync(
    'npx',
    ['kb-ingest', 'validate', '--db', DB, '--file', f, '--auto-register'],
    { stdio: 'inherit' }
  )
  if (r.status !== 0) failed++
}

if (failed > 0) {
  process.stderr.write(`\n🚫 ${failed} file(s) failed validation\n`)
  process.exit(1)
}
process.stderr.write('\n✅ all rule files passed validation\n')
