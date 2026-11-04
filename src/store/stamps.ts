import type { AppState, ID, SyncTable, Tombstone } from '@/types/domain';
import { SYNC_TABLES } from '@/types/domain';

type Stamped = { updatedAt: string };

/**
 * Marca los cambios entre dos estados: los registros nuevos o modificados reciben
 * `updatedAt` y los que desaparecieron dejan una lápida. Se hace en un solo lugar,
 * comparando por referencia, para que ninguna acción del store tenga que acordarse.
 */
export function stampChanges(prev: AppState, next: AppState, now: string): AppState {
  if (prev === next) return next;
  const out: AppState = { ...next };
  let tombstones: Record<ID, Tombstone> | null = null;
  let changed = false;

  for (const table of SYNC_TABLES) {
    const before = prev[table] as Record<ID, Stamped>;
    const after = next[table] as Record<ID, Stamped>;
    if (before === after) continue;

    let stamped: Record<ID, Stamped> | null = null;
    for (const [id, record] of Object.entries(after)) {
      if (before[id] === record) continue;
      stamped ??= { ...after };
      stamped[id] = { ...record, updatedAt: now };
      // Un registro que vuelve (p. ej. al deshacer) deja de estar borrado.
      if (next.tombstones[id]) {
        tombstones ??= { ...next.tombstones };
        delete tombstones[id];
      }
    }
    if (stamped) {
      (out as unknown as Record<SyncTable, unknown>)[table] = stamped;
      changed = true;
    }

    for (const id of Object.keys(before)) {
      if (after[id]) continue;
      tombstones ??= { ...next.tombstones };
      tombstones[id] = { table, competitionId: recordCompetition(prev, table, id), deletedAt: now };
    }
  }

  if (tombstones) {
    out.tombstones = tombstones;
    changed = true;
  }
  return changed ? out : next;
}

/** Competición de un registro, buscando por sus padres (en el estado de antes del borrado). */
export function recordCompetition(state: AppState, table: SyncTable, id: ID): ID | null {
  switch (table) {
    case 'competitions':
      return state.competitions[id] ? id : null;
    case 'teams':
      return state.teams[id]?.competitionId ?? null;
    case 'jornadas':
      return state.jornadas[id]?.competitionId ?? null;
    case 'players': {
      const teamId = state.players[id]?.teamId;
      return teamId ? recordCompetition(state, 'teams', teamId) : null;
    }
    case 'matches': {
      const jornadaId = state.matches[id]?.jornadaId;
      return jornadaId ? recordCompetition(state, 'jornadas', jornadaId) : null;
    }
    case 'goals': {
      const matchId = state.goals[id]?.matchId;
      return matchId ? recordCompetition(state, 'matches', matchId) : null;
    }
  }
}

/** Partidas tocadas entre dos estados: las que cambian y las de los goles que cambian. */
export function touchedMatches(prev: AppState, next: AppState): Set<ID> {
  const out = new Set<ID>();
  if (prev.matches !== next.matches) {
    for (const [id, m] of Object.entries(next.matches)) if (prev.matches[id] !== m) out.add(id);
    for (const id of Object.keys(prev.matches)) if (!next.matches[id]) out.add(id);
  }
  if (prev.goals !== next.goals) {
    for (const [id, g] of Object.entries(next.goals)) if (prev.goals[id] !== g) out.add(g.matchId);
    for (const [id, g] of Object.entries(prev.goals)) if (!next.goals[id]) out.add(g.matchId);
  }
  return out;
}

/** Competiciones cuyos registros cambian entre dos estados. */
export function touchedCompetitions(prev: AppState, next: AppState): Set<ID> {
  const out = new Set<ID>();
  for (const table of SYNC_TABLES) {
    const before = prev[table] as Record<ID, unknown>;
    const after = next[table] as Record<ID, unknown>;
    if (before === after) continue;
    for (const [id, record] of Object.entries(after)) {
      if (before[id] === record) continue;
      const cid = recordCompetition(next, table, id);
      if (cid) out.add(cid);
    }
    for (const id of Object.keys(before)) {
      if (after[id]) continue;
      const cid = recordCompetition(prev, table, id);
      if (cid) out.add(cid);
    }
  }
  return out;
}
