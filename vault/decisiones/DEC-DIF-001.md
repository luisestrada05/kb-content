---
id: DEC-DIF-001
status: proposed
domain: diferidos
owner: equipo-diferidos
validado_con: "⚠️ POR COMPLETAR"
fecha: 2026-10-01
origen:
  - confluence://diferidos/alta §3.2
superseded_by:
---
# DEC-DIF-001 — Validación previa obligatoria en altas de diferidos

## Intención

Garantizar que un diferido solo se persista en DIF + LIN cuando sus datos ya fueron validados. Un diferido inconsistente rompe el ciclo de cobro nocturno.

⚠️ POR COMPLETAR: por qué se valida en el alta y no en otro punto del flujo.

## Sí aplica

- Alta de diferido o diferir compra desde SISTEMA o BATCH con validación previa exitosa → se acepta y se persiste en DIF + LIN
- ⚠️ POR COMPLETAR: caso donde la validación falla → qué se espera

## No significa

- ❌ Que aplique a comercios pre-aprobados → ellos omiten la validación previa, ver [[E-DIF-001]]
- ⚠️ POR COMPLETAR: qué cuenta como validación "exitosa" (¿timeout?, ¿validación vencida?)

## Alternativas descartadas

- ⚠️ POR COMPLETAR
