import type { AppState, Goal, ID, Jornada, Match, Player, Team } from '@/types/domain';
import { DEFAULT_MATCH_DURATION_SECONDS, SCHEMA_VERSION } from '@/types/domain';

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

  const teams = records<Team>(source.teams, (t) => {
    const id = str(t.id);
    const name = str(t.name);
    const color = str(t.color);
    if (!id || !name || !color) return null;
    return { id, name, color, createdAt: str(t.createdAt) ?? new Date(0).toISOString() };
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
    };
  });

  const jornadas = records<Jornada>(source.jornadas, (j) => {
    const id = str(j.id);
    const date = str(j.date);
    if (!id || !date) return null;
    return {
      id,
      date,
      status: j.status === 'closed' ? 'closed' : 'open',
      notes: typeof j.notes === 'string' ? j.notes : undefined,
      createdAt: str(j.createdAt) ?? new Date(0).toISOString(),
      closedAt: str(j.closedAt) ?? undefined,
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
    if (!jornadas[jornadaId] || !teams[teamAId] || !teams[teamBId]) {
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
    };
  });

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
    };
  });

  const configSource = isObj(source.config) ? source.config : {};
  const state: AppState = {
    version: SCHEMA_VERSION,
    teams,
    players,
    jornadas,
    matches,
    goals,
    config: {
      onboardingDone: teamIds.length > 0 || configSource.onboardingDone === true,
      createdAt: str(configSource.createdAt) ?? new Date().toISOString(),
      autoAssignNextMatch: configSource.autoAssignNextMatch === true,
      matchDurationSeconds:
        typeof configSource.matchDurationSeconds === 'number'
          ? configSource.matchDurationSeconds
          : DEFAULT_MATCH_DURATION_SECONDS,
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
