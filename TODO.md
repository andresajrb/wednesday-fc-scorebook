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

### [x] Competiciones separadas (va antes de la tabla de temporada)
Caso: jugar los miércoles con un grupo y los sábados con otro. Hoy todo queda mezclado (un solo
conjunto de equipos, jugadores y jornadas). Meta: arrancar a usarlas desde el miércoles 4 de noviembre.

Decidido:
- Cada competición **totalmente separada**: equipos, jugadores, jornadas, partidas y goles propios.
- **Configuración general** (duración, predicción, avisos) compartida por todas. Si más adelante hace
  falta, pasar a configuración por competición (candidata: la duración de partida).
- Modelo de datos **opción A**: listas planas donde `teams` y `jornadas` llevan `competitionId`
  (jugadores, partidas y goles la heredan). Es la misma forma que tendrá en el servidor (columna
  `competition_id`), así la sincronización sube los registros tal cual.
- La competición con los datos actuales se llama **"Miércoles"** (editable).
- **Importar equipos desde otra competición entra en este lote**: copia el equipo con sus jugadores,
  sin historial.
- Aislamiento con **una sola capa de vista filtrada**: las pantallas nunca leen las listas completas,
  sino la vista de la competición activa (misma forma que los datos actuales), y las acciones del
  store validan que lo que tocan pertenezca a esa competición.

Cómo se ejecutaría:
- Migración v5→v6: los datos actuales pasan a la primera competición. Probarla igual que la v5 (datos
  reales en la versión vieja → actualizar con el aviso de la PWA → comparar byte a byte). También
  migrar respaldos viejos, snapshots automáticos y la reparación de datos dañados.
- Inicio: nombre de la competición activa con selector (cambiar / "+ Nueva competición").
  Una competición nueva pasa por el onboarding de equipos.
- Cada competición puede tener su jornada abierta; la bocina vigila la partida en curso de cualquiera.
- El atajo "Iniciar jornada" del ícono abre la competición activa.

- Competiciones: se pueden **archivar** (se esconden, los datos quedan) y **eliminar** (con mensaje
  de validación antes de borrar).
- Exportar/importar una sola competición: **queda para después** (cuando haga falta pasarla a otro
  teléfono; con el backend se reemplaza por un link).

### [x] Tabla de temporada / período
- Depende de: competiciones separadas (la temporada es por competición). ✅

Decidido:
- Dos tablas por competición: **mes** (quién ganó cada mes) y **temporada** (quién ganó el año).
- Temporada = **año calendario por defecto**; el inicio se puede cambiar en Configuración.
- Orden: **puntos acumulados** (3/1/0) → diferencia de gol → jornadas ganadas.
  Columna extra de **jornadas ganadas** ("equipo del día").
- Goleadores: los goles cuentan para el jugador aunque haya jugado **prestado**.
  Los goles sin asignar solo cuentan para el equipo.
- **Sin partidos jugados ni promedio** por jugador: la lista de la partida incluye a todos los
  activos del equipo, hayan ido o no, así que no es un dato confiable. Se puede revisar después.
- Jugadores inactivos **siguen apareciendo** con lo que hicieron.
- Invitados compiten **igual que los fijos** y **pueden salir campeones**.
- Pantalla **"Tabla"** desde el inicio, con pestañas **Mes** (eligiendo el mes, campeón destacado en los
  meses terminados) y **Año**, cada una con tabla de equipos y goleadores.

### [~] Tabla de sequía (después de definir goleadores)
- Depende de la definición de la tabla de goleadores/temporada.
- ¿Unidad: partidas jugadas o jornadas asistidas sin marcar? La presencia se puede inferir de `rosterA/rosterB`.
- ¿Se muestra siempre o solo en el resumen como dato de humor?
- Tono: humor sin humillar (¿opt-out por jugador?).

### [x] Gráficos simples
- En la pantalla **Tabla**, debajo de los goleadores; siguen la pestaña Mes / Año.
- **Carrera por el título**: puntos acumulados por equipo jornada a jornada (líneas, color de cada
  equipo, nombre al final de cada línea, leyenda y detalle al tocar).
- **Goles por jornada**: barras con el total de goles de cada jornada (detalle al tocar).
- Con menos de 2 jornadas en el período no se muestran.
- SVG propio, sin librerías (PWA offline, datos móviles).
- Pendiente si hace falta: goles por jugador en el tiempo (hoy quedaría casi vacío).

---

## 3. Backend — diseñar bien antes de escribir código

Objetivo: que quede bien y bajo nuestro control (datos, infraestructura y costos).

