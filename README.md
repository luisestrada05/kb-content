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

Detalles en el README de [`mcp-kb-server`](https://github.com/luisestrada05/mcp-kb-server#búsqueda-semántica-embeddings).

## Estructura del repo

```
kb-content/
├── rules/
│   └── diferidos/
│       └── seed-diferidos-rules.yaml      ← el equipo edita esto
├── plugin/
│   └── ingest.mjs                          ← cómo se transforma YAML → KB
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
