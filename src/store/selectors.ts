import type { AppState, Goal, ID, Jornada, Match, Player, Team } from '@/types/domain';

export interface MatchScore {
  goalsA: number;
  goalsB: number;
}

export function getMatchScore(state: AppState, matchId: ID): MatchScore {
  const m = state.matches[matchId];
  if (!m) return { goalsA: 0, goalsB: 0 };
  let goalsA = 0;
  let goalsB = 0;
  for (const g of Object.values(state.goals)) {
    if (g.matchId !== matchId) continue;
    if (g.scoringForTeamId === m.teamAId) goalsA++;
    else if (g.scoringForTeamId === m.teamBId) goalsB++;
  }
  return { goalsA, goalsB };
}

export function getGoalsByPlayerForMatch(
  state: AppState,
  matchId: ID
): Map<ID, number> {
  const map = new Map<ID, number>();
  for (const g of Object.values(state.goals)) {
    if (g.matchId !== matchId) continue;
    if (!g.playerId) continue;
    map.set(g.playerId, (map.get(g.playerId) ?? 0) + 1);
  }
  return map;
}

export function getUnassignedGoalsForMatch(
  state: AppState,
  matchId: ID
): Map<ID, number> {
  const map = new Map<ID, number>();
  for (const g of Object.values(state.goals)) {
    if (g.matchId !== matchId) continue;
    if (g.playerId) continue;
    map.set(g.scoringForTeamId, (map.get(g.scoringForTeamId) ?? 0) + 1);
  }
  return map;
}

