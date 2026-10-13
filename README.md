# kb-content

Reglas de negocio en YAML, ingestadas a la KB que sirve `@kb/mcp-server`. Este repo es **contenido**, no código de servidor. Cada cambio a una regla pasa por PR y, al mergear a `main`, se publica una nueva data image en GHCR que el server consume.

## Flujo de extremo a extremo

```
dev edita rules/diferidos/*.yaml
      │
      ▼
abre PR ─────────► CI workflow "Validate rules"
                   │
                   ├─ corre kb-ingest validate sobre cada YAML
                   └─ falla si hay errores de estructura
      │
      ▼
merge a main ────► CI workflow "Build data image"
                   │
                   ├─ kb-ingest init + ingest contra rules/
                   ├─ kb-ingest embed (vectoriza todas las reglas)
                   ├─ docker build con el .db resultante
                   └─ docker push a ghcr.io/luisestrada05/kb-content:main
      │
      ▼
host de despliegue:
  docker compose pull && docker compose up -d --force-recreate
  el server lee el nuevo .db vía el init-container
```

## Cómo agregar / editar una regla

1. **Branch nuevo desde `main`:**
   ```bash
   git checkout main && git pull
   git checkout -b feat/dif-nueva-regla
   ```
2. **Editar el YAML del dominio correspondiente**, p.ej. [rules/diferidos/seed-diferidos-rules.yaml](rules/diferidos/seed-diferidos-rules.yaml). El formato está documentado abajo en **Estructura del YAML**.
3. **Validar localmente** antes de pushear:
   ```bash
   npm install         # si es tu primera vez
   npm run validate    # corre kb-ingest validate sobre cada archivo
   ```
4. **Push + PR a `main`.** El CI `Validate rules` corre el mismo check. Si falla, revisar el log y corregir.
5. **Merge.** En cuanto entra a `main`, el workflow `Build data image` publica `ghcr.io/luisestrada05/kb-content:main` con el `.db` actualizado.
6. **Aplicar en el host del server:**
   ```bash
   docker compose pull
   docker compose up -d --force-recreate
   ```

## Estructura del YAML

Un archivo por dominio bajo `rules/<dominio>/`. Forma exacta:

```yaml
metadata:
  domain: diferidos            # OBLIGATORIO — nombre del dominio
  version: "1.0.0"             # OBLIGATORIO — semver del manifest
  created_at: "2026-06-16"     # OBLIGATORIO — fecha ISO

rules:
  - id: R-DIF-001              # OBLIGATORIO — patrón (R|E|G|S)-XXX-NNN
    type: rule                 # rule | exception | gap | sla
    subdomain: alta            # libre — agrupa dentro del dominio
    summary: "Descripción corta de qué hace la regla"

    applicability:
      evento: [alta_diferido, diferir_compra]   # OBLIGATORIO — array no vacío
      actor: [SISTEMA, BATCH]                    # opcional

    formal_rule:                                 # opcional
      conditions:
        - field: validacion_previa
          op: eq                                 # eq | neq | gt | lt | in | not_in
          value: true
      action: "Qué hace el sistema si se cumple"
      overrides: R-DIF-XXX                       # solo para exceptions

    source_ref: "confluence://diferidos/alta §3.2"   # OBLIGATORIO
    owner: "equipo-diferidos"                         # OBLIGATORIO
    status: active                                    # active | deprecated | draft
    risk_note: "Qué pasa si NO se cumple"             # OBLIGATORIO

    related_objects:                                  # OBLIGATORIO para validación
      tables: [DIF, LIN]
      sps: [DIVVAL, LINALT]
```

### Convenciones que el validador hace cumplir

| Regla | Por qué |
|---|---|
| `id` matchea `(R\|E\|G\|S)-XXX-NNN` | Patrón estable, parseable, búsqueda exacta |
| Prefijo de `id` coincide con `type` (R→rule, E→exception, G→gap, S→sla) | Evita copy-paste mistakes |
| `applicability.evento` es array no vacío | El motor de reglas matchea por evento; un evento string suelto rompe el flujo |
| `status` ∈ {`active`, `deprecated`, `draft`} | Enum cerrado para semantica clara en runtime |
| `risk_note` presente | Toda regla debe documentar su contraparte (qué se rompe si no se cumple) |
| `related_objects.tables` y `.sps` referencian objetos existentes en la KB | Si una tabla / SP es nuevo, el validador lo registra como `status: new` (auto-register en CI) |

## Decisiones (el porqué de las reglas)

La regla YAML dice **qué**; la nota de decisión dice **por qué** y, sobre todo, qué **no** significa. Viven en `vault/decisiones/` como markdown compatible con Obsidian (se puede editar sin la app).

1. Copia [vault/_plantillas/decision.md](vault/_plantillas/decision.md) a `vault/decisiones/DEC-XXX-NNN.md`.
2. Llena al menos `## Intención` y `## No significa` (obligatorias). Lo que no sepas márcalo con `⚠️ POR COMPLETAR`: el validador avisa pero no falla.
3. En la regla agrega `decision: DEC-XXX-NNN`. Varias reglas pueden citar la misma decisión.

