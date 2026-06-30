# Abuela's Judgement — Prototipo jugable

Prototipo **web-native, zero-install** del juego ganador del torneo de ideas. Física real
(matter.js), drag-and-flick, olla-péndulo, apilado de Sazón y el **moneyshot viral** (grieta +
cámara frontal + veredicto spanglish + compartir). Anclado al Style Bible del debate multi-IA.

## Cómo se juega
- **Jala** un ingrediente desde la honda (abajo) y **suéltalo** hacia la **olla que se balancea**.
- Cada acierto **apila** y sube el **SAZÓN** (score). Combos suman extra.
- Tienes **3 chiles (vidas)**: cada tiro que cae fuera de la olla quita uno.
- Al **3.º fallo** → **moneyshot**: la pantalla se astilla, sale tu cara (cámara frontal) y el
  veredicto de la Abuela. Botones: **Compartir**, **Pedir perdón** (revive) o **reintentar**.
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
- Ingredientes = **íconos vectoriales dibujados** (no emoji) → render consistente en todo dispositivo.
- Servo de dificultad simple: la amplitud del balanceo crece con el score.
- **Placeholder honesto:** los sprites de gameplay son vectoriales limpios; el arte final
  (Abuela rótulo-punk, cartas de lotería) se sustituye con los assets de Nano Banana Pro
  (ver `design/PROMPTS-nano-banana-abuelas-judgement.md`). El fondo y el avatar ya son arte real.

## Deploy (URL pública para playtest)
GitHub Pages (https → cámara funciona):
```bash
git init && git add . && git commit -m "feat: prototipo jugable"
gh repo create abuela-judgement-proto --public --source=. --push
gh api -X POST repos/<owner>/abuela-judgement-proto/pages -f source[branch]=main -f source[path]=/
# URL: https://<owner>.github.io/abuela-judgement-proto/
```
Alternativa sin git: arrastra la carpeta `proto/` a https://app.netlify.com/drop (https instantáneo).
