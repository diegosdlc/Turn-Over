# Escenarios de victoria para la IA

Esta rama añade tres escenarios jugables para validar que la IA responde a condiciones de victoria distintas sin cambiar el motor Minimax.

## Escenarios

### Capturar al rey

- ID: `scenario-capture-king`
- URL: `?level=scenario-capture-king`
- Victoria: capturar o destruir el rey rival.
- La IA protege su propio rey. Capturar o destruir el rey del jugador no provoca la victoria automática: debe eliminar la banda completa.
- El jugador conserva el control de sus otras piezas aunque pierda su rey.

### Cruzar con el rey

- ID: `scenario-escort-king`
- URL: `?level=scenario-escort-king`
- Victoria del jugador: llevar su rey a la fila 0.
- Victoria de la IA: capturar o destruir ese rey antes de que llegue.
- La IA recibe una puntuación creciente cuanto más lejos mantenga al rey jugador de la fila objetivo.
- Profundidad inicial: 3.

### Sobrevivir

- ID: `scenario-survive`
- URL: `?level=scenario-survive`
- Victoria del jugador: conservar al menos una pieza activa durante 8 rondas completas.
- Victoria de la IA: eliminar la banda del jugador antes de que termine la octava ronda.
- La banda rival tiene seis piezas frente a cuatro del jugador.
- Una ronda se contabiliza cuando la IA completa una acción, incluido un intercambio real o un ataque rechazado.

## Arquitectura

`src/core/victory.js` concentra la detección de estados terminales y la puntuación específica de objetivo que utiliza `AIController`.

El Minimax sigue usando material y movilidad, pero incorpora un término `objective`. Los niveles pueden ajustar `depth`, `randomness` y los pesos de evaluación mediante su objeto `ai`.

Parámetros utilizados actualmente:

- `depth`: profundidad de predicción.
- `randomness`: tolerancia para escoger alternativas cercanas a la mejor jugada.
- `weights.material`: importancia de conservar/capturar material.
- `weights.mobility`: importancia de disponer de movimientos.
- `weights.objective`: importancia de la condición de victoria específica.

La profundidad, aleatoriedad y retardo de la IA en los cuatro niveles de campaña se editan en `balance/levels.csv`. Los pesos de evaluación restantes siguen siendo parámetros del controlador de IA.

## Compatibilidad

Los niveles existentes que usan `rules.victory: 'elimination'` mantienen el comportamiento anterior.

Las tres nuevas condiciones son:

- `capture-king`
- `escort-king`
- `survive`

El contador `roundsElapsed` forma parte del estado en memoria y se guarda y restaura con el snapshot de sesión (esquema `7`, compatible con el esquema `6`). Una partida de supervivencia reanudada conserva así el número de rondas completadas. Los snapshots anteriores sin contador siguen siendo válidos y se restauran con `0` rondas: las rondas pasadas no pueden reconstruirse a partir del tablero.


## Rey de misión en la campaña

Solo `tutorial-02` (escolta) añade un rey especial, sin coste y ya desplegado. En `tutorial-04` (supervivencia) cualquier miembro activo de la banda cuenta para completar las 8 rondas; perder el rey ordinario no termina la partida. El jugador dispone de 20 puntos frente a 30 de la IA. La IA prioriza eliminar las piezas restantes en lugar de cazar un rey protegido. Los escenarios independientes conservan sus condiciones de victoria.

## Presión ofensiva en supervivencia

La IA del nivel `tutorial-04` emplea un perfil de **asalto**, distinto de la evaluación de material del resto de misiones. En vez de proteger su ventaja material, premia fuertemente reducir el **número de piezas activas del jugador**, incluso a cambio de perder piezas propias. Prefiere destruir piezas frente a capturarlas cuando la alternativa sea posible, ya que una pieza capturada puede ser rescatada. Cuando no hay un ataque inmediato, minimiza la distancia hasta las piezas supervivientes y recompensa amenazas de captura calculadas mediante las reglas reales de movimiento (incluidos muros dinámicos).

La intensidad se controla con `ai_aggression` (0 a 5) en `balance/levels.csv`, con **4** para supervivencia y **0** para el resto. `ai_randomness=0` elimina decisiones aleatorias entre ataques de valor diferente en el nivel 4. El perfil mantiene una valoración residual de las piezas rivales para evitar suicidios sin beneficio: la eliminación completa de la IA sigue siendo victoria del jugador. La búsqueda minimax y las condiciones de victoria del modo permanecen intactas.

## Perfiles tácticos desde CSV

Se ha externalizado la evaluación táctica a `balance/ai-profiles.csv` y cada nivel escoge uno mediante la columna `ai_profile` de `balance/levels.csv`. Los perfiles incluidos son `balanced`, `defensive`, `interceptor`, `hunter` y `aggressive`. No son algoritmos diferentes; comparten minimax y movimientos legales, y cambian los pesos de evaluación, persecución, amenazas, seguridad del rey, sacrificios y destrucción irreversible.

La configuración del nivel puede seguir modulando la profundidad, aleatoriedad, retardo e intensidad de agresividad. El nivel 4 conserva `ai_aggression=4`, `ai_randomness=0` y perfil `aggressive`; los demás mantienen `ai_aggression=0`. Estos valores iniciales se diseñaron para iterar durante las pruebas de juego y no constituyen una calibración final.
