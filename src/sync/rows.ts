import type { AppState, ID, SyncTable } from '@/types/domain';
import { SYNC_TABLES } from '@/types/domain';
import { scopeState } from '@/store/scope';

/** Fila de `public.records` en el servidor. */
export interface RecordRow {
  table_name: SyncTable;
  id: ID;
  competition_id: ID;
  data: unknown;
  updated_at: string;
  deleted_at: string | null;
}

/** Versión (`updatedAt`) de cada registro que ya está en la nube. */
export type PushedVersions = Record<ID, string>;

/**
 * Lo que hay que subir de una competición: los registros y las lápidas cuya versión no es
 * la que ya se subió. Se compara por igualdad, no por fecha: la hora de un teléfono puede
 * estar adelantada o atrasada.
 */
export function pendingRows(
  state: AppState,
  competitionId: ID,
  pushed: PushedVersions
): RecordRow[] {
  const rows: RecordRow[] = [];
  const scoped = scopeState(state, competitionId);
  const competition = state.competitions[competitionId];
  const tables: Record<SyncTable, Record<ID, { id: ID; updatedAt: string }>> = {
    competitions: competition ? { [competitionId]: competition } : {},
    teams: scoped.teams,
    players: scoped.players,
    jornadas: scoped.jornadas,
    matches: scoped.matches,
    goals: scoped.goals,
  };
  for (const table of SYNC_TABLES) {
    for (const record of Object.values(tables[table])) {
      if (pushed[record.id] === record.updatedAt) continue;
      rows.push({
        table_name: table,
        id: record.id,
        competition_id: competitionId,
        data: record,
        updated_at: record.updatedAt,
        deleted_at: null,
      });
    }
  }
  for (const [id, tombstone] of Object.entries(state.tombstones)) {
    if (tombstone.competitionId !== competitionId || pushed[id] === tombstone.deletedAt) continue;
    rows.push({
      table_name: tombstone.table,
      id,
      competition_id: competitionId,
      data: null,
      updated_at: tombstone.deletedAt,
      deleted_at: tombstone.deletedAt,
    });
  }
  return rows;
}
