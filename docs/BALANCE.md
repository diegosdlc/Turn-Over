# Balance editable de Turn Over

Los números y la composición de los **cuatro niveles de campaña** están externalizados a CSV, siguiendo el mismo criterio que `locales/texts.csv`. Los CSV de `balance/` son la **única fuente de verdad de ejecución**; este documento es una guía, no un archivo de datos. Un sexto archivo define exclusivamente el roster de las pruebas temporales.

| Archivo | Qué se edita |
| --- | --- |
| `balance/pieces.csv` | Costes base y evolucionado de las seis piezas. |
| `balance/levels.csv` | Presupuesto y condición de victoria de cada nivel, duración de supervivencia, casilla del rey de misión (`mission_king_x`, `mission_king_y`), profundidad/aleatoriedad/retardo de la IA y enlace al siguiente nivel. El antiguo laboratorio de presupuesto ha sido retirado. |
| `balance/enemy-formations.csv` | Una fila por pieza rival, con identificador, tipo, facción, evolución, orientación y casilla `x,y`. |
| `balance/obstacles.csv` | Una fila por obstáculo: casilla, bloqueo y apariencia. Se pueden añadir o quitar filas. |
| `balance/ai-profiles.csv` | Perfiles de comportamiento de la IA reutilizables, con pesos tácticos y prioridades de riesgo. |
| `balance/player-presets.csv` | **Solo pruebas:** una fila por pieza inicial de la banda de cada nivel, con evolución, facción de origen y orientación. |

Los archivos están en UTF-8 con cabeceras exactas, comas y comillas CSV estándar. Se pueden editar en Excel, LibreOffice Calc o Google Sheets, exportando como CSV. Reinicia la página para cargar los nuevos valores; el navegador usa `cache: 'no-store'`.

## Campaña

| Nivel | ID | Victoria | Presupuesto inicial |
| --- | --- | --- | ---: |
| 1 | `tutorial-01` | Destrucción (eliminar toda la banda rival) | 18 |
| 2 | `tutorial-02` | Escolta (llevar el rey propio a la fila objetivo) | 22 |
| 3 | `tutorial-03` | Captura (capturar o destruir al rey rival) | 26 |
| 4 | `tutorial-04` | Supervivencia (conservar al menos una pieza durante `survive_rounds` rondas) | 20 |

Los cuatro niveles usan despliegue alterno de tres rondas, con el rey rival precolocado y las demás piezas rivales colocadas preferentemente en la casilla de su fila CSV. Si la casilla ya no es legal, la IA busca una posición legal alternativa. `x` e `y` van de **0 a 7**, con el enemigo desplegando en filas **0–1** y el jugador en **6–7**. El `target_row` del objetivo de escolta también se expresa en coordenadas de tablero.

La formación enemiga se valida y se suma utilizando los mismos costes que el despliegue del jugador. En supervivencia la asimetría es intencional: **20 puntos para el jugador frente a 30 puntos de banda enemiga**. En otros niveles, un desajuste sigue avisando en consola y se respeta el presupuesto configurado. Los antiguos laboratorios de mecánicas se han retirado del selector y no constituyen niveles de campaña.

## Validaciones

- Los costes de piezas son finitos y no negativos; el evolucionado debe costar más que el base.
- Los presupuestos son enteros positivos; la IA recibe parámetros numéricos válidos.
- Cada nivel de campaña requiere una formación rival con rey; no puede haber IDs de pieza ni casillas repetidas.
- Los obstáculos no pueden solaparse ni ocupar una casilla inicial rival si bloquean.
- Un error estructural en cualquiera de los seis CSV impide cargar el balance y lo muestra como error, para evitar partidas mal configuradas.
- Ejecuta `npm test` después de editar tablas: incluye validación de todos los niveles y pruebas de cambios de datos.

Las bandas del jugador **se arrastran entre niveles**: sobreviven y evolucionan las piezas participantes, se retiran las perdidas y las reservas permanecen sin evolucionar. El presupuesto solo se gasta en piezas que participan.

Los parámetros de IA `weights.material`, `weights.captured`, `weights.mobility`, `weights.objective`, `weights.prisonerSafety` y `weights.rescuePotential` siguen teniendo valores por defecto en `AIController`; esta primera iteración CSV expone la profundidad, aleatoriedad y retardo por nivel.

## Rey protegido de misión

Solo el nivel de **escolta** (`tutorial-02`) añade automáticamente un Rey de misión. Su casilla inicial se edita en `balance/levels.csv` mediante las columnas `mission_king_x` y `mission_king_y` (coordenadas 0–7). Por defecto comienza en `2,7`. Debe estar en una fila de despliegue del jugador, 6 o 7, y no puede solaparse con obstáculos bloqueantes ni con la banda rival.

