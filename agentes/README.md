# Agentes de Copilot

| Agente | Qué hace |
|---|---|
| [`implementador`](implementador.agent.md) | Implementa una tarea: busca precedentes, confirma reglas en el código, aplica estándares por capa y etiqueta la fuente de todo |
| [`verificador`](verificador.agent.md) | Solo lectura: dice si el código de un objeto hace lo que dicen la regla o el precedente |

Viven aquí como fuente única, pero se **usan en los repos de código**, que es donde trabaja el dev. Instalación, en cualquiera de las dos formas:

- **Por repo:** copiarlos a `.github/agents/` del repo de código.
- **Por usuario:** copiarlos al directorio de agentes de tu Copilot (Copilot CLI: `~/.copilot/agents/`), para tenerlos en todos tus repos.

Los dos necesitan el servidor MCP `kb` registrado. El flujo esencial también va en [`mcp-instructions.md`](../mcp-instructions.md), que el servidor manda a cualquier agente: si el cliente no carga estos archivos, el comportamiento base se mantiene.
