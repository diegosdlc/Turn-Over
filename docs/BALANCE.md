# Balance de puntos

Este archivo es la **fuente de verdad editable** para el presupuesto de banda de Turn Over. El juego lee en tiempo de ejecución el bloque JSON delimitado por `balance-data:start` / `balance-data:end`; por tanto, los cambios de números no requieren tocar la lógica JavaScript.

Mantén el JSON válido. Los costes deben ser números positivos o cero y cada pieza debe definir `base` y `evolved`. Los límites de nivel son el máximo que el jugador puede desplegar. Si se añade un nivel sin entrada explícita, el juego usa automáticamente el valor calculado de la banda rival.

Los valores actuales son un punto de partida de balance. Las tres piezas especiales tienen el mismo coste base para que las bandas iniciales Verde, Roja y Amarilla valgan lo mismo en el nivel 1.

<!-- balance-data:start -->
```json
{
  "pieceCosts": {
    "pawn": { "base": 2, "evolved": 3 },
    "bishop": { "base": 4, "evolved": 6 },
    "knight": { "base": 4, "evolved": 6 },
    "rook": { "base": 4, "evolved": 6 },
    "queen": { "base": 7, "evolved": 9 },
    "king": { "base": 5, "evolved": 7 }
  },
  "levelPointLimits": {
    "tutorial-01": 18,
    "tutorial-02": 18,
    "deployment-budget-lab": 50
  }
}
```
<!-- balance-data:end -->

## Regla de equivalencia

El límite de cada nivel debe equivaler al valor en puntos de la banda rival. `levelPointLimit()` compara el límite configurado con el valor real de las unidades enemigas y muestra un aviso de consola si divergen. Esto permite detectar rápidamente que un cambio de coste necesita un ajuste de presupuesto.

Con los valores actuales, la banda rival del tutorial (Rey + Reina + Peón + Alfil, todos base) vale **18 puntos**, por eso los dos niveles actuales tienen límite 18.

Los laboratorios pueden usar un límite explícito distinto del valor de la banda rival cuando el objetivo sea probar una mecánica concreta. `deployment-budget-lab` usa **50 puntos** para permitir comparar libremente combinaciones de piezas base y evolucionadas.

## Evolución y coste

El coste se resuelve por `pieceType` y `evolutionStage`. Una pieza evolucionada usa siempre el valor `evolved`. Una pieza en reserva mantiene su estado y su coste para niveles posteriores, pero no consume presupuesto en el encuentro actual.

## Parámetros de evaluación de IA

La evaluación de la IA distingue entre material activo, material congelado y la posibilidad de recuperar piezas capturadas. Los pesos por defecto viven en `AIController` y pueden sobrescribirse por nivel mediante `level.ai.weights`.

- `material` (1.0): valor del material activo.
- `captured` (0.65): valor base de una pieza congelada antes de considerar su posición.
- `mobility` (2.0): diferencia de movimientos disponibles.
- `objective` (1.0): peso del objetivo específico del escenario.
- `prisonerSafety` (0.8): penaliza capturas en las que la pieza captora queda inmediatamente expuesta a una recaptura sobre la misma casilla. La penalización considera tanto el valor del prisionero como parte del valor de la pieza captora, porque esa recaptura suele devolver el material congelado al rival.
- `rescuePotential` (0.55): devuelve parte del valor de una pieza congelada si su propio bando ya puede alcanzar legalmente su casilla para rescatarla.

Estos dos últimos parámetros existen para evitar que la IA trate una captura reversible como una ganancia material equivalente a una pieza realmente neutralizada. Un valor alto de `prisonerSafety` produce una IA más conservadora con intercambios; un valor alto de `rescuePotential` hace que valore más la posibilidad de recuperar sus propias piezas y menos las capturas enemigas que todavía son fáciles de revertir.
