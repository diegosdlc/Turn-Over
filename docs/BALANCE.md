# Balance editable de Turn Over

Los números y la composición de los **cuatro niveles de campaña** están externalizados a CSV, siguiendo el mismo criterio que `locales/texts.csv`. Los CSV de `balance/` son la **única fuente de verdad de ejecución**; este documento es una guía, no un archivo de datos.

| Archivo | Qué se edita |
| --- | --- |
| `balance/pieces.csv` | Costes base y evolucionado de las seis piezas. |
| `balance/levels.csv` | Presupuesto y condición de victoria de cada nivel, duración de supervivencia, casilla del rey de misión (`mission_king_x`, `mission_king_y`), profundidad/aleatoriedad/retardo de la IA y enlace al siguiente nivel. Incluye una fila auxiliar para `deployment-budget-lab` (`kind=lab`). |
| `balance/enemy-formations.csv` | Una fila por pieza rival, con identificador, tipo, facción, evolución, orientación y casilla `x,y`. |
| `balance/obstacles.csv` | Una fila por obstáculo: casilla, bloqueo y apariencia. Se pueden añadir o quitar filas. |

Los archivos están en UTF-8 con cabeceras exactas, comas y comillas CSV estándar. Se pueden editar en Excel, LibreOffice Calc o Google Sheets, exportando como CSV. Reinicia la página para cargar los nuevos valores; el navegador usa `cache: 'no-store'`.

## Campaña

| Nivel | ID | Victoria | Presupuesto inicial |
| --- | --- | --- | ---: |
| 1 | `tutorial-01` | Destrucción (eliminar toda la banda rival) | 18 |
| 2 | `tutorial-02` | Escolta (llevar el rey propio a la fila objetivo) | 22 |
| 3 | `tutorial-03` | Captura (capturar o destruir al rey rival) | 26 |
| 4 | `tutorial-04` | Supervivencia (sobrevivir `survive_rounds` rondas) | 30 |

Los cuatro niveles usan despliegue alterno de tres rondas, con el rey rival precolocado y las demás piezas rivales colocadas preferentemente en la casilla de su fila CSV. Si la casilla ya no es legal, la IA busca una posición legal alternativa. `x` e `y` van de **0 a 7**, con el enemigo desplegando en filas **0–1** y el jugador en **6–7**. El `target_row` del objetivo de escolta también se expresa en coordenadas de tablero.

La formación enemiga se valida y se suma utilizando los mismos costes que el despliegue del jugador. Si el valor de la banda rival no coincide con `point_limit`, el juego avisa en consola, pero respeta el presupuesto fijado. Así es posible experimentar con asimetrías deliberadas. La fila del laboratorio de despliegue mantiene 50 puntos y no constituye un quinto nivel de campaña.

## Validaciones

- Los costes de piezas son finitos y no negativos; el evolucionado debe costar más que el base.
- Los presupuestos son enteros positivos; la IA recibe parámetros numéricos válidos.
- Cada nivel de campaña requiere una formación rival con rey; no puede haber IDs de pieza ni casillas repetidas.
- Los obstáculos no pueden solaparse ni ocupar una casilla inicial rival si bloquean.
- Un error estructural en cualquiera de los cuatro CSV impide cargar el balance y lo muestra como error, para evitar partidas mal configuradas.
- Ejecuta `npm test` después de editar tablas: incluye validación de todos los niveles y pruebas de cambios de datos.

Las bandas del jugador **se arrastran entre niveles**: sobreviven y evolucionan las piezas participantes, se retiran las perdidas y las reservas permanecen sin evolucionar. El presupuesto solo se gasta en piezas que participan.

Los parámetros de IA `weights.material`, `weights.captured`, `weights.mobility`, `weights.objective`, `weights.prisonerSafety` y `weights.rescuePotential` siguen teniendo valores por defecto en `AIController`; esta primera iteración CSV expone la profundidad, aleatoriedad y retardo por nivel.

## Rey protegido de misión

Los niveles de **escolta** (`tutorial-02`) y **supervivencia** (`tutorial-04`) añaden automáticamente un Rey de misión. Su casilla inicial se edita en `balance/levels.csv` mediante las columnas `mission_king_x` y `mission_king_y` (coordenadas 0–7). Por defecto comienza en `2,7`. Debe estar en una fila de despliegue del jugador, 6 o 7, y no puede solaparse con obstáculos bloqueantes ni con la banda rival.

