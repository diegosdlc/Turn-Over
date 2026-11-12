# Editor visual de niveles (modo pruebas)

Este editor es una herramienta de desarrollo que reutiliza los seis CSV de balance/ como fuente de verdad. No modifica el modo campaña ni sus partidas guardadas.

## Activar

1. Abre uno de los cuatro niveles de campaña.
2. En **Ajustes**, activa **Modo edición (pruebas)** (también disponible en el cuaderno).
3. Si estabas en campaña, se abrirá el mismo nivel en una **prueba aislada** con los parámetros URL level=tutorial-02&lab=1&editor=1. No se guarda ni se sobrescribe tu progreso.
4. Selecciona **Rivales** para mover una pieza rival con dos clics (selección y destino) o arrastrándola. El despliegue rival se limita a las filas 0–1.
5. Selecciona **Obstáculos** para moverlos; **+ Obstáculo** para colocarlos; **Borrar** para eliminarlos. Puedes añadir/retirar piezas rivales, pero el nivel debe conservar un rey rival.
6. Ajusta presupuesto, profundidad/aleatoriedad/agresividad/retardo de IA, supervivencia/escolta y perfil táctico. Los pesos de un perfil son **compartidos** entre todos los niveles que lo usen.
7. Pulsa **Probar cambios** para iniciar una partida de prueba con la configuración temporal. Para seguir editando, vuelve a activar el modo en Ajustes.

Los cambios se mantienen localmente durante esta sesión de página hasta guardarlos en GitHub. Recargar sin guardar los pierde.

## Guardar en una rama real

1. Crea en GitHub un **fine-grained personal access token** limitado al repositorio diegosdlc/Turn-Over, con permiso **Contents: Read and write**. Úsalo únicamente desde una copia del juego servida desde un origen de confianza.
2. Pega el token en el editor y pulsa **Conectar**. Se conserva **solo en memoria**, no en localStorage, cookies ni CSV; se descarta al recargar la página. No compartas ni incluyas el token en incidencias.
3. Selecciona una rama existente. Al seleccionarla, se cargan sus CSV reales como punto de partida; si tienes cambios locales, se pedirá confirmación antes de descartarlos.
4. Para crear otra rama, elige su **rama de origen**, introduce el nombre (ejemplo: balance/prueba-01) y pulsa **Crear rama**. Se crea en GitHub y pasa a seleccionarse.
5. Edita y pulsa **Guardar commit en rama**. Antes de guardar se usa el mismo validador CSV que la campaña. Solo se escriben los CSV modificados, en **un único commit** dirigido a la rama escogida.

Si la rama cambió en GitHub desde que se cargó, el editor **rechaza** el guardado. Vuelve a cargar la rama para evitar sobrescribir cambios ajenos. Una rama protegida o un token sin permisos también puede rechazar el commit.

**Importante:** guardar en GitHub no hace un merge ni publica automáticamente una versión del juego. Los CSV aparecerán en la rama elegida; usa una pull request para incorporarlos a main. Si la aplicación se sirve desde otra rama, la página seguirá cargando los CSV de su despliegue hasta actualizar esa publicación.

## Archivos

- src/dev/LevelEditor.js: editor visual y navegación por ramas.
- src/dev/level-editor-data.js: modelo de cambios, serialización, validaciones y previsualización.
- src/dev/github-editor-api.js: autenticación temporal y API GitHub (ramas + commit atómico).
- src/dev/level-editor.css: estilos del panel y marcadores del tablero.
- tests/level-editor.test.js: pruebas de CSV, previsualización y commits.

## Limitaciones

- Los costes globales de balance/pieces.csv y el roster inicial de balance/player-presets.csv **se leen y validan**, pero esta primera versión no los edita en la interfaz.
- La prueba temporal utiliza los costes globales cargados al arrancar; no hay modificación en vivo de los costes de piezas.
- No hay un servicio de autenticación propio: para escribir en GitHub desde una web estática es necesario proporcionar un token durante la sesión.
