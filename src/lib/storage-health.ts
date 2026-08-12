export interface StorageHealth {
  /** El navegador se comprometió a no desalojar los datos por presión de espacio. */
  persisted: boolean;
  supported: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

/**
 * Pide almacenamiento persistente. Sin esto, Chrome puede desalojar IndexedDB
 * cuando el dispositivo se queda sin espacio, y la app se abre una vez por
 * semana: es justo el perfil de uso que el navegador considera prescindible.
 *
 * Es idempotente y silencioso: si el navegador lo rechaza, la app sigue igual.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function readStorageHealth(): Promise<StorageHealth> {
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.storage?.persisted);
  if (!supported) {
    return { persisted: false, supported: false, usageBytes: null, quotaBytes: null };
  }
  try {
    const persisted = await navigator.storage.persisted();
    const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : null;
    return {
      persisted,
      supported: true,
      usageBytes: estimate?.usage ?? null,
      quotaBytes: estimate?.quota ?? null,
    };
  } catch {
    return { persisted: false, supported: true, usageBytes: null, quotaBytes: null };
  }
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
