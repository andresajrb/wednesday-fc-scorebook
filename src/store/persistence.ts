import localforage from 'localforage';
import type { StateStorage } from 'zustand/middleware';

localforage.config({
  name: 'miercoles-futbol',
  storeName: 'app',
  description: 'Datos de Miércoles de Fútbol',
});

export type HydrateError = { kind: 'json' | 'migration' | 'empty'; message: string };
export type WriteError = { message: string };

/**
 * Espejo síncrono en localStorage. IndexedDB es asíncrono y una escritura
 * disparada en `pagehide` no tiene garantía de completarse; localStorage sí es
 * síncrono, así que sobrevive a que el sistema mate la pestaña. Solo se usa para
 * rescatar el caso "la escritura a IndexedDB nunca llegó".
 */
const MIRROR_PREFIX = 'miercoles-mirror:';
const WRITE_DEBOUNCE_MS = 400;

let pendingHydrateError: HydrateError | null = null;
let hydrationFailedFlag = false;
const hydrateListeners = new Set<(err: HydrateError) => void>();
const writeListeners = new Set<(err: WriteError) => void>();

export function consumeHydrationError(): HydrateError | null {
  const err = pendingHydrateError;
  pendingHydrateError = null;
  return err;
}

export function reportHydrationError(err: HydrateError): void {
  pendingHydrateError = err;
  hydrationFailedFlag = true;
  for (const fn of hydrateListeners) fn(err);
}

/**
 * A diferencia de `consumeHydrationError`, esto no se limpia al leerlo.
 * Cuando el JSON está corrupto devolvemos `null` desde `getItem` para que la
 * hidratación termine y la app pueda mostrar la pantalla de recuperación; sin
 * esta marca, esa hidratación se vería como exitosa y abriría el candado de
 * escritura justo encima de los bytes que queremos rescatar.
 */
export function hydrationFailed(): boolean {
  return hydrationFailedFlag;
}

export function clearHydrationFailure(): void {
  hydrationFailedFlag = false;
  pendingHydrateError = null;
  lastReadRaw = null;
}

export function subscribeHydrationError(fn: (err: HydrateError) => void): () => void {
  hydrateListeners.add(fn);
  return () => {
    hydrateListeners.delete(fn);
  };
}

export function reportWriteError(err: WriteError): void {
  for (const fn of writeListeners) fn(err);
}

export function subscribeWriteError(fn: (err: WriteError) => void): () => void {
  writeListeners.add(fn);
  return () => {
    writeListeners.delete(fn);
  };
}

/**
 * Candado de escritura. Arranca CERRADO y solo se abre cuando la hidratación
 * terminó bien.
 *
 * Zustand persiste el blob completo en cada `set()`, incluso antes de que
 * IndexedDB haya respondido. Sin este candado, cualquier mutación temprana
 * (o el propio `setState` que reporta el error de hidratación) escribe el estado
 * inicial vacío encima de los datos buenos, y la hidratación posterior arregla
 * la memoria pero ya no el disco.
 */
let writesEnabled = false;
/**
 * Los últimos bytes leídos del disco, se hayan podido parsear o no. Sirven para
 * dos casos distintos de rescate: el blob ilegible (JSON roto) y el legible pero
 * no migrable (viene de una versión más nueva de la app).
 */
let lastReadRaw: string | null = null;

export function unlockWrites(): void {
  writesEnabled = true;
}

export function lockWrites(): void {
  writesEnabled = false;
}

export function writesAreLocked(): boolean {
  return !writesEnabled;
}

/** El blob crudo tal como estaba en disco en la última lectura. */
export function getLastReadRaw(): string | null {
  return lastReadRaw;
}

function mirrorWrite(name: string, value: string): void {
  try {
    localStorage.setItem(MIRROR_PREFIX + name, value);
  } catch {
    // Best-effort: si no entra (cuota, modo privado), el dato igual va a IndexedDB.
  }
}

function mirrorRead(name: string): string | null {
  try {
    return localStorage.getItem(MIRROR_PREFIX + name);
  } catch {
    return null;
  }
}

function mirrorClear(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(MIRROR_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // idem
  }
}

/**
 * Retraso artificial de la hidratación, solo en dev y solo vía `?slowHydrate=<ms>`.
 * Hace observable y determinista la carrera de hidratación al probar con Playwright:
 * sin esto, el navegador resuelve IndexedDB tan rápido que la ventana de riesgo
 * depende de la suerte del timing.
 */
