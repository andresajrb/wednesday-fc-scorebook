import type { AppState, ID, Team } from '@/types/domain';
import {
  getJornadaWinnerTeam,
  getMatchesForJornada,
  getMatchScore,
  getStandings,
  getTopScorers,
  type ScorerRow,
  type TeamStandingRow,
} from '@/store/selectors';
import { formatDayShort } from '@/lib/format';
import { colorEmoji } from '@/lib/colors';

export interface ReportMatch {
  order: number;
  teamA: Team;
  teamB: Team;
  goalsA: number;
  goalsB: number;
  result: 'A' | 'B' | 'draw';
}

export interface RankedScorer extends ScorerRow {
  /** Puesto compartido en caso de empate (1, 1, 3...). */
  rank: number;
}

export interface JornadaReport {
  dateLabel: string;
  totalMatches: number;
  totalGoals: number;
  winner: TeamStandingRow | null;
  standings: TeamStandingRow[];
  scorers: RankedScorer[];
  matches: ReportMatch[];
  curiosities: string[];
}

const MAX_CURIOSITIES = 4;

/** Datos del resumen de la jornada: los usan el texto para WhatsApp y la imagen. */
export function getJornadaReport(state: AppState, jornadaId: ID): JornadaReport | null {
  const jornada = state.jornadas[jornadaId];
  if (!jornada) return null;

  const matches: ReportMatch[] = [];
  for (const m of getMatchesForJornada(state, jornadaId)) {
    if (!m.endedAt || m.result === null) continue;
    const teamA = state.teams[m.teamAId];
    const teamB = state.teams[m.teamBId];
    if (!teamA || !teamB) continue;
    const { goalsA, goalsB } = getMatchScore(state, m.id);
    matches.push({ order: m.order, teamA, teamB, goalsA, goalsB, result: m.result });
  }

  const standings = getStandings(state, jornadaId);
  const winnerTeam = getJornadaWinnerTeam(state, jornadaId);
  const winner = standings.find((r) => r.team.id === winnerTeam?.id) ?? null;

  const scorers: RankedScorer[] = [];
  for (const [i, row] of getTopScorers(state, jornadaId, Number.POSITIVE_INFINITY).entries()) {
    const prev = scorers[i - 1];
    scorers.push({ ...row, rank: prev && prev.goals === row.goals ? prev.rank : i + 1 });
  }

  return {
    dateLabel: formatDayShort(jornada.date),
    totalMatches: matches.length,
    totalGoals: matches.reduce((sum, m) => sum + m.goalsA + m.goalsB, 0),
    winner,
    standings,
    scorers,
    matches,
    curiosities: getCuriosities(matches, standings, scorers),
  };
}

function getCuriosities(
  matches: ReportMatch[],
  standings: TeamStandingRow[],
  scorers: RankedScorer[]
): string[] {
  const out: string[] = [];

  // Racha: el ganador se queda, así que las victorias seguidas son partidas seguidas.
  const streak = new Map<ID, number>();
  let best: { team: Team; wins: number } | null = null;
  for (const m of matches) {
    const winner = m.result === 'A' ? m.teamA : m.result === 'B' ? m.teamB : null;
    for (const t of [m.teamA, m.teamB]) {
      if (winner && t.id === winner.id) {
        const wins = (streak.get(t.id) ?? 0) + 1;
        streak.set(t.id, wins);
        if (!best || wins > best.wins) best = { team: t, wins };
      } else {
        streak.set(t.id, 0);
      }
    }
  }
  if (best && best.wins >= 3) {
    out.push(`🔥 ${best.team.name} ganó ${best.wins} seguidas`);
  }

  for (const s of scorers.filter((s) => s.goals >= 3).slice(0, 2)) {
    out.push(`🎩 Hat-trick de ${s.player.name} (${s.goals} goles)`);
  }

  let rout: ReportMatch | null = null;
  for (const m of matches) {
    const diff = Math.abs(m.goalsA - m.goalsB);
    // Un 2-0 es el resultado normal de la primera partida: goleada es desde 3.
    if (diff >= 3 && (!rout || diff > Math.abs(rout.goalsA - rout.goalsB))) rout = m;
  }
  if (rout) {
    const [w, l, gw, gl] =
      rout.goalsA > rout.goalsB
        ? [rout.teamA, rout.teamB, rout.goalsA, rout.goalsB]
        : [rout.teamB, rout.teamA, rout.goalsB, rout.goalsA];
    out.push(`💥 Goleada: ${w.name} ${gw}-${gl} ${l.name}`);
  }

  for (const r of standings.filter((r) => r.pj >= 3 && r.p === 0).slice(0, 1)) {
    out.push(`🛡️ ${r.team.name} terminó invicto`);
  }

  const maxPj = Math.max(0, ...standings.map((r) => r.pj));
  const mostPlayed = standings.filter((r) => r.pj === maxPj);
  if (maxPj >= 4 && mostPlayed.length === 1) {
    out.push(`⏱️ ${mostPlayed[0].team.name} fue el que más estuvo en cancha (${maxPj} partidas)`);
  }

  const draws = matches.filter((m) => m.result === 'draw').length;
  if (draws >= 3) out.push(`🤝 ${draws} empates en el día`);

  return out.slice(0, MAX_CURIOSITIES);
}