Al ingestar, la intención y los "no significa" se embeben en la regla, así `kb_get rule:...` devuelve regla + porqué juntos, y se crea la arista `rule → justified_by → decision`.

| `status` | Significado |
|---|---|
| `proposed` | Borrador, aún no validado con negocio |
| `accepted` | Validado (`validado_con` lleno) |
| `superseded` | Reemplazada; requiere `superseded_by` |

## Estándares y convenciones por capa

Separados de las reglas de negocio: una regla dice qué debe pasar en el dominio; un estándar dice cómo se escribe el código. Viven por capa en `standards/<capa>/<tema>.yaml` (`bd`, `ms`, `web`), con la forma de [standards/_plantillas/standard.yaml](standards/_plantillas/standard.yaml) e IDs `STD-<TEC>-NNN`. Se ingestan como entidades `standard`, con la capa, la tecnología y la categoría como términos (`kb_by_term bd`).

**Las carpetas arrancan vacías a propósito**: cada proyecto las puebla según lo necesite. Ver [standards/README.md](standards/README.md). Para capturarlas, usa el prompt de Copilot [.github/prompts/capturar-estandares.prompt.md](.github/prompts/capturar-estandares.prompt.md): pregunta la capa y la tecnología, te pide las fuentes en tu máquina, propone la lista antes de escribir y corre la validación. Si nadie sabe el porqué de un estándar, `rationale: "heredado, sin documentar"`; nunca uno inventado.

## Catálogo de componentes

[`catalogo/`](catalogo/README.md) dice dónde vive cada objeto que tocan las reglas: `sp:DIVVAL` → repo `bd-diferidos`, `sp/DIVVAL.sql`. Con eso el agente puede ir a leer el objeto y confirmar la regla contra el código. Las rutas son siempre relativas al repo; la ruta local de cada repo la guarda cada dev en `~/.kb/repos-locales.yaml`. Se puebla solo: cuando el agente necesita un objeto que no está mapeado, pregunta la ruta y propone agregarla.

## Precedentes

[`precedentes/`](precedentes/README.md) guarda cómo se resolvió algo antes, para seguirlo en vez de inventar otra forma. Apunta a objetos, tickets y PRs; no copia código. Su `traza` es `confirmada` (se leyó en los objetos de `verificado_en`) o `posible` (solo por texto; el agente la confirma antes de seguirla). Se pueblan hacia adelante: al cerrar cada tarea, el implementador propone el suyo.

## Agentes de Copilot

[`agentes/`](agentes/README.md) trae el `implementador` (busca precedentes, confirma reglas en el código, aplica los estándares de cada capa y etiqueta la fuente de todo lo que propone) y el `verificador` (solo lectura: dice si el código hace lo que dicen la regla o el precedente). Se instalan en los repos de código o a nivel usuario.

## Instrucciones para el agente (MCP)

[`mcp-instructions.md`](mcp-instructions.md) le dice al agente **cuándo** consultar la KB: antes de tocar lógica de negocio, buscar por SP o tabla, respetar los "No significa" y avisar de lecciones sin guarda completa. El servidor lo manda como `instructions` del protocolo MCP (`KB_INSTRUCTIONS_FILE`), así que no hay que copiarlo a cada repo de código.

La imagen de datos lo publica junto a `kb.db` en el volumen compartido. En el servicio `kb-mcp` del compose:

```yaml
environment:
  KB_DB_PATH: /data/kb.db
  KB_INSTRUCTIONS_FILE: /data/mcp-instructions.md
```

Si el cliente no muestra las instrucciones del servidor, pega el mismo texto en el `.github/copilot-instructions.md` del repo de código.

## Comandos locales

```bash
# Instalar dependencias (instala @kb/mcp-server desde GitHub y compila TS)
npm install

# Validar todos los YAMLs
npm run validate

# Ingestar y vectorizar localmente (genera ./kb.db y muestra stats)
# La primera vez descarga el modelo de embeddings (~130 MB).
npm run ingest:local

# Consultar la KB local (opcional)
npx kb-ingest query term diferidos --db ./kb.db
npm run find -- "¿se puede diferir una compra con la tarjeta bloqueada?"
npm run find -- R-DIF-001 --mode fts
npx kb-ingest query get rule:R-DIF-001 --db ./kb.db
```

## Búsqueda semántica

Cada build vectoriza **todas** las reglas: convierte `summary` + riesgo + acción + condiciones en un vector que representa su significado. Así `kb_find` encuentra una regla aunque la pregunta use otras palabras ("pagar en mensualidades" → "alta de diferido").

