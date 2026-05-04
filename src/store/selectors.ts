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

export function getStandings(state: AppState, jornadaId: ID): TeamStandingRow[] {
  const matches = getMatchesForJornada(state, jornadaId).filter(
    (m) => m.result !== null && m.endedAt
  );
  const rows = new Map<ID, TeamStandingRow>();
  for (const team of Object.values(state.teams)) {
    rows.set(team.id, {
      team,
      pj: 0,
      g: 0,
      e: 0,
      p: 0,
      gf: 0,
      gc: 0,
      dif: 0,
      pts: 0,
    });
  }
  for (const m of matches) {
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
    } else if (m.result === 'draw') {
      rA.e++;
      rB.e++;
      rA.pts += 1;
      rB.pts += 1;
    }
  }
  for (const r of rows.values()) {
    r.dif = r.gf - r.gc;
  }
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

export interface NextMatchPrediction {
  teamAId: ID;
  teamBId: ID;
  reason: string;
  certain: boolean;
}

/**
 * Predice cuál es el siguiente enfrentamiento siguiendo las reglas del juego:
 * - El que pierde sale al final de la cola; el ganador se queda y entra el siguiente.
 * - Empate: ambos salen al final de la cola (con `drawWinnerNext` definiendo cuál
 *   entrará antes), y entran los 2 primeros de la cola previa.
 *
 * Modelo de cola lógica = `unseen` (equipos que aún no han jugado, frente)
 * concatenado con `queue` (equipos que ya jugaron y volvieron a esperar, fondo).
 *
 * Durante la simulación de matches pasados, mira el match siguiente para
 * descubrir cuál equipo de `unseen` entró (revelando su orden).
 *
 * Devuelve null si:
 * - No hay partidas terminadas (no hay info).
 * - Quedan ≥2 equipos sin jugar todavía y se necesitan para llenar el próximo match.
 */
export function predictNextMatch(
  state: AppState,
  jornadaId: ID
): NextMatchPrediction | null {
  const matches = getMatchesForJornada(state, jornadaId)
    .filter((m) => m.endedAt && m.result !== null)
    .sort((a, b) => a.order - b.order);
  if (matches.length === 0) return null;

  const allTeamIds = Object.values(state.teams).map((t) => t.id);
  const initialOnCourt = [matches[0].teamAId, matches[0].teamBId];
  let onCourt: ID[] = [...initialOnCourt];
  let queue: ID[] = [];
  let unseen: ID[] = allTeamIds.filter((t) => !initialOnCourt.includes(t));

  const removeFromCola = (teamId: ID): void => {
    const ui = unseen.indexOf(teamId);
    if (ui >= 0) {
      unseen.splice(ui, 1);
      return;
    }
    const qi = queue.indexOf(teamId);
    if (qi >= 0) queue.splice(qi, 1);
  };

  const computeOutgoing = (m: Match): ID[] => {
    if (m.result === 'A') return [m.teamBId];
    if (m.result === 'B') return [m.teamAId];
    if (m.result === 'draw') {
      const firstOut = m.drawWinnerNext ?? m.teamAId;
      const secondOut = firstOut === m.teamAId ? m.teamBId : m.teamAId;
      return [firstOut, secondOut];
    }
    return [];
  };

  const computeStaying = (m: Match): ID[] => {
    if (m.result === 'A') return [m.teamAId];
    if (m.result === 'B') return [m.teamBId];
    return [];
  };

  for (let i = 0; i < matches.length - 1; i++) {
    const m = matches[i];
    const next = matches[i + 1];
    const staying = computeStaying(m);
    const outgoing = computeOutgoing(m);
    // Determinar quiénes entran en el próximo match: los del next que no estaban quedándose.
    const incoming = [next.teamAId, next.teamBId].filter((t) => !staying.includes(t));
    // Actualizar cola: removemos los `incoming` de unseen/queue (revelando su orden), y
    // añadimos `outgoing` al final.
    for (const t of incoming) removeFromCola(t);
    queue = queue.concat(outgoing);
    onCourt = [...staying, ...incoming];
  }

  // Procesar el ÚLTIMO match: solo aplicamos el "outgoing" después de calcular los
  // próximos retadores, para no contaminar la cola con equipos que acaban de salir.
  const last = matches[matches.length - 1];
  const lastStaying = computeStaying(last);
  const lastOutgoing = computeOutgoing(last);

  // Próximo match: lo que queda en cancha = lastStaying. Faltan retadores.
  const challengers: ID[] = [];
  const need = 2 - lastStaying.length;
  for (let k = 0; k < need; k++) {
    if (unseen.length > 0) {
      if (unseen.length > 1) return null;
      challengers.push(unseen.shift()!);
    } else if (queue.length > 0) {
      challengers.push(queue.shift()!);
    } else {
      return null;
    }
  }

  // Empujamos los outgoing al final de queue (ya hicimos la predicción).
  queue.push(...lastOutgoing);

  onCourt = [...lastStaying, ...challengers];
  if (onCourt.length < 2) return null;

  let reason: string;
  if (last.result === 'draw') {
    reason = 'Empate anterior. Entran los 2 primeros en cola.';
  } else {
    const winnerId = lastStaying[0];
    const winnerName = state.teams[winnerId]?.name ?? 'Ganador';
    reason = `${winnerName} se queda. Entra el siguiente en cola.`;
  }

  return {
    teamAId: onCourt[0],
    teamBId: onCourt[1],
    reason,
    certain: unseen.length === 0,
  };
}
