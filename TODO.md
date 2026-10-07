# TODO — Roadmap de mejoras

Estrategia: primero mejoras que el grupo del miércoles (primer tester) vea y comente. El cambio de
nombre y dominio se hace junto con el primer feature de backend, usando la sincronización como
vehículo de migración.

Leyenda: `[ ]` pendiente · `[~]` en conversación · `[x]` hecho

---

## 1. Listo para hacer

### [x] Texto del resumen para WhatsApp (mejorar el existente)
- Hoy existe en `ResumenJornadaScreen.tsx` (`buildShareText`): equipo del día, tabla y top 3 goleadores en texto plano.
- Formato WhatsApp: `*negrita*`, `_cursiva_`, emoji por equipo (🔵🟢⚫🔴).
- Agregar marcadores de cada partida y curiosidades del día (hat-tricks, equipo que más se quedó en
  cancha, goleada).
- Dos versiones: **corta** (2–3 líneas, sirve de pie de foto de la imagen) y **completa**.
- Extraer los datos y curiosidades a un selector reutilizable: la imagen usa los mismos datos.
- Link a la app al final: solo cuando haya marca y dominio definitivos.

### [x] Imagen del resumen de jornada (compartible)
- Va después del texto: reutiliza sus datos y su versión corta como pie de foto.
- Generar un PNG desde el resumen (equipo del día, tabla, goleadores, total de partidas y goles).
- Formato vertical 1080×1350 (WhatsApp / Instagram), con colores de cada equipo.
- Un solo botón **Compartir** con una hoja de opciones: Imagen + texto (recomendado) · Solo imagen ·
  Solo texto · selector Corto/Completo.
- Web Share API (`navigator.share({ files, text })`); fallback: descargar la imagen.
- iOS puede descartar el texto cuando se comparten archivos: copiar el texto al portapapeles antes
  de abrir la hoja y avisar "Texto copiado, pégalo como pie de foto si no aparece".
- Mientras no haya marca definitiva, no difundir fuera del grupo.

### [x] Bocina / vibración al terminar el tiempo
- Sonido al llegar a 0 y aviso de "último minuto".
- Vibración donde exista (`navigator.vibrate`; iOS Safari no lo soporta).
- El audio debe "desbloquearse" con el toque de "Listo, empezar" (los navegadores bloquean audio sin gesto).
- Evaluar Wake Lock API para que la pantalla no se apague durante la partida.
- Toggle en Configuración (sonido sí/no, vibración sí/no).

### [x] Tabla en vivo durante la jornada (opcional)
- Desde la jornada activa, ver cómo va: tabla de equipos (PJ, G, E, P, GF, GC, pts) y goleadores del día.
- Opcional/colapsable para no ensuciar la pantalla principal de juego.
- Reutilizar `getStandings` y `getTopScorers` (hoy solo se ven en el resumen al cerrar).

### [x] Equipos variables por jornada (3 a 6 equipos)
Caso real: un equipo fijo no pudo ir y se invitó a otro equipo que no es fijo, solo de reemplazo.
- Hoy: los 4 equipos se crean en el onboarding (`DEFAULT_TEAMS`); no se pueden agregar ni quitar.
  `predictNextMatch` usa **todos** los equipos registrados como cola, así que si falta uno la predicción se rompe.
- **Regla de la app: una jornada se juega con 3 a 6 equipos.** Con 2 equipos no hay rotación (fuera de alcance).
- Permitir crear y archivar equipos (soft delete, sin borrar el historial). Sin tope de equipos registrados;
  el tope de 6 es por jornada.
- Tipo de equipo: **fijo** vs **invitado**. Ambos aparecen en la tabla de temporada.
- Al abrir la jornada: elegir **qué equipos asisten** (`Jornada.teamIds`, mínimo 3, máximo 6).
  La predicción y la cola usan solo esos.
- Un equipo que llega tarde se agrega con la jornada en curso y **entra al final de la cola**.
- Predicción/seguidilla: misma regla (el ganador se queda, el perdedor va al final de la cola) y mostrar
  la cola completa ("después juega X, luego Y"), no solo el próximo partido.
