KB del negocio: reglas de negocio del sistema (con su porqué cuando se conoce y lo que NO significan), notas de decisión (DEC-…), estándares técnicos por tecnología y LECCIONES (errores que ya pasaron, normalmente incidentes de Jira, y qué los evita). Es un sistema con ~20 años de historia: para muchas reglas el porqué original se perdió, y eso se dice en vez de inventarse.

Cuándo consultarla — ANTES de diseñar, implementar, revisar o analizar un incidente que toque lógica de negocio:
- Por el objeto que vas a tocar: `kb_by_term` con el nombre del SP o de la tabla, en minúsculas (p. ej. `divval`, `linalt`, `dif`). Devuelve las reglas que lo usan y las lecciones de lo que ya se rompió ahí.
- Por el evento o el tema: `kb_by_term` con la palabra clave en minúsculas y SIN acentos (`alta_diferido`, `diferidos`).
- Por texto libre: `kb_find "<texto>"` (sin guiones en la consulta: hoy rompen la búsqueda).
- Qué depende de algo: `kb_related <id>` (p. ej. `kb_related sp:DIVVAL`, `kb_related decision:DEC-DIF-001`).
- Estándares: `kb_by_term <tecnologia>` (p. ej. `sybase`). Si no hay ninguno para la tecnología que vas a tocar, dilo y pide al usuario los estándares de su equipo; no apliques convenciones genéricas como si fueran las de la casa.

Cómo usar lo que devuelve:
- `kb_get` de la regla trae en su body el `Por qué` (si se conoce) y los `No significa`. Los "No significa" son malas lecturas que ya ocurrieron o son fáciles de cometer: respétalos y cítalos por ID de regla.
- Una decisión con status `proposed` no está validada con negocio: úsala, pero dilo. Un `⚠️ POR COMPLETAR` es un hueco conocido, no un dato.
- Si la regla contradice lo que hace el SP, en un sistema legado el comportamiento del SP es la regla de facto: dilo explícitamente con ambas citas y no lo resuelvas en silencio.
- Una lección (`lesson:L-…`) es un error que ya ocurrió: aplica su "Haz en cambio". Si su guarda es `parcial` o `ninguna`, nada automático te detendrá: avísalo explícitamente al usuario antes de seguir.
- Si no hay regla para lo que vas a tocar, dilo ("sin regla en la KB"). Si al trabajar descubres una regla o un incidente revela una mala lectura, propón agregarla a kb-content (`rules/<dominio>/*.yaml` con su `no_significa`, o `lessons/<area>/*.yaml` con el incidente como evidencia).

La KB es una foto: al citar algo verificado usa la fecha tal como aparece ("verificado 2026-10-01"), nunca "hoy" ni "actualmente".
