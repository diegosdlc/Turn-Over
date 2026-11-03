# Localización de Turn Over

La fuente de verdad de los textos es `locales/texts.csv`. Las columnas son `key,es,en,context` (UTF-8, comillas CSV estándar). El juego carga directamente este CSV una sola vez al iniciar, sin generar archivos JSON.

## Edición y nuevos idiomas

1. Edita el CSV con un editor de texto, Excel o Google Sheets. Conserva intacta cada `key` y los parámetros con llaves (`{name}`, `{points}`, etc.).
2. La interfaz usa `t('clave')`. Para parámetros usa `t('clave', { name: 'Ana' })`.
3. Para añadir otro idioma, incorpora una columna al CSV y amplía la lista `LANGUAGES`, el análisis de columnas de `src/i18n/index.js` y el selector en `index.html` y `src/level-ui.js`.
4. Los textos sin traducción a inglés vuelven al español. Si no existe la clave, se muestra la clave para detectar el error.
5. Ejecuta `npm test` para comprobar la consistencia del catálogo y las pruebas de reglas.

## Género del jugador

`setGender('masculine' | 'feminine' | 'neutral')` guarda la elección. Para frases que cambian según el género, define tres filas, como `player.greeting.masculine`, `player.greeting.feminine` y `player.greeting.neutral`, y usa `playerText('player.greeting')`. La variante neutra no requiere terminaciones no estándar.

El idioma y el género se guardan en `localStorage` de manera independiente del progreso y la sesión, y no afectan a las reglas de las partidas.

## UI

- HTML fijo: `data-i18n="clave"` y `data-i18n-aria="clave"`.
- HTML de cuaderno: claves `notebook.*`, cuyo contenido contiene HTML controlado por el proyecto.
- Texto dinámico del juego: llamada a `t()` en el momento del renderizado.
- Nombres de piezas: `pieceName()`, o `i18nNameKey` para piezas especiales de los laboratorios.
- La selección de idioma y género se puede cambiar desde Ajustes, el cuaderno o el inicio de una nueva partida (género).

**Nota visual:** las imágenes originales del menú incorporan rotulación española; en inglés se sustituyen visualmente por rótulos HTML traducidos. Para una solución gráfica definitiva, conviene generar los botones sin texto incrustado.
