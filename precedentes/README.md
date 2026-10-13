# Precedentes

Cómo se resolvió algo **antes**, para que la siguiente implementación lo siga en vez de inventar otra forma. Antes de implementar, el agente pregunta "¿esto ya se hizo?" con `kb_find` y estos aparecen por significado aunque estén redactados distinto.

Un precedente **apunta** (objetos, tickets, PRs); no copia código, porque el código cambia y la copia se queda vieja. El agente sigue los punteros y lee el código actual.

## La traza

| `traza` | Significa | Cómo lo usa el agente |
|---|---|---|
| `confirmada` | Alguien leyó los objetos de `verificado_en` y vio ahí la solución | Lo sigue, citándolo |
| `posible` | Se encontró por texto (p. ej. un ticket viejo sin PR ligado) | Lo presenta como *posible precedente* y lo confirma en el código antes de seguirlo |

`confirmada` exige `verificado_en`. La evidencia (tickets, PRs) es opcional: en el legado muchas veces no hay; lo que da la traza es el objeto verificado.

## Cómo se pueblan

Hacia adelante: al cerrar una tarea, el implementador propone su precedente aquí (PR), con los objetos que tocó y verificó. No hace falta reconstruir el histórico.

Forma: [`_plantillas/precedente.yaml`](_plantillas/precedente.yaml), en `precedentes/<area>/<tema>.yaml`.
