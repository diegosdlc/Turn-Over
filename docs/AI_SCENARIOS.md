# Escenarios de victoria para la IA

Esta rama añade tres escenarios jugables para validar que la IA responde a condiciones de victoria distintas sin cambiar el motor Minimax.

## Escenarios

### Capturar al rey

- ID: `scenario-capture-king`
- URL: `?level=scenario-capture-king`
- Victoria: capturar o destruir el rey rival.
- La IA considera la supervivencia de ambos reyes como parte prioritaria de la evaluación.

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

Estos valores son provisionales y deben trasladarse al documento de balance cuando terminemos las primeras pruebas de comportamiento.

## Compatibilidad

Los niveles existentes que usan `rules.victory: 'elimination'` mantienen el comportamiento anterior.

Las tres nuevas condiciones son:

- `capture-king`
- `escort-king`
- `survive`

El contador `roundsElapsed` forma parte del estado en memoria. Por ahora los escenarios están planteados principalmente como niveles de validación; antes de incorporarlos a campaña conviene añadir explícitamente ese contador al snapshot de sesión para que una partida de supervivencia reanudada conserve exactamente el número de rondas.