- **No hay que hacer nada al agregar una regla.** El `.db` se reconstruye desde cero en cada merge, así que lo nuevo y lo existente se vectoriza siempre.
- **El modelo es local** (`Xenova/multilingual-e5-small`): corre en el build, sin API keys ni costo por consulta. El server trae el mismo modelo para convertir las preguntas.
- **Para comprobar la cobertura:** `npx kb-ingest status --db ./kb.db` muestra `embeddings.missing` (reglas sin vector) y `embeddings.stale` (vector desactualizado). Después de `npm run ingest:local` ambos deben ser `0`.

### Si el build tarda demasiado

Vectorizar cuesta ~12 ms por regla corta y ~150 ms por documento de ~400 palabras (4 vCPU, como un runner de GitHub Actions). Con las reglas de este repo son segundos, así que **no hace falta nada**. Con miles de documentos largos, 10,000 documentos serían ~25 min por build, y `build-data.yml` corta a los 15.

La solución es no re-vectorizar lo que no cambió: tomar el `kb.db` de la imagen publicada anterior y pasarlo a `kb-ingest embed --reuse-from`. Solo se vectoriza lo nuevo o editado. Receta probada (dos builds seguidos: el segundo reutilizó 5 de 6 vectores y solo vectorizó la regla editada):

**1. `Dockerfile`**: agregar una etapa `prev` antes del builder y cambiar el `RUN` de ingest:

```dockerfile
# Imagen de datos anterior, para reutilizar sus vectores. Por default una
# imagen sin /kb.db: el primer build, o uno local, vectoriza todo.
ARG PREV_DATA_IMAGE=busybox:1.36-musl
FROM ${PREV_DATA_IMAGE} AS prev

FROM node:22-slim AS builder
# ... igual que hoy ...

# Se copia a /tmp porque la DB está en WAL y SQLite no la abre desde un
# montaje de solo lectura.
RUN --mount=type=cache,target=/root/.cache/kb-models \
    --mount=type=bind,from=prev,source=/,target=/prev \
    export KB_EMBED_CACHE_DIR=/root/.cache/kb-models && \
    REUSE="" && \
    if [ -f /prev/kb.db ]; then cp /prev/kb.db /tmp/prev.db && REUSE="--reuse-from /tmp/prev.db"; fi && \
    npx kb-ingest init --db /work/kb.db && \
    npx kb-ingest ingest --db /work/kb.db --plugin ./plugin/ingest.mjs --opt root=./rules && \
    npx kb-ingest embed --db /work/kb.db $REUSE
```

**2. `.github/workflows/build-data.yml`**: en el paso `Build and push`, pasar la imagen anterior solo cuando hay login a GHCR (no en PRs):

```yaml
          build-args: |
            ${{ github.event_name != 'pull_request' && format('PREV_DATA_IMAGE=ghcr.io/{0}:main', github.repository) || '' }}
```

En el log del build aparece `reused N vector(s) from /tmp/prev.db` y `M to embed`. Si se cambia de modelo, no se reutiliza nada: los vectores de otro modelo no sirven.

Detalles en el README de [`mcp-kb-server`](https://github.com/luisestrada05/mcp-kb-server#búsqueda-semántica-embeddings).

## Estructura del repo

```
kb-content/
├── rules/
│   └── diferidos/
│       └── seed-diferidos-rules.yaml      ← el equipo edita esto
├── vault/decisiones/                       ← el porqué (DEC-…)
├── standards/{bd,ms,web}/                  ← convenciones por capa
├── lessons/                                ← lo que ya salió mal (L-…)
├── catalogo/                               ← dónde vive cada objeto
├── precedentes/                            ← cómo se resolvió antes (P-…)
├── agentes/                                ← implementador + verificador (Copilot)
├── mcp-instructions.md                     ← cuándo y cómo consultar la KB
├── plugin/
│   ├── ingest.mjs                          ← cómo se transforma YAML → KB
│   └── layers.mjs                          ← capas válidas: bd, ms, web
├── scripts/
│   └── validate-all.mjs                    ← entry-point del npm run validate
├── Dockerfile                              ← data-only image
├── .github/workflows/
│   ├── validate.yml                        ← gate de PRs
│   └── build-data.yml                      ← publica imagen en main
└── package.json
```

## Imagen publicada

| Tag | Origen |
|---|---|
| `ghcr.io/luisestrada05/kb-content:main` | rolling — último push a `main` |
| `ghcr.io/luisestrada05/kb-content:1.2.3` | release versionado (`git tag v1.2.3 && git push --tags`) |
| `ghcr.io/luisestrada05/kb-content:latest` | alias del tag más reciente |

La imagen es **privada**. Cada miembro del equipo necesita un PAT clásico con scope `read:packages` y un `docker login ghcr.io` antes de hacer pull.

## Plugin de ingesta

`plugin/ingest.mjs` arrancó como copia del template oficial en [mcp-kb-server :: examples/yaml-rules/](https://github.com/luisestrada05/mcp-kb-server/tree/main/examples/yaml-rules). Está libre de divergir a medida que aparezcan necesidades específicas (más tipos de relación, campos extra de metadata, etc.).
