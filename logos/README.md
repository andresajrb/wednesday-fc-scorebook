# Miércoles de Fútbol — WFC · paquete de marca

Paleta: fondo #0a0a0a · acento #bef264 · lima 500 #84cc16 · texto #fafafa
Tipografía: Geist (texto en arco y wordmark).

## SVG
- wfc-emblem.svg — emblema completo (512×512). Anillo con "MIÉRCOLES DE FÚTBOL" arriba y
  "WEDNESDAY FC" abajo en arco. Uso grande: splash, remeras, banners. Requiere Geist instalada;
  para imprenta conviene convertir el texto a curvas.
- wfc-icon.svg — variante icono (512×512). Solo el monograma WFC + anillo con seis cortes de gajo.
  Es la base de todos los PNG. Legible desde 16 px.
- wfc-icon-dark.svg — igual, con fondo #0a0a0a sólido incluido.
- wfc-mono.svg — una tinta, color heredado (fill/stroke = currentColor).
- wfc-mono-dark.svg — una tinta #0a0a0a (para usar sobre lima o blanco).
- wfc-mono-lime.svg — una tinta #bef264 (para usar sobre negro).
- wfc-lockup.svg — lockup horizontal: emblema + wordmark "Miércoles / DE FÚTBOL" (920×260).
- favicon.svg — 32×32 nominales, solo la W dentro del anillo.

## PNG
- icon-192.png — PWA, fondo opaco #0a0a0a.
- icon-512.png — PWA, fondo opaco #0a0a0a.
- icon-512-maskable.png — arte al 62% del lienzo, contenido dentro del círculo seguro del 80% (Android).
- apple-touch-icon.png — 180×180, fondo opaco, sin esquinas redondeadas (iOS aplica su máscara).
- og-image.png — 1200×630, lockup sobre #0a0a0a. Generado renderizando el lockup en el navegador
  con Geist ya cargada; regenerarlo así si cambia el wordmark.

## Manifest sugerido
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

## Reglas
- No usar los colores de equipo (#3b82f6, #22c55e, #171717, #ef4444) en la marca.
- Por debajo de 32 px usar wfc-icon.svg; por debajo de 24 px, favicon.svg.
- No agregar sombras, degradados ni contornos extra.
