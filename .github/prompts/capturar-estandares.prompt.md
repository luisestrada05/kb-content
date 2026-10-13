---
description: Captura los estándares técnicos de una tecnología y los convierte a standards/<tecnologia>/*.yaml
mode: agent
---
# Capturar estándares técnicos

Tu trabajo es convertir los estándares técnicos que te pase el usuario al formato de este repo. **No inventes estándares**: solo transcribe y estructura lo que el usuario te dé.

## Paso 1 — Qué tecnología

Lista las carpetas que ya existen en `standards/` (ignora `_plantillas`) y pregunta al usuario:

1. ¿De qué tecnología vamos a capturar estándares? (ej. sybase, java, angular)
2. ¿Dónde están? Pide **rutas de archivos en esta máquina** (docs, wikis exportadas, checklists de code review, linters configurados) o que los pegue en el chat.

Una tecnología por sesión. Si el usuario quiere varias, termina una antes de empezar la siguiente.

## Paso 2 — Leer y proponer

Lee las fuentes y arma una lista corta de estándares candidatos: **un estándar = una exigencia verificable**. Si una fuente mezcla varias cosas, sepáralas. Muestra la lista al usuario **antes** de escribir YAML y pregunta:

- ¿Falta alguno o sobra alguno?
- Para cada uno, el `level`: `must` (bloquea review), `should` (recomendado) o `may` (opcional). Si la fuente no lo dice, pregunta; no asumas `must`.

## Paso 3 — Escribir el YAML

Usa la forma exacta de [standards/_plantillas/standard.yaml](../../standards/_plantillas/standard.yaml). Archivo: `standards/<tecnologia>/<tema>.yaml` (un tema por archivo, ej. `naming.yaml`, `manejo-errores.yaml`).

- **IDs:** `STD-<TEC>-NNN` con la abreviatura de la tecnología en mayúsculas (SYB, JAV, ANG...). Continúa la numeración existente; no reutilices IDs.
- **`rationale`:** el porqué. Si la fuente no lo explica y el usuario no lo sabe, escribe literalmente `"heredado, sin documentar"`. Un porqué inventado es peor que uno ausente.
- **`good_example` / `bad_example`:** toma ejemplos de la fuente o del código real que el usuario señale. Si no hay, pregunta si quiere que propongas uno y márcalo así en el ejemplo: `-- ejemplo propuesto, validar`.
- **`owner`:** pregunta qué equipo es dueño de esa tecnología.
- **`status`:** `active` si el usuario confirma que hoy se aplica; `draft` si hay duda.

## Paso 4 — Validar

Corre `npm run validate` y corrige hasta que pase. Al final resume: cuántos estándares quedaron, cuántos tienen `rationale: "heredado, sin documentar"` y cuáles quedaron en `draft`.
