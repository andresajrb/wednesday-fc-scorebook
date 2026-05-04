import { SCHEMA_VERSION, type AppState } from '@/types/domain';

type MigrationFn = (data: unknown) => unknown;

const migrations: Record<number, MigrationFn> = {
  2: (data) => {
    const d = data as { config?: { autoAssignNextMatch?: boolean } } & Record<string, unknown>;
    return {
      ...d,
      config: {
        ...(d.config ?? {}),
        autoAssignNextMatch: d.config?.autoAssignNextMatch ?? false,
      },
    };
  },
};

export function migrate(data: unknown, fromVersion: number, toVersion: number): unknown {
  let current = data;
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    const fn = migrations[v];
    if (fn) current = fn(current);
  }
  return current;
}

export function isCurrentVersion(v: number): boolean {
  return v === SCHEMA_VERSION;
}

export function needsMigration(v: number): boolean {
  return v < SCHEMA_VERSION;
}

export function migrateAppState(data: AppState): AppState {
  if (data.version === SCHEMA_VERSION) return data;
  if (data.version > SCHEMA_VERSION) {
    throw new Error('La versión del respaldo es más nueva que la app. Actualiza la app.');
  }
  const migrated = migrate(data, data.version, SCHEMA_VERSION) as AppState;
  return { ...migrated, version: SCHEMA_VERSION };
}
