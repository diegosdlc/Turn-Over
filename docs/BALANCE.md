# Balance editable de Turn Over

Los números y la composición de los **cuatro niveles de campaña** están externalizados a CSV, siguiendo el mismo criterio que `locales/texts.csv`. Los CSV de `balance/` son la **única fuente de verdad de ejecución**; este documento es una guía, no un archivo de datos.

| Archivo | Qué se edita |
| --- | --- |
| `balance/pieces.csv` | Costes base y evolucionado de las seis piezas. |
| `balance/levels.csv` | Presupuesto y condición de victoria de cada nivel, duración de supervivencia, profundidad/aleatoriedad/retardo de la IA y enlace al siguiente nivel. Incluye una fila auxiliar para `deployment-budget-lab` (`kind=lab`). |
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