El Rey de misión es una pieza adicional al roster arrastrado; lo controla el jugador durante el combate, pero arranca colocado y bloqueado durante el despliegue. **Cuesta 0 puntos, no cuenta para las cuotas de las tres rondas, no se puede retirar ni cambiar de posición antes del combate, no evoluciona y no pasa al siguiente nivel.** Se distingue visualmente y en las tarjetas del cuaderno. La condición de victoria o derrota se evalúa sobre este rey específico, aunque el jugador tenga otro rey de campaña. Perderlo supone perder la escolta; llevarlo a la fila objetivo la gana. **Supervivencia no añade rey protegido ni termina al perder el rey ordinario de la banda.**

En los otros tres niveles de campaña, incluida supervivencia, las columnas de la posición del rey de misión permanecen vacías. La sección **Misión** del cuaderno describe automáticamente el objetivo según `victory`, `target_row` y `survive_rounds` del mismo CSV; los textos ES/EN viven en `locales/texts.csv`.

## Cierre progresivo del tablero

La columna `encroachment_start_action` de `balance/levels.csv` indica la primera **acción completa de combate** (jugador o rival) tras la cual se añade una casilla bloqueada permanentemente. La campaña usa `10` de inicio; los escenarios independientes no tienen fila en este CSV. Los bloqueos se añaden **después** de resolver los objetivos normales, nunca en despliegue ni al saltar un turno, y afectan a las líneas de movimiento, peones, saltos y rescates mediante el motor de reglas común.

Se elige una casilla libre que no tenga piezas activas ni prisioneros, sin obstáculos previos. La elección solo es válida si **ambos equipos** mantienen alguna acción legal al volverles a tocar, sus unidades conservan una región transitable compartida y, en escolta, el Rey de misión mantiene una ruta geométrica hasta la fila objetivo. La conectividad se evalúa en las ocho direcciones sin tratar como muros permanentes a otras piezas (pueden moverse); no garantiza que todas las jugadas futuras conserven la ruta.

La selección es pseudoaleatoria y reproducible mediante `encroachmentSeed`. Los obstáculos, `combatActionsCompleted` y la semilla se guardan en la sesión; se reinician con el nivel. Si no hay ninguna casilla válida, el jugador pierde, se muestra un aviso y el nivel se reinicia automáticamente. La IA simula el bloqueo inmediato al valorar una jugada y considera movilidad y espacio local; no explora todas las futuras selecciones de muros en minimax para evitar tiempos de cálculo excesivos.

## Aviso, animaciones y destrucción por cierre

El cierre se **anuncia con una acción completa de antelación**. Desde la acción `encroachment_start_action - 1` aparece una marca de aviso animada en una casilla inicialmente vacía. Tras la siguiente acción, del jugador o de la IA, se crea un obstáculo permanente, más pequeño y con animación de entrada. El aviso se sustituye por uno nuevo para el cierre siguiente. Las transiciones respetan `prefers-reduced-motion`.

**Cualquier pieza activa o prisionero que ocupe la casilla anunciada cuando se cierra es destruido**, sin capturarse ni entrar en los reclutamientos. Puede ser una pieza de cualquiera de los bandos, incluso un rey o el Rey de misión: se comprueba la victoria/derrota del escenario inmediatamente después del cierre. No se anuncian casillas ocupadas inicialmente, pero sí pueden ocuparse mientras dura el aviso. Las casillas elegidas deben conservar la conectividad y las acciones legales cuando no se haya producido ya una victoria. Si la casilla anunciada deja de ser válida para el cierre por cambios en el tablero, se vuelve a anunciar otra en lugar de crear una barrera imposible; si no queda ninguna, el jugador pierde y se reinicia el nivel.

`pendingClosure` se guarda junto con los obstáculos, las acciones y la semilla de la partida. La IA simula los cierres y las destrucciones inmediatas al evaluar sus acciones candidatas.

## Captura asimétrica del rey (nivel 3)

En `tutorial-03` y en el escenario de desarrollo `scenario-capture-king`, solo el **rey rival** es un objetivo especial. El jugador gana al capturarlo o destruirlo, aunque queden otras piezas enemigas. La IA rival gana al eliminar toda la banda del jugador, **no al capturar su rey**. Si el jugador pierde su propio rey, las piezas restantes siguen activas y pueden completar el objetivo. La IA puntúa especialmente la conservación de su rey, no la eliminación selectiva del rey jugador.

## Pruebas temporales de niveles y bandas configurables

El desplegable **Ajustes → Pruebas de campaña** abre los cuatro niveles de campaña reales en modo aislado (`?level=tutorial-02&lab=1`). Este modo usa `balance/player-presets.csv` en vez del roster guardado del jugador. No modifica ni borra el progreso o la sesión normal; al salir del modo de prueba se mantienen los datos normales.

