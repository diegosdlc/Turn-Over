# Selector temporal de niveles de campaña

El desplegable **Ajustes → Pruebas de campaña** reutiliza el antiguo selector de laboratorios, pero **ya no carga laboratorios de mecánicas**. Enumera los cuatro niveles reales de campaña (`tutorial-01` a `tutorial-04`) usando sus fábricas habituales: reglas, IA, obstáculos, objetivos, oleadas y presupuesto no se duplican.

## Uso

- Abre un nivel desde **Ajustes → Pruebas de campaña** o mediante `?level=tutorial-02&lab=1`.
- El parámetro `lab=1` identifica el **modo de prueba temporal**. Sin él, `?level=tutorial-02` conserva el comportamiento normal y la banda arrastrada de campaña.
- `faction=green|red|yellow` permite cambiar la facción en la URL. El selector conserva la facción del nivel actual al saltar de escenario.
- La banda de prueba viene de `balance/player-presets.csv`: una pieza por fila; editar el CSV y recargar basta para actualizar la prueba.
- **Las piezas no se despliegan solas.** Se ofrecen como roster inicial de prueba y el usuario elige qué piezas coloca en las tres rondas, dentro del límite del nivel.
- En modo de prueba no se escribe el guardado de sesión ni se modifican el progreso de campaña y los desbloqueos. Reiniciar repite la misma banda predefinida. «Siguiente nivel» usa el roster predefinido de ese nivel, en vez de arrastrar los resultados de la partida de prueba.

## Contrato del CSV

`balance/player-presets.csv` contiene: `level_id,unit_id,piece_type,faction,facing,evolution_stage`.

- `level_id`: uno de los cuatro niveles de campaña.
- `unit_id`: identificador único **dentro de ese nivel**. Usar el mismo ID entre niveles simula continuidad; no mezcla partidas.
- `piece_type`: `king`, `queen`, `pawn`, `bishop`, `rook`, `knight`, o `special` (pieza especial de la facción seleccionada).
- `faction`: `player` para usar la facción elegida, o `green`, `red`, `yellow` para una pieza reclutada de esa procedencia.
- `facing`: `north` o `south`.
- `evolution_stage`: `base` o `evolved`.

La validación rechaza filas inválidas, IDs duplicados y niveles sin roster. Estas bandas son **datos de pruebas**; la campaña estándar continúa usando la banda que el usuario realmente consigue.

## Objetivos de escolta

En toda misión `escort-king` se marcan las casillas transitables de `rules.targetRow` con una bandera dorada. Se omiten las casillas bloqueadas por obstáculos o cierres. El objetivo visual se deriva de la misma fila que la condición de victoria; no define reglas nuevas. La señal respeta la preferencia de movimiento reducido.

Los archivos de los antiguos laboratorios de encarado, evolución, presupuesto y victoria ya no forman parte del registro. Las pruebas unitarias de las mecánicas y los escenarios de desarrollo `scenario-*` siguen disponibles por separado.
