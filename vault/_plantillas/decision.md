---
id: DEC-XXX-NNN            # mismo valor que el nombre del archivo
status: proposed           # proposed | accepted | superseded
domain: <dominio>
owner: <equipo>
validado_con: "<persona de negocio que lo aprobó>"
fecha: YYYY-MM-DD
origen:                    # PRD, Confluence, incidente de Jira...
  - confluence://...
superseded_by:             # solo si status: superseded → DEC-XXX-NNN
---
# DEC-XXX-NNN — Título corto de la decisión

## Intención

Qué problema resuelve y por qué se decidió así. Esto es lo que la regla YAML no dice.

## Sí aplica

- Caso concreto → resultado esperado

## No significa

Interpretaciones equivocadas que alguien ya tuvo (o que es fácil tener). Cita el incidente si lo hubo.

- ❌ Lectura incorrecta → lo correcto es...

## Alternativas descartadas

- Opción → por qué no
