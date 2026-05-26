import localforage from 'localforage';
import type { StateStorage } from 'zustand/middleware';

localforage.config({
  name: 'miercoles-futbol',
  storeName: 'app',
  description: 'Datos de Miércoles de Fútbol',
});

export type HydrateError = { kind: 'json' | 'migration'; message: string };

let pendingHydrateError: HydrateError | null = null;
const listeners = new Set<(err: HydrateError) => void>();

export function consumeHydrationError(): HydrateError | null {
  const err = pendingHydrateError;
  pendingHydrateError = null;
  return err;
}

export function reportHydrationError(err: HydrateError): void {
  pendingHydrateError = err;
  for (const fn of listeners) fn(err);
}

export function subscribeHydrationError(fn: (err: HydrateError) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const localforageStorage: StateStorage = {
  getItem: async (name) => {
    const raw = (await localforage.getItem<string>(name)) ?? null;
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
    await localforage.setItem(name, value);
  },
  removeItem: async (name) => {
    await localforage.removeItem(name);
  },
};

export async function clearStorage(): Promise<void> {
  await localforage.clear();
}
