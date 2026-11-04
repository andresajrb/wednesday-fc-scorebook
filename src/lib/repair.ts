import type {
  AppState,
  Competition,
  Goal,
  ID,
  Jornada,
  Match,
  Player,
  Team,
  Tombstone,
} from '@/types/domain';
import {
  DEFAULT_COMPETITION_NAME,
  DEFAULT_MATCH_DURATION_SECONDS,
  SCHEMA_VERSION,
  SYNC_TABLES,
} from '@/types/domain';
import { lastKnownChange } from '@/store/migrations';

export interface RepairReport {
  /** Cómo se logró parsear el blob crudo. */
  parsedWith: 'exact' | 'balanced' | 'truncated';
  teams: number;
  players: number;
  jornadas: number;
  matches: number;
  goals: number;
  /** Jugadores que apuntaban a un equipo inexistente y fueron readoptados. */
  reassignedPlayers: number;
  droppedPlayers: number;
  droppedMatches: number;
  droppedGoals: number;
}

export class RepairError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepairError';
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Cierra strings y llaves que quedaron abiertas. La corrupción típica de un blob
 * de IndexedDB es un truncado a la mitad de una escritura, no basura aleatoria.
 */
function closeOpenStructures(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  let out = text;
  if (inString) out += '"';
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === '{' ? '}' : ']';
  return out;
}

const MAX_TRUNCATION_ATTEMPTS = 300;

function parseLoose(raw: string): { value: unknown; how: RepairReport['parsedWith'] } {
  try {
    return { value: JSON.parse(raw), how: 'exact' };
  } catch {
    // seguimos
  }

  try {
    return { value: JSON.parse(closeOpenStructures(raw)), how: 'balanced' };
  } catch {
    // seguimos
  }

  // Cortamos en cada objeto cerrado, del final hacia atrás, y volvemos a balancear.
  let cursor = raw.lastIndexOf('}');
  let attempts = 0;
  while (cursor > 0 && attempts < MAX_TRUNCATION_ATTEMPTS) {
    const candidate = closeOpenStructures(raw.slice(0, cursor + 1));
    try {
      return { value: JSON.parse(candidate), how: 'truncated' };
    } catch {
      cursor = raw.lastIndexOf('}', cursor - 1);
      attempts += 1;
    }
  }

  throw new RepairError('No se pudo interpretar nada del archivo dañado.');
}

/** El blob persistido es `{ state: { state: AppState, ui }, version }`. */
function findAppStateLike(parsed: unknown): Record<string, unknown> {
  const candidates: unknown[] = [];
  if (isObj(parsed)) {
    candidates.push(parsed);
    const inner = parsed.state;
    if (isObj(inner)) {
      candidates.push(inner);
      if (isObj(inner.state)) candidates.push(inner.state);
    }
  }
  for (const candidate of candidates.reverse()) {
    if (isObj(candidate) && (isObj(candidate.teams) || isObj(candidate.players))) {
      return candidate;
    }
  }
  throw new RepairError('El archivo no contiene equipos ni jugadores reconocibles.');
}

