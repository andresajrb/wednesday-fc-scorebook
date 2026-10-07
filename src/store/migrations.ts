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
  5: (data) => {
    // v5: equipos variables por jornada. Nada de lo existente se descarta: todos los
    // equipos quedan como fijos y cada jornada vieja recibe los equipos que jugaron en
    // ella, en el orden en que entraron a la cancha.
    const d = data as {
      teams?: Record<string, unknown>;
      jornadas?: Record<string, unknown>;
      matches?: Record<string, unknown>;
      config?: Record<string, unknown>;
    } & Record<string, unknown>;
    const isObj = (x: unknown): x is Record<string, unknown> =>
      typeof x === 'object' && x !== null && !Array.isArray(x);

    const teams: Record<string, unknown> = {};
    for (const [id, t] of Object.entries(isObj(d.teams) ? d.teams : {})) {
      teams[id] = isObj(t)
        ? { ...t, kind: t.kind === 'guest' ? 'guest' : 'fixed', archived: t.archived === true }
        : t;
    }
    const allTeamIds = Object.entries(teams)
      .filter(([, t]) => isObj(t))
      .sort(([, a], [, b]) =>
        String((a as Record<string, unknown>).createdAt ?? '').localeCompare(
          String((b as Record<string, unknown>).createdAt ?? '')
        )
      )
      .map(([id]) => id);

    const matchesByJornada = new Map<string, Array<Record<string, unknown>>>();
    for (const m of Object.values(isObj(d.matches) ? d.matches : {})) {
      if (!isObj(m) || typeof m.jornadaId !== 'string') continue;
      const list = matchesByJornada.get(m.jornadaId) ?? [];
      list.push(m);
      matchesByJornada.set(m.jornadaId, list);
    }

    const jornadas: Record<string, unknown> = {};
    for (const [id, j] of Object.entries(isObj(d.jornadas) ? d.jornadas : {})) {
      if (!isObj(j)) {
        jornadas[id] = j;
        continue;
      }
      if (Array.isArray(j.teamIds)) {
        jornadas[id] = j;
        continue;
      }
      const ordered = (matchesByJornada.get(id) ?? []).sort(
        (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
      );
      const teamIds: string[] = [];
      for (const m of ordered) {
        for (const t of [m.teamAId, m.teamBId]) {
          if (typeof t === 'string' && teams[t] && !teamIds.includes(t)) teamIds.push(t);
        }
      }
      // Antes todos los equipos participaban de cada jornada: una abierta (o una sin
      // partidas) sigue contando con todos.
      if (j.status !== 'closed' || teamIds.length === 0) {
        for (const t of allTeamIds) if (!teamIds.includes(t)) teamIds.push(t);
      }
      jornadas[id] = { ...j, teamIds };
    }

    const config = isObj(d.config) ? d.config : {};
    return {
      ...d,
      teams,
      jornadas,
      config: {
        ...config,
        soundEnabled: config.soundEnabled !== false,
        vibrationEnabled: config.vibrationEnabled !== false,
        keepScreenOn: config.keepScreenOn !== false,
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