El archivo `balance/player-presets.csv` tiene columnas `level_id,unit_id,piece_type,faction,facing,evolution_stage`, una fila por pieza. Los IDs de unidades deben ser únicos dentro de cada nivel, pero pueden mantenerse entre niveles para representar supervivientes. `special` como `piece_type` representa el alfil, torre o caballo especial de la facción elegida. `player` en `faction` usa la facción elegida; `green`, `red` y `yellow` fijan el origen de reclutas. `evolution_stage` acepta `base` o `evolved`.

El CSV incluido simula la banda original en nivel 1, cuatro piezas evolucionadas y un recluta en nivel 2, nuevas incorporaciones en nivel 3 y una banda de siete piezas en nivel 4. Los **límites de puntos siguen activos**: el usuario selecciona y despliega un subconjunto asequible del roster durante las oleadas normales. Tras cambiar el CSV, recarga el nivel de prueba.

Las misiones de escolta destacan todas las casillas transitables de la fila objetivo `target_row` (0-indexada) con una bandera. Los bloqueos físicos y cierres dinámicos dejan de aparecer como destinos; el marcador no modifica la victoria.

## Supervivencia asimétrica (nivel 4)

El jugador entra con un presupuesto máximo de **20 puntos** frente a **30 puntos** de piezas rivales. El objetivo es mantener **al menos una pieza activa, de cualquier tipo**, hasta completar `survive_rounds` rondas (valor inicial: **8**). La captura o destrucción del rey del jugador **no** provoca derrota ni deshabilita las piezas restantes; solo se pierde si no queda ninguna pieza activa. Eliminar toda la banda enemiga supone victoria anticipada, ya que desaparece la amenaza.

Una ronda se completa cuando la IA finaliza su acción (incluidos intercambios o ataques rechazados) o cuando salta un turno sin acciones legales. El contador «Rondas restantes» está visible durante el combate (oculto durante el despliegue), decrece hasta 0, se actualiza al cambiar de idioma y recupera su valor al continuar una sesión guardada. Los guardados antiguos del nivel 4 que contenían un `missionKing` gratuito se migran descartando esa pieza, sin modificar el resto de la banda.

## Agresividad de la IA en supervivencia

La última columna de `balance/levels.csv`, `ai_aggression` (valor entre 0 y 5), ajusta la presión ofensiva del modo supervivencia. Su valor inicial es **4** y los demás niveles lo mantienen en **0**. En supervivencia, la IA prioriza eliminar piezas individuales del jugador antes de la octava ronda, incluso si el intercambio le cuesta más material; también prefiere la destrucción irreversible frente a una captura recuperable, acorta distancias hacia las piezas restantes y busca crear amenazas concretas. La aleatoriedad está inicialmente en 0 para mantener la presión consistente. Eliminar toda la IA sigue dando al jugador una victoria inmediata, por lo que el perfil no se sacrifica cuando eso le causaría una derrota segura. Para ajustar la dificultad sin tocar JavaScript, edita `ai_aggression` y `ai_randomness` y recarga.

## Perfiles reutilizables de IA

Los cinco perfiles se editan en `balance/ai-profiles.csv`. La columna `ai_profile` de `balance/levels.csv` selecciona qué perfil se aplica en cada nivel; `ai_depth`, `ai_randomness`, `ai_think_delay_ms` y `ai_aggression` siguen siendo modificaciones independientes del nivel.

| Nivel | `ai_profile` inicial | Intención |
| --- | --- | --- |
| 1 · Destrucción | `balanced` | Material y movilidad equilibrados. |
| 2 · Escolta | `interceptor` | Presión hacia el rey/las rutas y prioridad del objetivo. |
| 3 · Captura | `defensive` | Conservar las piezas, en especial al rey protegido de la IA. |
| 4 · Supervivencia | `aggressive` | Perseguir, amenazar y eliminar la banda contraria, aceptando sacrificios. |

También existe `hunter`, orientado a perseguir piezas aisladas y generar capturas. Se puede asignar a cualquier nivel sin modificar JavaScript.

Las columnas `material`, `captured`, `mobility`, `space`, `objective`, `prisoner_safety` y `rescue_potential` controlan los pesos del minimax existente. `pursuit` penaliza la distancia hasta piezas enemigas; `threat` recompensa amenazas de captura; `king_safety` penaliza que el rey propio pueda ser capturado. En supervivencia también se aplican `survival_target` (prioridad por eliminar cada miembro de la banda), `own_force` (cuidado por conservar atacantes) y `destroy_bonus` (preferencia por destrucción definitiva). Esos tres últimos pesos, junto con `ai_aggression`, determinan la tolerancia al intercambio desfavorable.

Los valores son números finitos entre **0 y 2000**. El parser valida la cabecera, los perfiles repetidos, los números y las referencias inexistentes desde `levels.csv`. Si se edita un perfil, los niveles que lo utilizan lo heredan automáticamente al recargar la página. No se cambian las reglas de movimiento ni las condiciones de victoria; solo la puntuación de las jugadas.
