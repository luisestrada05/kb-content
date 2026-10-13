KB del negocio: reglas de negocio del sistema (con su porqué cuando se conoce y lo que NO significan), notas de decisión (DEC-…), estándares y convenciones por capa (bd, ms, web), LECCIONES (errores que ya pasaron, normalmente incidentes de Jira, y qué los evita), PRECEDENTES (cómo se resolvió algo antes) y un CATÁLOGO de dónde vive cada objeto (repo + ruta). Es un sistema con ~20 años de historia: para muchas reglas el porqué original se perdió, y eso se dice en vez de inventarse.

Cuándo consultarla — ANTES de diseñar, implementar, revisar o analizar un incidente que toque lógica de negocio:
- Por el objeto que vas a tocar: `kb_by_term` con el nombre del SP o de la tabla, en minúsculas (p. ej. `divval`, `linalt`, `dif`). Devuelve las reglas que lo usan, las lecciones de lo que ya se rompió ahí y los precedentes que lo tocaron.
- Por el evento o el tema: `kb_by_term` con la palabra clave en minúsculas y SIN acentos (`alta_diferido`, `diferidos`).
- Por texto libre: `kb_find "<texto>"` (sin guiones en la consulta: hoy rompen la búsqueda). Busca por significado, no solo por palabras.
- Qué depende de algo: `kb_related <id>` (p. ej. `kb_related sp:DIVVAL`, `kb_related decision:DEC-DIF-001`).
- Dónde vive un objeto: `kb_get sp:DIVVAL` trae `Ubicación: <repo>/<ruta>` si está en el catálogo.
- Estándares: `kb_by_term <capa>` con `type: standard` (`bd`, `ms`, `web`) por cada capa que toque la tarea. Si una capa no tiene ninguno, dilo y pide al usuario las convenciones de su equipo; no apliques convenciones genéricas como si fueran las de la casa.

Cómo usar lo que devuelve:
- `kb_get` de la regla trae en su body el `Por qué` (si se conoce) y los `No significa`. Los "No significa" son malas lecturas que ya ocurrieron o son fáciles de cometer: respétalos y cítalos por ID de regla.
- Una decisión con status `proposed` no está validada con negocio: úsala, pero dilo. Un `⚠️ POR COMPLETAR` es un hueco conocido, no un dato.
- Si la regla contradice lo que hace el SP, en un sistema legado el comportamiento del SP es la regla de facto: dilo explícitamente con ambas citas y no lo resuelvas en silencio.
- Una lección (`lesson:L-…`) es un error que ya ocurrió: aplica su "Haz en cambio". Si su guarda es `parcial` o `ninguna`, nada automático te detendrá: avísalo explícitamente al usuario antes de seguir.
- Un precedente (`precedent:P-…`) con traza `confirmada` es cómo ya se resolvió: síguelo antes que inventar otra forma. Con traza `posible` NO lo sigas sin confirmarlo en el código.
- Si no hay regla para lo que vas a tocar, dilo ("sin regla en la KB"). Si al trabajar descubres una regla o un incidente revela una mala lectura, propón agregarla a kb-content (`rules/<dominio>/*.yaml` con su `no_significa`, o `lessons/<area>/*.yaml` con el incidente como evidencia).

Al implementar una tarea, en este orden:
1. ¿Ya se hizo antes? `kb_find` con lo que pide la tarea y `kb_by_term` con los objetos que toca. Muestra al usuario los precedentes y lecciones candidatos con su ID y traza, y pregúntale cuál aplica. Si no hay ninguno, dilo: "sin precedente en la KB".
2. Confirma en el código. Para cada regla y precedente en que te vas a apoyar, ve a sus objetos: `kb_get <objeto>` da repo y ruta. La ruta local del repo está en `~/.kb/repos-locales.yaml`; si no está ahí o el objeto no está en el catálogo, PREGUNTA al usuario la ruta (no la adivines ni busques en todo el disco) y guárdala en ese archivo. Lee el objeto (si tu cliente puede, delega en el agente `verificador` para no llenar tu contexto) y reporta por cada una: CONFIRMADA, DIVERGE o NO ENCONTRADA, con `archivo:línea`.
3. Lee los estándares de cada capa que vas a tocar: `kb_by_term <capa>` con `type: standard`.
4. Propón el plan, implementa y haz una autorrevisión contra los estándares `must`, los "No significa" y las lecciones con guarda `parcial` o `ninguna`.
5. Al cerrar, propón por PR a kb-content: el precedente (`precedentes/<area>/*.yaml`, traza `confirmada` con los objetos que tocaste), las ubicaciones que el usuario te dio (`catalogo/`) y, si hubo una decisión nueva, su nota `proposed` en `vault/decisiones/`. Una DIVERGENCIA encontrada se propone como lección o como `no_significa` de la regla.

Transparencia — cada afirmación de tu plan o tu respuesta lleva su fuente:
- `[precedente P-…]` así se hizo antes · `[regla R-…]` / `[estándar STD-…]` lo exige algo documentado · `[lección L-…]` evita un error que ya pasó · `[código archivo:línea]` lo leíste en el código.
- `[posible precedente P-…, sin confirmar]` cuando la traza es `posible` y aún no la confirmaste.
- `[NUEVO — requiere validación]` todo lo que no tiene respaldo. Es válido proponer algo nuevo; no lo es presentarlo como si estuviera respaldado. Todo lo NUEVO que se quede en la implementación se vuelve una decisión `proposed` al cerrar.

La KB es una foto: al citar algo verificado usa la fecha tal como aparece ("verificado 2026-10-01"), nunca "hoy" ni "actualmente".
