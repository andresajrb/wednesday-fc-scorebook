import { DEFAULT_MATCH_DURATION_SECONDS, SCHEMA_VERSION, type AppState } from '@/types/domain';

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
  3: (data) => {
    const d = data as { config?: { matchDurationSeconds?: number } } & Record<string, unknown>;
    return {
      ...d,
      config: {
        ...(d.config ?? {}),
        matchDurationSeconds: d.config?.matchDurationSeconds ?? DEFAULT_MATCH_DURATION_SECONDS,
      },
    };
  },
  4: (data) => {
    // Para los matches que existen en v3, el reloj ya estaba corriendo desde startedAt
    // (no había botón "Listo, empezar"). Copiamos startedAt en clockStartedAt para que
    // sigan funcionando igual.
    const d = data as {
      matches?: Record<string, { startedAt?: string; clockStartedAt?: string }>;
    } & Record<string, unknown>;
    const matches = d.matches ?? {};
    const migratedMatches: Record<string, unknown> = {};
    for (const [id, m] of Object.entries(matches)) {
      migratedMatches[id] = {
        ...m,
        clockStartedAt: m.clockStartedAt ?? m.startedAt,
      };
    }
    return {
      ...d,
      matches: migratedMatches,
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
