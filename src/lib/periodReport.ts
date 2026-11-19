import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AppState, ID, Team } from '@/types/domain';
import { getJornadaWinnerTeam } from '@/store/selectors';
import {
  getPeriodTable,
  monthPeriod,
  type PeriodKind,
  type PeriodScorer,
  type PeriodSeries,
  type PeriodStandingRow,
  type PeriodTable,
} from '@/store/season';
import { colorEmoji } from '@/lib/colors';
import { MEDALS, plural, pts, teamTag, type ShareTextVariant } from '@/lib/jornadaReport';

export interface JornadaWinner {
  date: string;
  team: Team | null;
}

export interface MonthChampion {
  /** Mes abreviado: "Ene", "Feb"... */
  label: string;
  /** done: mes cerrado; live: mes en curso; future: todavía no empieza. */
  status: 'done' | 'live' | 'future';
  team: Team | null;
}

export interface PeriodReport {
  kind: PeriodKind;
  /** "Noviembre 2026" o "Temporada 2026". */
  title: string;
  /** "Campeón de noviembre", "Campeón de la temporada" o "Va ganando". */
  leaderLabel: string;
  finished: boolean;
  /** Fecha de corte para un período en curso ("19 nov"). */
  asOfLabel: string;
  leader: PeriodStandingRow | null;
  standings: PeriodStandingRow[];
  scorers: PeriodScorer[];
  series: PeriodSeries;
  jornadas: number;
  matches: number;
  totalGoals: number;
  /** Solo del mes: el equipo del día de cada jornada cerrada. */
  jornadaWinners: JornadaWinner[];
  /** Solo de la temporada: el campeón de cada uno de sus 12 meses. */
  monthChampions: MonthChampion[];
  /** Solo de la temporada: meses ganados por equipo, de más a menos. */
  titles: Array<{ team: Team; count: number }>;
}

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

function localDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayMonth(date: string): string {
  return format(localDate(date), 'd MMM', { locale: es }).replace('.', '');
}

/** Datos para compartir la tabla de un período: los usan las imágenes y el texto. */
export function getPeriodReport(
  state: AppState,
  table: PeriodTable,
  series: PeriodSeries,
  today: string
): PeriodReport {
  const { period } = table;
  const leader = table.standings[0] && table.standings[0].pj > 0 ? table.standings[0] : null;
  const monthName = format(localDate(period.start), 'MMMM', { locale: es });

  const jornadaWinners: JornadaWinner[] = [];
  const monthChampions: MonthChampion[] = [];
  const titleCounts = new Map<ID, { team: Team; count: number }>();

  if (period.kind === 'month') {
    const closed = Object.values(state.jornadas)
      .filter((j) => j.status === 'closed' && j.date >= period.start && j.date < period.end)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    for (const j of closed) jornadaWinners.push({ date: j.date, team: getJornadaWinnerTeam(state, j.id) });
  } else {
    for (let i = 0; i < 12; i++) {
      const month = monthPeriod(period.start, i);
      const label = cap(format(localDate(month.start), 'MMM', { locale: es }).replace('.', ''));
      if (month.start > today) {
        monthChampions.push({ label, status: 'future', team: null });
        continue;
      }
      const monthTable = getPeriodTable(state, month, today);
      const top = monthTable.standings[0];
      const team = top && top.pj > 0 ? top.team : null;
      const status = monthTable.finished ? 'done' : 'live';
      monthChampions.push({ label, status, team });
      if (team && status === 'done') {
        const entry = titleCounts.get(team.id) ?? { team, count: 0 };
        entry.count++;
        titleCounts.set(team.id, entry);
      }
    }
  }

  return {
    kind: period.kind,
    title: period.kind === 'month' ? period.label : `Temporada ${period.label}`,
    leaderLabel: table.finished
      ? period.kind === 'month'
        ? `Campeón de ${monthName}`
        : 'Campeón de la temporada'
      : 'Va ganando',
    finished: table.finished,
    asOfLabel: dayMonth(today),
    leader,
    standings: table.standings,
    scorers: table.scorers,
    series,
    jornadas: table.jornadas,
    matches: table.matches,
    totalGoals: table.standings.reduce((sum, r) => sum + r.gf, 0),
    jornadaWinners,
    monthChampions,
    titles: [...titleCounts.values()].sort(
      (a, b) => b.count - a.count || a.team.name.localeCompare(b.team.name)
    ),
  };
}

/**
 * Texto con formato de WhatsApp. El corto sirve de pie de foto; el completo trae la
 * tabla, goleadores y el equipo del día de cada jornada (o el campeón de cada mes).
 */
export function buildPeriodText(report: PeriodReport, variant: ShareTextVariant): string {
  const lines: string[] = [];
  const totals = `${plural(report.jornadas, 'jornada', 'jornadas')} · ${plural(report.matches, 'partida', 'partidas')} · ${plural(report.totalGoals, 'gol', 'goles')}`;
  const topScorers = report.scorers.filter((s) => s.rank === 1);
  const leaderLine = report.leader
    ? `🏆 ${report.leaderLabel}: *${report.leader.team.name}* ${colorEmoji(report.leader.team.color)} (${pts(report.leader.pts)})`
    : null;

  if (variant === 'short') {
    lines.push(`⚽ *Miércoles de Fútbol* · ${report.title}`);
    if (leaderLine) lines.push(leaderLine);
    if (topScorers.length > 0 && topScorers.length <= 2) {
      const names = topScorers.map((s) => `*${s.player.name}*`).join(' y ');
      lines.push(`👟 ${names} (${plural(topScorers[0].goals, 'gol', 'goles')})`);
    }
    lines.push(`_${totals}${report.finished ? '' : ` · al ${report.asOfLabel}`}_`);
    return lines.join('\n');
  }

  lines.push(`⚽ *Miércoles de Fútbol* — ${report.title}`);
  lines.push(`_${totals}${report.finished ? '' : ` · al ${report.asOfLabel}`}_`);
  if (leaderLine) {
    lines.push('');
    lines.push(leaderLine);
  }

  if (report.standings.length > 0) {
    lines.push('');
    lines.push('*Tabla*');
    report.standings.forEach((r, i) => {
      const dif = `${r.dif > 0 ? '+' : ''}${r.dif}`;
      lines.push(
        `${i + 1}. ${teamTag(r.team)} — *${pts(r.pts)}* (${r.g}G ${r.e}E ${r.p}P, ${dif}, ${r.jornadasWon} JG)`
      );
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

  const winners = report.jornadaWinners.filter((w) => w.team);
  if (winners.length > 0) {
    lines.push('');
    lines.push('*Equipo del día*');
    for (const w of winners) lines.push(`${dayMonth(w.date)} — ${teamTag(w.team!)}`);
  }

  const champions = report.monthChampions.filter((m) => m.team);
  if (champions.length > 0) {
    lines.push('');
    lines.push('*Campeones del mes*');
    for (const m of champions) {
      lines.push(`${m.label} — ${teamTag(m.team!)}${m.status === 'live' ? ' _(va ganando)_' : ''}`);
    }
  }

  return lines.join('\n');
}
