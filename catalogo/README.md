# Catálogo de componentes

Dice **dónde vive** cada objeto que tocan las reglas, para que el agente vaya a leerlo y confirme la regla contra el código en vez de confiar solo en la regla.

Las reglas ya declaran sus objetos (`related_objects: { sps: [DIVVAL] }` → `sp:DIVVAL`). El catálogo cierra la cadena:

```
regla R-DIF-001 → sp:DIVVAL → repo bd-diferidos, sp/DIVVAL.sql → el agente lo lee
```

## Archivos

- `catalogo/repos.yaml`: los repos del sistema. Son pocos y casi no cambian. Forma: [`_plantillas/repos.yaml`](_plantillas/repos.yaml).
- `catalogo/<capa>/<area>.yaml`: dónde vive cada objeto. Forma: [`_plantillas/componentes.yaml`](_plantillas/componentes.yaml).

`objeto` usa el mismo ID que la KB: `sp:DIVVAL`, `table:DIF`, `code:ruta/Archivo.java::Clase`. Para cosas que ninguna regla nombra todavía se vale un tipo propio: `proceso:cobro-nocturno`, `servicio:diferidos-api`.

## Rutas: siempre relativas al repo

Cada dev clona en un lugar distinto, así que en la KB solo va `repo` + `ruta` dentro del repo. El validador rechaza rutas absolutas. La ruta local de cada repo la guarda cada quien en su máquina, fuera de este repo:

```yaml
# ~/.kb/repos-locales.yaml — lo crea y llena el agente la primera vez que lo necesita
bd-diferidos: /Users/<tu-usuario>/dev/bd-diferidos
```

## Se puebla solo

No hay que mapear todo de entrada. Cuando el agente necesita leer un objeto que no está en el catálogo, le pide la ruta al dev y propone agregarla aquí (PR). La siguiente vez ya no pregunta.