El Rey de misión es una pieza adicional al roster arrastrado; lo controla el jugador durante el combate, pero arranca colocado y bloqueado durante el despliegue. **Cuesta 0 puntos, no cuenta para las cuotas de las tres rondas, no se puede retirar ni cambiar de posición antes del combate, no evoluciona y no pasa al siguiente nivel.** Se distingue visualmente y en las tarjetas del cuaderno. La condición de victoria o derrota se evalúa sobre este rey específico, aunque el jugador tenga otro rey de campaña. Perderlo supone perder estos encuentros; llevarlo a la fila objetivo gana la escolta. La supervivencia requiere que este rey siga vivo tras las rondas establecidas.

En los demás niveles y laboratorios, las columnas de la posición del rey de misión permanecen vacías. La sección **Misión** del cuaderno describe automáticamente el objetivo según `victory`, `target_row` y `survive_rounds` del mismo CSV; los textos ES/EN viven en `locales/texts.csv`.

## Cierre progresivo del tablero

La columna `encroachment_start_action` de `balance/levels.csv` indica la primera **acción completa de combate** (jugador o rival) tras la cual se añade una casilla bloqueada permanentemente. La campaña usa `10` de inicio; se deja vacía en el laboratorio. Los bloqueos se añaden **después** de resolver los objetivos normales, nunca en despliegue ni al saltar un turno, y afectan a las líneas de movimiento, peones, saltos y rescates mediante el motor de reglas común.

Se elige una casilla libre que no tenga piezas activas ni prisioneros, sin obstáculos previos. La elección solo es válida si **ambos equipos** mantienen alguna acción legal al volverles a tocar, sus unidades conservan una región transitable compartida y, en escolta, el Rey de misión mantiene una ruta geométrica hasta la fila objetivo. La conectividad se evalúa en las ocho direcciones sin tratar como muros permanentes a otras piezas (pueden moverse); no garantiza que todas las jugadas futuras conserven la ruta.

La selección es pseudoaleatoria y reproducible mediante `encroachmentSeed`. Los obstáculos, `combatActionsCompleted` y la semilla se guardan en la sesión; se reinician con el nivel. Si no hay ninguna casilla válida, el jugador pierde, se muestra un aviso y el nivel se reinicia automáticamente. La IA simula el bloqueo inmediato al valorar una jugada y considera movilidad y espacio local; no explora todas las futuras selecciones de muros en minimax para evitar tiempos de cálculo excesivos.

## Aviso, animaciones y destrucción por cierre

El cierre se **anuncia con una acción completa de antelación**. Desde la acción `encroachment_start_action - 1` aparece una marca de aviso animada en una casilla inicialmente vacía. Tras la siguiente acción, del jugador o de la IA, se crea un obstáculo permanente, más pequeño y con animación de entrada. El aviso se sustituye por uno nuevo para el cierre siguiente. Las transiciones respetan `prefers-reduced-motion`.

**Cualquier pieza activa o prisionero que ocupe la casilla anunciada cuando se cierra es destruido**, sin capturarse ni entrar en los reclutamientos. Puede ser una pieza de cualquiera de los bandos, incluso un rey o el Rey de misión: se comprueba la victoria/derrota del escenario inmediatamente después del cierre. No se anuncian casillas ocupadas inicialmente, pero sí pueden ocuparse mientras dura el aviso. Las casillas elegidas deben conservar la conectividad y las acciones legales cuando no se haya producido ya una victoria. Si la casilla anunciada deja de ser válida para el cierre por cambios en el tablero, se vuelve a anunciar otra en lugar de crear una barrera imposible; si no queda ninguna, el jugador pierde y se reinicia el nivel.

`pendingClosure` se guarda junto con los obstáculos, las acciones y la semilla de la partida. La IA simula los cierres y las destrucciones inmediatas al evaluar sus acciones candidatas.

## Captura asimétrica del rey (nivel 3)

En `tutorial-03` y en el laboratorio `scenario-capture-king`, solo el **rey rival** es un objetivo especial. El jugador gana al capturarlo o destruirlo, aunque queden otras piezas enemigas. La IA rival gana al eliminar toda la banda del jugador, **no al capturar su rey**. Si el jugador pierde su propio rey, las piezas restantes siguen activas y pueden completar el objetivo. La IA puntúa especialmente la conservación de su rey, no la eliminación selectiva del rey jugador.