function records<T>(value: unknown, keep: (entry: Record<string, unknown>) => T | null): Record<ID, T> {
  const out: Record<ID, T> = {};
  if (!isObj(value)) return out;
  for (const [id, entry] of Object.entries(value)) {
    if (!isObj(entry)) continue;
    const kept = keep(entry);
    if (kept !== null) out[id] = kept;
  }
  return out;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/**
 * Reconstruye el mejor `AppState` posible desde un blob dañado, descartando lo
 * que no se sostiene y readoptando a los jugadores huérfanos en vez de tirarlos:
 * un jugador con `teamId` muerto es precisamente el dato que se creía perdido.
 */
export function repairAppState(raw: string): { state: AppState; report: RepairReport } {
  const { value, how } = parseLoose(raw);
  const source = findAppStateLike(value);

  const competitions = records<Competition>(source.competitions, (c) => {
    const id = str(c.id);
    const name = str(c.name);
    if (!id || !name) return null;
    return {
      id,
      name,
      archived: c.archived === true,
      createdAt: str(c.createdAt) ?? new Date(0).toISOString(),
      updatedAt: str(c.updatedAt) ?? lastKnownChange(c),
    };
  });
  // Datos de antes de v6 (o sin competiciones legibles): todo va a "Miércoles".
  let fallbackCompetitionId: ID | null = null;
  const competitionFor = (value: unknown): ID => {
    const id = str(value);
    if (id && competitions[id]) return id;
    if (!fallbackCompetitionId) {
      fallbackCompetitionId =
        Object.values(competitions).find((c) => !c.archived)?.id ?? `c-${Date.now().toString(36)}`;
      if (!competitions[fallbackCompetitionId]) {
        const now = new Date().toISOString();
        competitions[fallbackCompetitionId] = {
          id: fallbackCompetitionId,
          name: DEFAULT_COMPETITION_NAME,
          archived: false,
          createdAt: now,
          updatedAt: now,
        };
      }
    }
    return fallbackCompetitionId;
  };

  const teams = records<Team>(source.teams, (t) => {
    const id = str(t.id);
    const name = str(t.name);
    const color = str(t.color);
    if (!id || !name || !color) return null;
    return {
      id,
      competitionId: competitionFor(t.competitionId),
      name,
      color,
      kind: t.kind === 'guest' ? 'guest' : 'fixed',
      archived: t.archived === true,
      createdAt: str(t.createdAt) ?? new Date(0).toISOString(),
      updatedAt: str(t.updatedAt) ?? lastKnownChange(t),
    };
  });

  const teamIds = Object.keys(teams);
  const fallbackTeamId = teamIds[0] ?? null;

  let reassignedPlayers = 0;
  let droppedPlayers = 0;
  const players = records<Player>(source.players, (p) => {
    const id = str(p.id);
    const name = str(p.name);
    if (!id || !name) {
      droppedPlayers += 1;
      return null;
    }
    let teamId = str(p.teamId);
    if (!teamId || !teams[teamId]) {
      if (!fallbackTeamId) {
        droppedPlayers += 1;
        return null;
      }
      teamId = fallbackTeamId;
      reassignedPlayers += 1;
    }
    return {
      id,
      name,
      teamId,
      active: p.active !== false,
      createdAt: str(p.createdAt) ?? new Date(0).toISOString(),
      updatedAt: str(p.updatedAt) ?? lastKnownChange(p),
    };
  });

  // Jornadas de antes de v5 (sin lista de equipos): en una abierta jugaban todos.
  const legacyOpenJornadas = new Set<ID>();
  const jornadas = records<Jornada>(source.jornadas, (j) => {
    const id = str(j.id);
    const date = str(j.date);
    if (!id || !date) return null;
    if (!Array.isArray(j.teamIds) && j.status !== 'closed') legacyOpenJornadas.add(id);
    const competitionId = competitionFor(j.competitionId);
    const teamIds = Array.isArray(j.teamIds)
      ? j.teamIds.filter(
          (t): t is string =>
            typeof t === 'string' && teams[t]?.competitionId === competitionId
        )
      : [];
    const lateJoins: Record<ID, number> = {};
    if (isObj(j.lateJoins)) {
      for (const [teamId, after] of Object.entries(j.lateJoins)) {
        if (teamIds.includes(teamId) && typeof after === 'number') lateJoins[teamId] = after;
      }
    }
    return {
      id,
      competitionId,
      date,
      status: j.status === 'closed' ? 'closed' : 'open',
      teamIds,
      ...(Object.keys(lateJoins).length > 0 ? { lateJoins } : {}),
      notes: typeof j.notes === 'string' ? j.notes : undefined,
      createdAt: str(j.createdAt) ?? new Date(0).toISOString(),
      closedAt: str(j.closedAt) ?? undefined,
      updatedAt: str(j.updatedAt) ?? lastKnownChange(j),
    };
  });

  let droppedMatches = 0;
  const matches = records<Match>(source.matches, (m) => {
    const id = str(m.id);
    const jornadaId = str(m.jornadaId);
    const teamAId = str(m.teamAId);
    const teamBId = str(m.teamBId);
    if (!id || !jornadaId || !teamAId || !teamBId) {
      droppedMatches += 1;
      return null;
    }
    const jornada = jornadas[jornadaId];
    if (
      !jornada ||
      teams[teamAId]?.competitionId !== jornada.competitionId ||
      teams[teamBId]?.competitionId !== jornada.competitionId
    ) {
      droppedMatches += 1;
      return null;
    }
    const roster = (value: unknown) =>
      Array.isArray(value)
        ? value.flatMap((e) => {
            if (!isObj(e)) return [];
            const playerId = str(e.playerId);
            if (!playerId || !players[playerId]) return [];
            const borrowedFromTeamId = str(e.borrowedFromTeamId);
            return [
              borrowedFromTeamId && teams[borrowedFromTeamId]
                ? { playerId, borrowedFromTeamId }
                : { playerId },
            ];
          })
        : [];
    const result = m.result;
    return {
      id,
      jornadaId,
      order: typeof m.order === 'number' ? m.order : 1,
      teamAId,
      teamBId,
      type: m.type === 'first' ? 'first' : 'normal',
      goalLimit: typeof m.goalLimit === 'number' ? m.goalLimit : 1,
      result: result === 'A' || result === 'B' || result === 'draw' ? result : null,
      drawWinnerNext: str(m.drawWinnerNext) ?? undefined,
      rosterA: roster(m.rosterA),
      rosterB: roster(m.rosterB),
      startedAt: str(m.startedAt) ?? new Date(0).toISOString(),
      clockStartedAt: str(m.clockStartedAt) ?? undefined,
      endedAt: str(m.endedAt) ?? undefined,
      updatedAt: str(m.updatedAt) ?? lastKnownChange(m),
    };
  });

  // Una jornada sin equipos legibles se reconstruye con los que jugaron sus partidas.
  for (const jornada of Object.values(jornadas)) {
    const played = Object.values(matches)
      .filter((m) => m.jornadaId === jornada.id)
      .sort((a, b) => a.order - b.order)
      .flatMap((m) => [m.teamAId, m.teamBId]);
    for (const t of played) if (!jornada.teamIds.includes(t)) jornada.teamIds.push(t);
    if (jornada.teamIds.length === 0 || legacyOpenJornadas.has(jornada.id)) {
      for (const t of teamIds) {
        const team = teams[t];
        if (team.competitionId !== jornada.competitionId || team.archived) continue;
        if (!jornada.teamIds.includes(t)) jornada.teamIds.push(t);
      }
    }
  }

  let droppedGoals = 0;
  const goals = records<Goal>(source.goals, (g) => {
    const id = str(g.id);
    const matchId = str(g.matchId);
    const scoringForTeamId = str(g.scoringForTeamId);
    if (!id || !matchId || !scoringForTeamId) {
      droppedGoals += 1;
      return null;
    }
    if (!matches[matchId] || !teams[scoringForTeamId]) {
      droppedGoals += 1;
      return null;
    }
    const playerId = str(g.playerId);
    return {
      id,
      matchId,
      // Un gol cuyo jugador no sobrevivió se conserva como gol de equipo.
      playerId: playerId && players[playerId] ? playerId : undefined,
      scoringForTeamId,
      isLoaned: g.isLoaned === true,
      createdAt: str(g.createdAt) ?? new Date(0).toISOString(),
      updatedAt: str(g.updatedAt) ?? lastKnownChange(g),
    };
  });

  // Las lápidas de lo que sobrevivió sobran: el registro sigue vivo.
  const tombstones = records<Tombstone>(source.tombstones, (t) => {
    const table = SYNC_TABLES.find((name) => name === t.table);
    const deletedAt = str(t.deletedAt);
    return table && deletedAt ? { table, deletedAt } : null;
  });
  for (const id of Object.keys(tombstones)) {
    const table = tombstones[id].table;
    if ({ competitions, teams, players, jornadas, matches, goals }[table][id]) delete tombstones[id];
  }

  const configSource = isObj(source.config) ? source.config : {};
  const sourceActive = str(source.activeCompetitionId);
  const activeCompetitionId =
    sourceActive && competitions[sourceActive] && !competitions[sourceActive].archived
      ? sourceActive
      : (Object.values(competitions).find((c) => !c.archived)?.id ?? null);
  const state: AppState = {
    version: SCHEMA_VERSION,
    competitions,
    activeCompetitionId,
    teams,
    players,
    jornadas,
    matches,
    goals,
    tombstones,
    config: {
      onboardingDone: teamIds.length > 0 || configSource.onboardingDone === true,
      createdAt: str(configSource.createdAt) ?? new Date().toISOString(),
      autoAssignNextMatch: configSource.autoAssignNextMatch === true,
      matchDurationSeconds:
        typeof configSource.matchDurationSeconds === 'number'
          ? configSource.matchDurationSeconds
          : DEFAULT_MATCH_DURATION_SECONDS,
      soundEnabled: configSource.soundEnabled !== false,
      vibrationEnabled: configSource.vibrationEnabled !== false,
      keepScreenOn: configSource.keepScreenOn !== false,
      ...(typeof configSource.seasonStartMonth === 'number' &&
      configSource.seasonStartMonth >= 1 &&
      configSource.seasonStartMonth <= 12
        ? { seasonStartMonth: configSource.seasonStartMonth }
        : {}),
    },
  };

  return {
    state,
    report: {
      parsedWith: how,
      teams: Object.keys(teams).length,
      players: Object.keys(players).length,
      jornadas: Object.keys(jornadas).length,
      matches: Object.keys(matches).length,
      goals: Object.keys(goals).length,
      reassignedPlayers,
      droppedPlayers,
      droppedMatches,
      droppedGoals,
    },
  };
}