const MEDALS = ['🥇', '🥈', '🥉'];

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function pts(n: number): string {
  return `${n} ${n === 1 ? 'pt' : 'pts'}`;
}

function teamTag(team: Team): string {
  return `${colorEmoji(team.color)} ${team.name}`;
}

export type ShareTextVariant = 'short' | 'full';

/**
 * Texto con formato de WhatsApp (*negrita*, _cursiva_). La versión corta sirve como
 * pie de foto de la imagen; la completa trae la tabla, goleadores, partidas y curiosidades.
 */
export function buildShareText(report: JornadaReport, variant: ShareTextVariant): string {
  const lines: string[] = [];
  const totals = `${plural(report.totalMatches, 'partida', 'partidas')} · ${plural(report.totalGoals, 'gol', 'goles')}`;
  const topScorers = report.scorers.filter((s) => s.rank === 1);

  if (variant === 'short') {
    lines.push(`⚽ *Miércoles de Fútbol* · ${report.dateLabel}`);
    const parts: string[] = [];
    if (report.winner) {
      parts.push(`🏆 Ganó *${report.winner.team.name}* ${colorEmoji(report.winner.team.color)} (${pts(report.winner.pts)})`);
    }
    if (topScorers.length > 0 && topScorers.length <= 2) {
      const names = topScorers.map((s) => `*${s.player.name}*`).join(' y ');
      parts.push(`👟 ${names} (${plural(topScorers[0].goals, 'gol', 'goles')})`);
    }
    if (parts.length > 0) lines.push(parts.join(' · '));
    lines.push(`_${totals}_`);
    return lines.join('\n');
  }

  lines.push(`⚽ *Miércoles de Fútbol* — ${report.dateLabel}`);
  lines.push(`_${totals}_`);

  if (report.winner) {
    lines.push('');
    lines.push(`🏆 *Equipo del día: ${report.winner.team.name}* ${colorEmoji(report.winner.team.color)}`);
    lines.push(
      `${plural(report.winner.g, 'victoria', 'victorias')} · ${plural(report.winner.gf, 'gol', 'goles')} · ${pts(report.winner.pts)}`
    );
  }

  if (report.standings.length > 0) {
    lines.push('');
    lines.push('*Tabla*');
    report.standings.forEach((r, i) => {
      if (r.pj === 0) {
        lines.push(`${i + 1}. ${teamTag(r.team)} — _no jugó_`);
        return;
      }
      const dif = `${r.dif > 0 ? '+' : ''}${r.dif}`;
      lines.push(`${i + 1}. ${teamTag(r.team)} — *${pts(r.pts)}* (${r.g}G ${r.e}E ${r.p}P, ${dif})`);
    });
  }

  const shownScorers = report.scorers.filter((s) => s.rank <= 5);
  if (shownScorers.length > 0) {
    lines.push('');
    lines.push('*Goleadores*');
    for (const s of shownScorers) {
      const medal = MEDALS[s.rank - 1] ?? `${s.rank}.`;
      lines.push(`${medal} ${s.player.name} (${s.team.name}) — ${s.goals}`);
    }
  }

  if (report.matches.length > 0) {
    lines.push('');
    lines.push('*Partidas*');
    for (const m of report.matches) {
      const a = m.result === 'A' ? `*${m.teamA.name}*` : m.teamA.name;
      const b = m.result === 'B' ? `*${m.teamB.name}*` : m.teamB.name;
      lines.push(
        `${m.order}. ${colorEmoji(m.teamA.color)} ${a} ${m.goalsA}-${m.goalsB} ${b} ${colorEmoji(m.teamB.color)}`
      );
    }
  }

  if (report.curiosities.length > 0) {
    lines.push('');
    lines.push('*Curiosidades*');
    lines.push(...report.curiosities);
  }

  return lines.join('\n');
}