### [~] Sincronización entre dispositivos
Decidido:
- **Alcance inicial**: respaldo en la nube / cambio de teléfono + uno anota y los demás miran en vivo.
  **Próximamente**: varios anotadores, solo si el organizador lo habilita repartiendo links de invitación
  con rol de anotador a quienes él elija.
- **Proveedor: Supabase gestionado.** Es Postgres estándar (`pg_dump` para llevarse los datos);
  usa Auth, RLS y Realtime.
- **Identidad**: magic link por email solo para el organizador; el resto entra con link o código de grupo,
  sin registrarse.
- **Roles**: organizador (escribe y reparte links), anotador (escribe), espectador (lee).
- **Conflictos**: **un anotador por partida**, con botón "tomar control". Sin mezclar cambios.
- **Resolución**: last-write-wins **por registro** (`updatedAt`) + borrado lógico (`deletedAt`).
- **Offline-first obligatorio**: la app funciona igual sin señal; cola local de cambios que se envía al
  recuperar conexión.

Estado del código:
- A favor: listas planas por id con `competitionId` e IDs `crypto.randomUUID()` generados en el teléfono.
- Los goles **no** son append-only: se reasignan y se borran.

Fases:
0. ✅ Migración v6→v7: todo registro tiene `updatedAt` y los borrados dejan una lápida en
   `state.tombstones` (las listas solo tienen lo vigente; en el servidor será la columna `deleted_at`).
   Lo marca `stampChanges` en un solo lugar, para todas las acciones. Importar un respaldo y
   "Borrar todo" no generan lápidas.
1. ✅ (probado contra Supabase local) El organizador entra con link mágico y sube cada competición
   desde Configuración › Nube; aviso descartable en el inicio. Los cambios se suben solos (también
   al volver la señal). Esquema en `supabase/migrations/`: tabla `records` (una fila por registro,
   con el registro en `data`), `members`, LWW en el servidor y `create_group`. Qué falta subir se
   sabe por la versión exacta de cada registro (no por fecha: la hora del teléfono puede fallar).
   Falta para producción: proyecto real de Supabase, variables en Vercel, URLs de redirección,
   SMTP propio (el de Supabase manda muy pocos correos por hora) y el `pg_dump` nocturno.
2. ✅ Otro teléfono entra con el link y los datos bajan (probado en local y en producción).
   Dinámica de invitación (decidido):
   - Nadie más que el organizador usa email. El organizador lo da **una sola vez** (al subir su
     primera competición) para recuperar sus grupos en otro teléfono.
   - Los links se comparten por WhatsApp/Telegram con la hoja de compartir del teléfono
     (Configuración › Nube › **Compartir**), con un mensaje listo ("Únete a Miércoles…").
   - **Link de espectador**: reutilizable, se pega en el grupo de WhatsApp. Revocable.
   - **Link de admin (anotador)**: personal, de un solo uso, vence en 7 días; se manda por privado.
   - **Admin = anotador**: abre jornadas, anota goles y edita equipos. Invitar y sacar miembros
     es solo del organizador.
   - Quien abre el link entra con sesión anónima, sin registrarse, con el rol del link.
3. ✅ Realtime + un anotador por partida, con "Tomar control"; lo anotado sin señal por quien
   perdió el control se descarta con aviso (probado en local y en producción).
4. Dominio nuevo + página pública.

Seguridad, respaldos y costos (decidido):
- **Grupo en la nube = una competición**, con sus propios links y miembros (miércoles y sábados no se ven).
- **Entrar sin registrarse**: sesión anónima de Supabase; el link de invitación da el rol.
- **Links de invitación**: revocables, con vencimiento opcional, guardados como hash. El organizador
  ve los miembros y puede sacar a cualquiera.
- **RLS**: solo los miembros leen; solo organizador y anotador escriben. El "un anotador por partida"
  también lo valida el servidor.
- **Claves**: en el frontend solo la clave pública (anon); la `service_role` nunca sale del servidor.
- **Abuso**: límites nativos de Supabase para sesiones anónimas; CAPTCHA (Turnstile) solo si aparece abuso.
- **Respaldos**: `pg_dump` nocturno con GitHub Actions a un repo privado + la copia completa en cada
  teléfono + export JSON siempre disponible.
- **Costos**: free tier (500 MB, 50k MAU, 200 conexiones realtime). ~1 MB por grupo al año.
  El Pro (US$25/mes) exige tarjeta internacional (difícil desde Venezuela): aguantar en el free tier.
- **Pausa del free tier** (1 semana sin uso): el mismo job nocturno mantiene el proyecto activo.

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
