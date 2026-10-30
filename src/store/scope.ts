import type { AppState, Competition, ID } from '@/types/domain';

const cache = new WeakMap<AppState, AppState>();

/**
 * Vista de una competición: el mismo `AppState`, pero con solo sus equipos, jugadores,
 * jornadas, partidas y goles. Es el único lugar donde se filtra por competición: las
 * pantallas y los selectores trabajan sobre esta vista y nunca ven datos de otra.
 */
export function scopeState(state: AppState, competitionId: ID | null): AppState {
  const teams: AppState['teams'] = {};
  for (const t of Object.values(state.teams)) {
    if (t.competitionId === competitionId) teams[t.id] = t;
  }
  const players: AppState['players'] = {};
  for (const p of Object.values(state.players)) {
    if (teams[p.teamId]) players[p.id] = p;
  }
  const jornadas: AppState['jornadas'] = {};
  for (const j of Object.values(state.jornadas)) {
    if (j.competitionId === competitionId) jornadas[j.id] = j;
  }
  const matches: AppState['matches'] = {};
  for (const m of Object.values(state.matches)) {
    if (jornadas[m.jornadaId]) matches[m.id] = m;
  }
  const goals: AppState['goals'] = {};
  for (const g of Object.values(state.goals)) {
    if (matches[g.matchId]) goals[g.id] = g;
  }
  return { ...state, teams, players, jornadas, matches, goals };
}

/** Vista de la competición activa, memorizada por estado para no recalcular en cada render. */
export function activeScope(state: AppState): AppState {
  const cached = cache.get(state);
  if (cached) return cached;
  const scoped = scopeState(state, state.activeCompetitionId);
  cache.set(state, scoped);
  return scoped;
}

export function getActiveCompetition(state: AppState): Competition | null {
  return state.activeCompetitionId ? (state.competitions[state.activeCompetitionId] ?? null) : null;
}

/** Competiciones visibles en el selector, por antigüedad. */
export function getVisibleCompetitions(state: AppState): Competition[] {
  return Object.values(state.competitions)
    .filter((c) => !c.archived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getArchivedCompetitions(state: AppState): Competition[] {
  return Object.values(state.competitions)
    .filter((c) => c.archived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Competición a la que pertenece un jugador (por su equipo). */
export function playerCompetition(state: AppState, playerId: ID): ID | null {
  const player = state.players[playerId];
  return player ? (state.teams[player.teamId]?.competitionId ?? null) : null;
}
