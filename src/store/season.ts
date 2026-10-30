import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AppState, ID, Team } from '@/types/domain';
import {
  accumulateMatches,
  emptyStandingRow,
  getJornadaWinnerTeam,
  type ScorerRow,
  type TeamStandingRow,
} from './selectors';

export type PeriodKind = 'month' | 'season';

/** Rango de fechas `[start, end)` en formato `yyyy-MM-dd`, comparable como texto. */
export interface Period {
  kind: PeriodKind;
  start: string;
  end: string;
  label: string;
}

export interface PeriodStandingRow extends TeamStandingRow {
  /** Jornadas cerradas en las que fue "equipo del día". */
  jornadasWon: number;
}

export interface PeriodScorer extends ScorerRow {
  /** Puesto compartido en caso de empate (1, 1, 3...). */
  rank: number;
}

export interface PeriodTable {
  period: Period;
  standings: PeriodStandingRow[];
  scorers: PeriodScorer[];
  jornadas: number;
  matches: number;
  /** El período ya terminó: el primero es campeón, no "va ganando". */
  finished: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

function monthStart(year: number, month: number): string {
  // `month` 1-12; normaliza desbordes (mes 13 = enero del año siguiente).
  const y = year + Math.floor((month - 1) / 12);
  const m = ((((month - 1) % 12) + 12) % 12) + 1;
  return `${y}-${pad(m)}-01`;
}

function monthName(month: number, short = false): string {
  return cap(format(new Date(2000, month - 1, 1), short ? 'MMM' : 'MMMM', { locale: es }));
}

/** Mes que contiene `date` (yyyy-MM-dd), corrido `offset` meses. */
export function monthPeriod(date: string, offset = 0): Period {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) + offset;
  const start = monthStart(year, month);
  const end = monthStart(year, month + 1);
  const label = `${monthName(Number(start.slice(5, 7)))} ${start.slice(0, 4)}`;
  return { kind: 'month', start, end, label };
}

/**
 * Temporada que contiene `date`, corrida `offset` temporadas. Dura 12 meses desde
 * `startMonth` (1 = enero, es decir, el año calendario).
 */
export function seasonPeriod(date: string, startMonth: number, offset = 0): Period {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const firstYear = (month >= startMonth ? year : year - 1) + offset;
  const start = monthStart(firstYear, startMonth);
  const end = monthStart(firstYear + 1, startMonth);
  const label =
    startMonth === 1
      ? String(firstYear)
      : `${monthName(startMonth, true)} ${firstYear} – ${monthName(startMonth - 1 || 12, true)} ${firstYear + 1}`;
  return { kind: 'season', start, end, label };
}

export function shiftPeriod(period: Period, offset: number, startMonth: number): Period {
  return period.kind === 'month'
    ? monthPeriod(period.start, offset)
    : seasonPeriod(period.start, startMonth, offset);
}

/**
 * Tabla acumulada de un período sobre el estado de UNA competición (la vista filtrada).
 * Cuenta las partidas terminadas de las jornadas del período, también las de la jornada
 * en curso, así la tabla se ve en vivo.
 */
export function getPeriodTable(state: AppState, period: Period, today: string): PeriodTable {
  const jornadas = Object.values(state.jornadas).filter(
    (j) => j.date >= period.start && j.date < period.end
  );
  const jornadaIds = new Set(jornadas.map((j) => j.id));
  const matches = Object.values(state.matches).filter(
    (m) => jornadaIds.has(m.jornadaId) && m.endedAt && m.result !== null
  );

  const rows = new Map<ID, PeriodStandingRow>();
  const rowFor = (team: Team) => {
    let row = rows.get(team.id);
    if (!row) {
      row = { ...emptyStandingRow(team), jornadasWon: 0 };
      rows.set(team.id, row);
    }
    return row;
  };
  // Solo aparecen los equipos que jugaron en el período (fijos, invitados o archivados).
  for (const m of matches) {
    const a = state.teams[m.teamAId];
    const b = state.teams[m.teamBId];
    if (a && b) {
      rowFor(a);
      rowFor(b);
    }
  }
  accumulateMatches(state, matches, rows);
  for (const j of jornadas) {
    if (j.status !== 'closed') continue;
    const winner = getJornadaWinnerTeam(state, j.id);
    if (winner) rowFor(winner).jornadasWon++;
  }

  const standings = [...rows.values()].sort(
    (a, b) =>
      b.pts - a.pts ||
      b.dif - a.dif ||
      b.jornadasWon - a.jornadasWon ||
      b.gf - a.gf ||
      a.team.name.localeCompare(b.team.name)
  );

  // Goleadores: el gol es del jugador aunque haya jugado prestado; los sin asignar no cuentan.
  const matchIds = new Set(matches.map((m) => m.id));
  const counts = new Map<ID, number>();
  for (const g of Object.values(state.goals)) {
    if (!g.playerId || !matchIds.has(g.matchId)) continue;
    counts.set(g.playerId, (counts.get(g.playerId) ?? 0) + 1);
  }
  const rowsScorers: ScorerRow[] = [];
  for (const [playerId, goals] of counts) {
    const player = state.players[playerId];
    const team = player ? state.teams[player.teamId] : undefined;
    if (player && team) rowsScorers.push({ player, team, goals });
  }
  rowsScorers.sort((a, b) => b.goals - a.goals || a.player.name.localeCompare(b.player.name));
  const scorers: PeriodScorer[] = [];
  rowsScorers.forEach((row, i) => {
    const prev = scorers[i - 1];
    scorers.push({ ...row, rank: prev && prev.goals === row.goals ? prev.rank : i + 1 });
  });

  return {
    period,
    standings,
    scorers,
    jornadas: jornadas.length,
    matches: matches.length,
    finished: today >= period.end,
  };
}

/** Fecha de la primera jornada de la competición, para no navegar a períodos vacíos. */
export function firstJornadaDate(state: AppState): string | null {
  const dates = Object.values(state.jornadas).map((j) => j.date);
  return dates.length > 0 ? dates.sort()[0] : null;
}
