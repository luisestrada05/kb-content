# Agentes de Copilot

| Agente | Qué hace |
|---|---|
| [`implementador`](implementador.agent.md) | Implementa una tarea: busca precedentes, confirma reglas en el código, aplica estándares por capa y etiqueta la fuente de todo |
| [`verificador`](verificador.agent.md) | Solo lectura: dice si el código de un objeto hace lo que dicen la regla o el precedente |

Viven aquí como fuente única: el agente y las convenciones de la KB (IDs, capas, catálogo, precedentes) cambian en el mismo PR. Se **usan en los repos de código**, que es donde trabaja el dev.

## Instalación (una vez por persona)

```bash
git clone git@github.com:luisestrada05/kb-content.git
cd kb-content
npm run agentes:instalar
```

Crea en `~/.copilot/agents/` un enlace a cada agente de esta carpeta, así que quedan disponibles en todos tus repos y **un `git pull` en kb-content los actualiza**. Es idempotente y no pisa archivos que no sean suyos. Para otro directorio: `npm run agentes:instalar -- --dir <ruta>`.

No los copies a `.github/agents/` de cada repo de código: serían N copias que se desactualizan.

Los dos necesitan el servidor MCP `kb` registrado. El flujo esencial también va en [`mcp-instructions.md`](../mcp-instructions.md), que el servidor manda a cualquier agente: si el cliente no carga estos archivos, el comportamiento base se mantiene.