function hydrationDelayMs(): number {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 0;
  try {
    const raw = new URLSearchParams(window.location.search).get('slowHydrate');
    if (raw === null) return 0;
    const ms = Number(raw);
    return Number.isFinite(ms) && ms > 0 ? Math.min(ms, 10_000) : 0;
  } catch {
    return 0;
  }
}

/**
 * Aviso entre pestañas. Sin esto, dos pestañas abiertas divergen y gana la
 * última en guardar.
 */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('miercoles-futbol') : null;

/** Verdadero mientras aplicamos un cambio que vino de otra pestaña. */
let applyingRemoteChange = false;

export function setApplyingRemoteChange(value: boolean): void {
  applyingRemoteChange = value;
}

export function isApplyingRemoteChange(): boolean {
  return applyingRemoteChange;
}

export function subscribeRemoteChange(fn: () => void): () => void {
  if (!channel) return () => {};
  const handler = (event: MessageEvent) => {
    if (event.data === 'state-changed') fn();
  };
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}

type PendingWrite = { name: string; value: string; silent: boolean };

let pendingWrite: PendingWrite | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function announce(job: PendingWrite): void {
  // Reemitir un cambio que acabamos de recibir haría ping-pong infinito entre pestañas.
  if (job.silent || !channel) return;
  try {
    channel.postMessage('state-changed');
  } catch {
    // El aviso es best-effort.
  }
}

function takePendingWrite(): PendingWrite | null {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const job = pendingWrite;
  pendingWrite = null;
  return job;
}

async function commitPendingWrite(): Promise<void> {
  const job = takePendingWrite();
  if (!job) return;
  mirrorWrite(job.name, job.value);
  try {
    await localforage.setItem(job.name, job.value);
    announce(job);
  } catch (err) {
    reportWriteError({ message: String(err) });
  }
}

/**
 * Vacía la escritura pendiente sin esperar el debounce. El espejo se escribe de
 * forma síncrona para que el dato sobreviva aunque el navegador no llegue a
 * completar la transacción de IndexedDB.
 */
export function flushWrites(): void {
  const job = takePendingWrite();
  if (!job) return;
  mirrorWrite(job.name, job.value);
  void localforage
    .setItem(job.name, job.value)
    .then(() => announce(job))
    .catch((err: unknown) => {
      reportWriteError({ message: String(err) });
    });
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushWrites);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushWrites();
  });
}

export const localforageStorage: StateStorage = {
  getItem: async (name) => {
    const delay = hydrationDelayMs();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    let raw = (await localforage.getItem<string>(name)) ?? null;

    if (raw === null) {
      // IndexedDB vacío pero con espejo: la última escritura nunca llegó a disco.
      const mirrored = mirrorRead(name);
      if (mirrored !== null) raw = mirrored;
    }

    // Preservamos los bytes originales pase lo que pase: son lo único recuperable
    // y el candado de escritura garantiza que nadie los pise mientras dure la sesión.
    lastReadRaw = raw;

    if (raw !== null) {
      try {
        JSON.parse(raw);
      } catch (err) {
        reportHydrationError({ kind: 'json', message: String(err) });
        return null;
      }
    }
    return raw;
  },

  setItem: async (name, value) => {
    if (!writesEnabled) return;
    pendingWrite = { name, value, silent: applyingRemoteChange };
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void commitPendingWrite();
    }, WRITE_DEBOUNCE_MS);
  },

  removeItem: async (name) => {
    if (!writesEnabled) return;
    takePendingWrite();
    try {
      await localforage.removeItem(name);
      localStorage.removeItem(MIRROR_PREFIX + name);
    } catch (err) {
      reportWriteError({ message: String(err) });
    }
  },
};

export async function clearStorage(): Promise<void> {
  takePendingWrite();
  mirrorClear();
  await localforage.clear();
}

/** Acceso directo, fuera del candado y del debounce (snapshots de respaldo). */
export const rawStorage = {
  get: <T>(key: string): Promise<T | null> => localforage.getItem<T>(key),
  set: <T>(key: string, value: T): Promise<T> => localforage.setItem<T>(key, value),
  remove: (key: string): Promise<void> => localforage.removeItem(key),
  keys: (): Promise<string[]> => localforage.keys(),
};