- Colores: hasta 6 equipos distinguibles por jornada (y el emoji correspondiente en el texto de WhatsApp).
- Migración de schema: las jornadas viejas sin `teamIds` = todos los equipos que jugaron alguna partida.

---

## 2. Requiere conversación antes de hacer

### [~] Tabla de temporada / período
Preguntas abiertas:
- ¿Período fijo (mensual, anual) o "temporada" con inicio y fin definidos por el usuario? ¿Ambos?
- ¿Qué se suma: puntos por partida (3/1/0), jornadas ganadas ("equipo del día"), o ambos?
- Jugadores: los stats siguen a la persona aunque cambie de equipo (`Player.teamId` cambia).
- ¿Cómo cuentan los goles de préstamo (`isLoaned`) y los goles sin asignar?
- ¿Qué pasa con jugadores inactivos (soft delete) en tablas históricas?

### [~] Tabla de sequía (después de definir goleadores)
- Depende de la definición de la tabla de goleadores/temporada.
- ¿Unidad: partidas jugadas o jornadas asistidas sin marcar? La presencia se puede inferir de `rosterA/rosterB`.
- ¿Se muestra siempre o solo en el resumen como dato de humor?
- Tono: humor sin humillar (¿opt-out por jugador?).

### [~] Gráficos simples
- Depende de la tabla de temporada.
- ¿Cuáles? Goles por jornada, evolución de puntos por equipo, goles por jugador en el tiempo.
- Librería: recharts (~100 KB) vs SVG propio liviano. Preferir liviano (PWA offline, datos móviles).

---

## 3. Backend — diseñar bien antes de escribir código

Objetivo: que quede bien y bajo nuestro control (datos, infraestructura y costos).

### [~] Sincronización entre dispositivos
Decisiones a tomar:
- **Proveedor / control**: Supabase (gestionado o self-hosted) vs. API propia (p. ej. Postgres + Hono/Node,
  o Cloudflare Workers + D1). Criterio: poder llevarse los datos y el código a otro hosting sin reescribir.
- **Identidad sin fricción**: código o link de grupo; magic link por email solo para el organizador.
  Roles: organizador (escribe), anotador invitado (escribe), espectador (lee).
- **Modelo de sync**: offline-first. Cola local de cambios y envío al recuperar conexión.
  Los goles son append-only (buen candidato a log de eventos); equipos/jugadores con last-write-wins por campo.
- **Conflictos**: dos teléfonos anotando la misma partida. ¿Se permite o se bloquea la partida a un solo anotador?
- **Seguridad**: Row Level Security o equivalente por grupo; rate limiting; nada de claves en el frontend.
- **Respaldos del servidor** y export JSON siempre disponible (los datos son del usuario).
- **Costos**: estimar con el free tier y con N grupos.

### [~] Página pública de solo lectura del grupo
- Link/QR: tabla, última jornada, goleadores. Sin instalar ni registrarse.
- Privacidad: ¿nombres reales públicos? ¿link no indexable (`noindex`) por defecto? Toggle para hacerlo privado.
- Preview para WhatsApp: `og:image` absoluto y dinámico con el resultado de la jornada.
- Depende de: sincronización.

### [~] Cambio de nombre y dominio (va con el primer feature de backend)
- [ ] Comprar el dominio ya, aunque no se use (evitar que lo tomen).
- Orden obligatorio:
  1. Lanzar la sincronización en el dominio actual de Vercel.
  2. Cada dispositivo sube sus datos a la nube.
  3. Activar el dominio nuevo; el usuario se identifica y sus datos bajan solos.
  4. El dominio viejo queda redirigiendo para siempre.
- La versión con sync debe avisar "Respalda tus datos en la nube" (`registerType: 'prompt'`: solo
  migra quien acepta la actualización).
- NO renombrar claves internas de storage (`miercoles-*`, base de localforage, BroadcastChannel).
- `appName` del backup: aceptar el valor viejo y el nuevo al importar.
- iOS no actualiza el nombre ni el ícono de una PWA instalada: hay que reinstalar.
- Candidatos de nombre: Caimanera, Pa' la Cancha, Pana FC (WFC queda como escudo del grupo fundador).