export function getMatchGoalsOrdered(state: AppState, matchId: ID): Goal[] {
  return Object.values(state.goals)
    .filter((g) => g.matchId === matchId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Equipos registrados para jugar: fijos primero, después invitados, por antigüedad. */
export function getSortedTeams(
  state: AppState,
  opts: { includeArchived?: boolean } = {}
): Team[] {
  return Object.values(state.teams)
    .filter((t) => opts.includeArchived || !t.archived)
    .sort(
      (a, b) =>
        (a.kind === 'guest' ? 1 : 0) - (b.kind === 'guest' ? 1 : 0) ||
        a.createdAt.localeCompare(b.createdAt)
    );
}

/**
 * Equipos que participan de la jornada, en orden de llegada. Incluye también a los
 * que jugaron alguna partida aunque ya no figuren en la lista, para no dejar partidas
 * huérfanas en la tabla.
 */
export function getJornadaTeams(state: AppState, jornadaId: ID): Team[] {
  const jornada = state.jornadas[jornadaId];
  const ids = [...(jornada?.teamIds ?? [])];
  for (const m of getMatchesForJornada(state, jornadaId)) {
    for (const t of [m.teamAId, m.teamBId]) if (!ids.includes(t)) ids.push(t);
  }
  return ids.map((id) => state.teams[id]).filter((t): t is Team => !!t);
}

export function getMatchesForJornada(state: AppState, jornadaId: ID): Match[] {
  return Object.values(state.matches)
    .filter((m) => m.jornadaId === jornadaId)
    .sort((a, b) => a.order - b.order);
}

export interface TeamStandingRow {
  team: Team;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dif: number;
  pts: number;
}

export function emptyStandingRow(team: Team): TeamStandingRow {
  return { team, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dif: 0, pts: 0 };
}

/** Suma partidas terminadas a las filas de sus equipos (3/1/0). */
export function accumulateMatches(
  state: AppState,
  matches: Match[],
  rows: Map<ID, TeamStandingRow>
): void {
  for (const m of matches) {
    if (m.result === null || !m.endedAt) continue;
    const rA = rows.get(m.teamAId);
    const rB = rows.get(m.teamBId);
    if (!rA || !rB) continue;
    const { goalsA, goalsB } = getMatchScore(state, m.id);
    rA.pj++;
    rB.pj++;
    rA.gf += goalsA;
    rA.gc += goalsB;
    rB.gf += goalsB;
    rB.gc += goalsA;
    if (m.result === 'A') {
      rA.g++;
      rB.p++;
      rA.pts += 3;
    } else if (m.result === 'B') {
      rB.g++;
      rA.p++;
      rB.pts += 3;
    } else {
      rA.e++;
      rB.e++;
      rA.pts += 1;
      rB.pts += 1;
    }
  }
  for (const r of rows.values()) r.dif = r.gf - r.gc;
}

export function getStandings(state: AppState, jornadaId: ID): TeamStandingRow[] {
  const rows = new Map<ID, TeamStandingRow>();
  for (const team of getJornadaTeams(state, jornadaId)) rows.set(team.id, emptyStandingRow(team));
  accumulateMatches(state, getMatchesForJornada(state, jornadaId), rows);
  return [...rows.values()].sort(
    (a, b) =>
      b.pts - a.pts || b.dif - a.dif || b.gf - a.gf || a.team.name.localeCompare(b.team.name)
  );
}

export interface ScorerRow {
  player: Player;
  team: Team;
  goals: number;
}

export function getTopScorers(
  state: AppState,
  jornadaId: ID,
  limit = 3
): ScorerRow[] {
  const matches = getMatchesForJornada(state, jornadaId);
  const matchIds = new Set(matches.map((m) => m.id));
  const counts = new Map<ID, number>();
  for (const g of Object.values(state.goals)) {
    if (!matchIds.has(g.matchId)) continue;
    if (!g.playerId) continue;
    counts.set(g.playerId, (counts.get(g.playerId) ?? 0) + 1);
  }
  const rows: ScorerRow[] = [];
  for (const [playerId, goals] of counts) {
    const player = state.players[playerId];
    if (!player) continue;
    const team = state.teams[player.teamId];
    if (!team) continue;
    rows.push({ player, team, goals });
  }
  rows.sort((a, b) => b.goals - a.goals || a.player.name.localeCompare(b.player.name));
  return rows.slice(0, limit);
}

export function getJornadaWinnerTeam(state: AppState, jornadaId: ID): Team | null {
  const standings = getStandings(state, jornadaId);
  if (standings.length === 0 || standings[0].pj === 0) return null;
  return standings[0].team;
}

export function getActivePlayersByTeam(state: AppState, teamId: ID): Player[] {
  return Object.values(state.players)
    .filter((p) => p.teamId === teamId && p.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getInactivePlayersByTeam(state: AppState, teamId: ID): Player[] {
  return Object.values(state.players)
    .filter((p) => p.teamId === teamId && !p.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getOpenJornada(state: AppState): Jornada | null {
  return Object.values(state.jornadas).find((j) => j.status === 'open') ?? null;
}

export function getClosedJornadasDesc(state: AppState): Jornada[] {
  return Object.values(state.jornadas)
    .filter((j) => j.status === 'closed')
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
}

export const PREDICTION_WINDOW = 3;

/**
 * Cuántas partidas recientes mira la predicción. Con 4 equipos son 3 (las últimas 3
 * partidas alcanzan para ver a todos); con más equipos crece lo justo para que
 * todos puedan aparecer: N equipos necesitan N - 1 partidas.
 */
export function predictionWindowSize(teamCount: number): number {
  return Math.max(PREDICTION_WINDOW, teamCount - 1);
}

export interface JornadaQueue {
  /** Partida sin terminar, si la hay. */
  inProgress: Match | null;
  /** Ganador de la última partida terminada: se queda en cancha. */
  staying: ID[];
  /**
   * Equipos que no aparecen en la ventana: van antes que `queue`, pero su orden entre
   * ellos no se conoce.
   */
  unseen: ID[];
  /** Equipos que salieron dentro de la ventana, en el orden en que vuelven a entrar. */
  queue: ID[];
  /** Partidas terminadas de la jornada. */
  finishedCount: number;
}

/**
 * Cola de la jornada según la regla del juego, mirando solo las últimas partidas
 * (ventana deslizante): así un error viejo no contamina la predicción.
 *
 * - El que pierde sale al final de la cola; el ganador se queda.
 * - Empate: salen los dos; vuelve primero el que venía ganando (en la primera partida,
 *   el elegido en `drawWinnerNext`).
 * - Un equipo que llegó tarde se forma al final de la cola, detrás de los que ya esperaban.
 *
 * Cola lógica = `unseen` (no jugaron dentro de la ventana, adelante y sin orden conocido)
 * seguido de `queue` (salieron dentro de la ventana, en orden). Cada partida de la
 * ventana revela qué equipo de `unseen` entró.
 */
export function getJornadaQueue(state: AppState, jornadaId: ID): JornadaQueue {
  const jornada = state.jornadas[jornadaId];
  const all = getMatchesForJornada(state, jornadaId);
  const finished = all.filter((m) => m.endedAt && m.result !== null);
  const inProgress = all.find((m) => m.result === null) ?? null;
  const teamIds = (jornada?.teamIds ?? []).filter((t) => !!state.teams[t]);
  const lateJoins = jornada?.lateJoins ?? {};

  const window = finished.slice(-predictionWindowSize(teamIds.length));
  let unseen: ID[];
  let queue: ID[] = [];
  let staying: ID[] = [];

  if (window.length === 0) {
    unseen = [...teamIds];
  } else {
    const first = window[0];
    // Los que llegaron tarde después de empezar la ventana tienen lugar conocido: al final.
    const joinedInWindow = (t: ID) => lateJoins[t] !== undefined && lateJoins[t] >= first.order;
    const late = teamIds.filter(joinedInWindow).sort((a, b) => lateJoins[a] - lateJoins[b]);
    unseen = teamIds.filter((t) => !joinedInWindow(t));

    // Quién venía ganando antes de la ventana, para resolver un empate en su primera partida.
    const before = finished[finished.length - window.length - 1];
    if (before?.result === 'A') staying = [before.teamAId];
    else if (before?.result === 'B') staying = [before.teamBId];

    const take = (t: ID) => {
      unseen = unseen.filter((x) => x !== t);
      queue = queue.filter((x) => x !== t);
    };

    for (const m of window) {
      for (const t of [m.teamAId, m.teamBId]) if (!staying.includes(t)) take(t);
      if (m.result === 'A') {
        staying = [m.teamAId];
        queue.push(m.teamBId);
      } else if (m.result === 'B') {
        staying = [m.teamBId];
        queue.push(m.teamAId);
      } else {
        const defaultFirst = staying.includes(m.teamBId) ? m.teamBId : m.teamAId;
        const firstOut =
          m.drawWinnerNext === m.teamAId || m.drawWinnerNext === m.teamBId
            ? m.drawWinnerNext
            : defaultFirst;
        const secondOut = firstOut === m.teamAId ? m.teamBId : m.teamAId;
        staying = [];
        queue.push(firstOut, secondOut);
      }
      while (late.length > 0 && lateJoins[late[0]] <= m.order) {
        const t = late.shift()!;
        if (!queue.includes(t) && !staying.includes(t)) queue.push(t);
      }
    }
    for (const t of late) if (!queue.includes(t)) queue.push(t);
  }

  // Solo cuentan los equipos que siguen en la jornada.
  const inJornada = (t: ID) => teamIds.includes(t);
  unseen = unseen.filter(inJornada);
  queue = queue.filter(inJornada);
  staying = staying.filter(inJornada);

  if (inProgress) {
    const onCourt = [inProgress.teamAId, inProgress.teamBId];
    return {
      inProgress,
      staying: [],
      unseen: unseen.filter((t) => !onCourt.includes(t)),
      queue: queue.filter((t) => !onCourt.includes(t)),
      finishedCount: finished.length,
    };
  }
  return {
    inProgress: null,
    staying,
    unseen: unseen.filter((t) => !staying.includes(t)),
    queue: queue.filter((t) => !staying.includes(t)),
    finishedCount: finished.length,
  };
}

export interface NextMatchPrediction {
  teamAId: ID;
  teamBId: ID;
  reason: string;
}

/**
 * Próximo enfrentamiento según la cola: el ganador de la última partida contra el
 * siguiente, o los dos siguientes si no hay ganador (empate).
 *
 * Devuelve null si:
 * - No hay partidas terminadas: la primera se elige a mano.
 * - Hay una partida en curso.
 * - Hacen falta equipos de `unseen` y hay más de uno: no se sabe cuál sigue.
 */
export function predictNextMatch(state: AppState, jornadaId: ID): NextMatchPrediction | null {
  const { inProgress, staying, unseen, queue, finishedCount } = getJornadaQueue(state, jornadaId);
  if (inProgress || finishedCount === 0) return null;

  const pendingUnseen = [...unseen];
  const pendingQueue = [...queue];
  const challengers: ID[] = [];
  for (let k = 0; k < 2 - staying.length; k++) {
    if (pendingUnseen.length > 0) {
      if (pendingUnseen.length > 1) return null;
      challengers.push(pendingUnseen.shift()!);
    } else if (pendingQueue.length > 0) {
      challengers.push(pendingQueue.shift()!);
    } else {
      return null;
    }
  }
  const onCourt = [...staying, ...challengers];
  if (onCourt.length < 2) return null;

  let reason: string;
  if (staying.length === 0) {
    reason = 'Empate anterior. Entran los 2 primeros en cola.';
  } else {
    const winnerName = state.teams[staying[0]]?.name ?? 'Ganador';
    reason = `${winnerName} se queda. Entra el siguiente en cola.`;
  }
  return {
    teamAId: onCourt[0],
    teamBId: onCourt[1],
    reason,
  };
}
