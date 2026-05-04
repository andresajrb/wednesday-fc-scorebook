import localforage from 'localforage';
import type { StateStorage } from 'zustand/middleware';

localforage.config({
  name: 'miercoles-futbol',
  storeName: 'app',
  description: 'Datos de Miércoles de Fútbol',
});

export const localforageStorage: StateStorage = {
  getItem: async (name) => (await localforage.getItem<string>(name)) ?? null,
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
