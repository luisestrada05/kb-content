# Estándares y convenciones por capa

Aquí viven las convenciones de cada capa: cómo se nombran los campos, qué estructura tiene un SP, un servicio o un componente, cómo se manejan los errores. Un estándar = **una exigencia verificable**, con ejemplo que cumple y ejemplo que no.

```
standards/
  bd/    ← base de datos: tablas, campos, SPs, índices
  ms/    ← microservicios
  web/   ← front
```

**Las carpetas arrancan vacías a propósito.** Cada proyecto las va poblando según lo necesite; nadie tiene que escribirlas todas de entrada. Para capturar las de una capa usa el prompt [`capturar-estandares`](../.github/prompts/capturar-estandares.prompt.md): pregunta la capa y la tecnología, lee tus fuentes (docs, checklists de review, linters) y propone la lista antes de escribir nada.

## Formato

Un archivo por tema: `standards/<capa>/<tema>.yaml` (p. ej. `standards/bd/nombres-de-campos.yaml`), con la forma de [`_plantillas/standard.yaml`](_plantillas/standard.yaml). `metadata.layer` es obligatorio y debe ser `bd`, `ms` o `web` (la lista vive en [`plugin/layers.mjs`](../plugin/layers.mjs)).

| `level` | Qué significa para el agente |
|---|---|
| `must` | Lo revisa en su autorrevisión; si no se cumple, no entrega |
| `should` | Lo aplica; si no puede, lo dice y explica por qué |
| `may` | Opcional |

Si nadie sabe por qué existe una convención: `rationale: "heredado, sin documentar"`. Nunca un porqué inventado. Si alguien lo sabe y es largo, va como nota en `vault/decisiones/` y el estándar la cita con `decision:`.

## Cómo los usa el implementador

Antes de implementar, el agente identifica qué capas toca la tarea y lee los estándares de **cada una** (`kb_by_term bd` con `type: standard`, y lo mismo con `ms` y `web`). Si una capa no tiene estándares, lo dice y no aplica convenciones genéricas como si fueran las de la casa.
