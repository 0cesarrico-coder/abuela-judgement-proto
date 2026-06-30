# Abuela's Judgement — Prototipo jugable

Prototipo **web-native, zero-install** del juego ganador del torneo de ideas. Física real
(matter.js), drag-and-flick, olla-péndulo, apilado de Sazón y el **moneyshot viral** (grieta +
cámara frontal + veredicto spanglish + compartir). Anclado al Style Bible del debate multi-IA.

## Cómo se juega
- **Jala** un ingrediente desde la honda (abajo) y **suéltalo** hacia la **olla que se balancea**.
- Cada acierto **apila** y sube el **SAZÓN** (score). Combos suman extra.
- Tienes **3 chiles (vidas)**: cada tiro que cae fuera de la olla quita uno.
- Al **3.º fallo** → **moneyshot**: la pantalla se astilla, irrumpe la Abuela furiosa y suelta su
  veredicto. Botones: **Compartir**, **Pedir perdón** (revive) o **reintentar**.
- **Cámara = opt-in estricto:** el juego **nunca pide la cámara ni toma fotos por sí solo**. La
  cara frontal solo aparece si el jugador toca el botón opcional "📸 que Abuela te vea".
- Sin cronómetro: ritmo zen, sesiones de ~45s.

## Correr localmente
La cámara del moneyshot necesita **contexto seguro** (https o localhost). NO uses `file://`.
```bash
cd design/proto
python3 -m http.server 8770
# abre http://localhost:8770/  (en móvil: misma red, http://TU_IP:8770/)
```
Para probar en celular con cámara fuera de localhost necesitas **https** (ver Deploy).

## Controles
- Móvil: touch (jala y suelta). Escritorio: mouse. Tecla **R** = reiniciar.

## Estructura
```
proto/
├── index.html        # arranque + pantalla "toca para jugar"
├── game.js           # juego completo (física, render, HUD, moneyshot, audio)
├── matter.min.js     # motor de física (local, sin CDN)
└── assets/
    ├── kitchen-bg.png   # fondo (Nano Banana Pro)
    └── abuela.png       # avatar (Nano Banana Pro)
```

## Notas técnicas / estado
- **Verificado** en navegador: flick→física, scoring/Sazón, conteo de vidas, moneyshot con
  cámara + fallback "sin cámara", compartir (Web Share API → fallback descarga PNG), audio WebAudio.
- **Ingredientes = cartas de lotería vector** (borde de peltre, panel crema con keyline rojo,
  número de lotería, flores marigold, banner, grano serigráfico) — render in-engine sin peso de
  texturas, escala sin pérdida (Style Bible §6: el juego es vector folk-art para gama baja + carga <1.8s).
- **Arte raster real (Nano Banana Pro) cableado:** fondo de cocina, avatar de la Abuela (zen) y
  **Abuela furia** (lentes cat-eye agrietados + pánico) en el moneyshot (beat #2 del Style Bible).
- **Game-feel:** squash al lanzar, hitstop al atrapar, anillos + partículas, contador de COMBO,
  flash dorado en Sazón Legendario, vapor zen subiendo de la olla.
- **Listo para escala/test viral:** OG/Twitter share cards, manifest PWA + íconos (instalable
  "Añadir a inicio"), botón de mute persistente, **pausa al ocultar la pestaña** (batería), sello
  viral en la imagen compartida (título + sazón + CTA), capa de **analítica ligera** (contadores
  locales sin PII; configurable con `window.AJ_ANALYTICS_URL` para recolectar eventos agregados).
- Servo de dificultad simple: la amplitud del balanceo crece con el score.

## Deploy (URL pública para playtest)
GitHub Pages (https → cámara funciona):
```bash
git init && git add . && git commit -m "feat: prototipo jugable"
gh repo create abuela-judgement-proto --public --source=. --push
gh api -X POST repos/<owner>/abuela-judgement-proto/pages -f source[branch]=main -f source[path]=/
# URL: https://<owner>.github.io/abuela-judgement-proto/
```
Alternativa sin git: arrastra la carpeta `proto/` a https://app.netlify.com/drop (https instantáneo).
