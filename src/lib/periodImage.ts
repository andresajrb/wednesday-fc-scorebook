import type { PeriodReport } from '@/lib/periodReport';
import { dayMonth } from '@/lib/periodReport';
import { plural } from '@/lib/jornadaReport';
import { lightenForText } from '@/lib/colors';
import { isDarkColor, niceScale, shortDate } from '@/components/charts/chartKit';
import {
  ACCENT,
  BG_ELEV,
  FOOTER_TOP,
  IMAGE_WIDTH,
  INNER_W,
  LINE,
  MONO,
  NEGATIVE,
  PAD,
  POSITIVE,
  SANS,
  TEXT,
  TEXT_2,
  TEXT_3,
  canvasToBlob,
  createImageCanvas,
  drawBrandHeader,
  drawFooter,
  ellipsize,
  fitFont,
  medal,
  rgba,
  roundRect,
  teamDot,
} from '@/lib/canvasKit';

/** Imágenes que se pueden compartir de la tabla de un período. */
export type PeriodImageKind = 'table' | 'scorers' | 'race';

/** La carrera necesita al menos 2 jornadas para dibujar una línea. */
export function canRenderRace(report: PeriodReport): boolean {
  return report.series.points.length >= 2;
}

export function renderPeriodImage(report: PeriodReport, kind: PeriodImageKind): Promise<Blob> {
  if (kind === 'scorers') return renderScorers(report);
  if (kind === 'race') return renderRace(report);
  return renderTable(report);
}

function totalsLine(report: PeriodReport): string {
  return `${plural(report.jornadas, 'jornada', 'jornadas')} · ${plural(report.matches, 'partida', 'partidas')} · ${plural(report.totalGoals, 'gol', 'goles')}`;
}

function asOf(report: PeriodReport): string | undefined {
  return report.finished ? undefined : `Al ${report.asOfLabel}`;
}

/** Etiqueta en mayúsculas sobre un bloque. */
function sectionLabel(ctx: CanvasRenderingContext2D, text: string, y: number, color = TEXT_2) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.font = `700 26px ${SANS}`;
  ctx.fillText(text.toUpperCase(), PAD, y);
}

/** Etiqueta, nombre grande y una línea de detalle. Devuelve dónde termina. */
function drawHero(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  name: string,
  detail: string,
  color: string,
  maxSize: number
): number {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText(label.toUpperCase(), PAD, y);
  const size = fitFont(ctx, name, 700, maxSize, 56, INNER_W);
  ctx.font = `700 ${size}px ${SANS}`;
  ctx.fillText(name, PAD - 4, y + 18 + size * 0.86);
  y += 18 + size + 30;
  ctx.fillStyle = TEXT_2;
  ctx.font = `500 34px ${SANS}`;
  ctx.fillText(ellipsize(ctx, detail, INNER_W), PAD, y);
  return y + 70;
}

// ─── Tabla ───────────────────────────────────────────────────────────────────

// Centros de columna; PTS va alineado a la derecha. Caben 3 cifras (tabla del año).
const TABLE_COLS = [
  { label: 'PJ', x: 456 },
  { label: 'G', x: 534 },
  { label: 'E', x: 612 },
  { label: 'P', x: 690 },
  { label: 'DIF', x: 774 },
  { label: 'JG', x: 856 },
];
const PTS_RIGHT = IMAGE_WIDTH - PAD - 16;

async function renderTable(report: PeriodReport): Promise<Blob> {
  const leader = report.leader;
  const { canvas, ctx } = await createImageCanvas(leader?.team.color ?? ACCENT);
  await drawBrandHeader(ctx, report.title);

  const n = report.standings.length;
  let y = 220;
  if (leader) {
    const label = report.finished ? report.leaderLabel : `${report.leaderLabel} · al ${report.asOfLabel}`;
    const w = leader;
    y = drawHero(
      ctx,
      y,
      label,
      w.team.name,
      `${w.pts} pts · ${plural(w.g, 'victoria', 'victorias')} · ${plural(w.jornadasWon, 'jornada ganada', 'jornadas ganadas')}`,
      lightenForText(w.team.color),
      n > 6 ? 104 : 132
    );
  }

  // Bloque de abajo: equipo del día de cada jornada (mes) o campeón de cada mes (temporada).
  const extraH =
    report.kind === 'season'
      ? 60 + 2 * 104 + 12 + 56
      : report.jornadaWinners.length > 0
        ? 60 + Math.min(2, Math.ceil(report.jornadaWinners.length / 5)) * 104 + (report.jornadaWinners.length > 5 ? 16 : 0)
        : 0;
  const tableTop = y;
  // Con pocos equipos las filas crecen para no dejar la mitad de la imagen vacía.
  let rowH = Math.min(84, (FOOTER_TOP - tableTop - 30 - 40 - extraH) / Math.max(1, n));
  let showExtra = extraH > 0;
  if (rowH < 50) {
    showExtra = false;
    rowH = Math.min(84, (FOOTER_TOP - tableTop - 30 - 20) / Math.max(1, n));
  }

  ctx.textBaseline = 'middle';
  ctx.font = `700 24px ${MONO}`;
  ctx.fillStyle = TEXT_3;
  ctx.fillText('EQUIPO', PAD + 24, y);
  ctx.textAlign = 'center';
  for (const c of TABLE_COLS) ctx.fillText(c.label, c.x, y);
  ctx.textAlign = 'right';
  ctx.fillText('PTS', PTS_RIGHT, y);
  ctx.textAlign = 'left';
  y += 30;

  const fontScale = Math.min(1.12, rowH / 70);
  report.standings.forEach((r, i) => {
    const top = y + i * rowH;
    const mid = top + rowH / 2;
    if (leader && i === 0) {
      ctx.fillStyle = rgba(r.team.color, 0.16);
      roundRect(ctx, PAD, top + 4, INNER_W, rowH - 8, 16);
      ctx.fill();
    } else if (i > 0) {
      ctx.fillStyle = LINE;
      ctx.fillRect(PAD + 24, top, INNER_W - 48, 2);
    }
    teamDot(ctx, PAD + 36, mid, 12, r.team.color);
    ctx.fillStyle = TEXT;
    ctx.font = `600 ${Math.round(34 * fontScale)}px ${SANS}`;
    ctx.fillText(ellipsize(ctx, r.team.name, TABLE_COLS[0].x - 40 - (PAD + 64)), PAD + 64, mid);
    ctx.textAlign = 'center';
    ctx.font = `500 ${Math.round(30 * fontScale)}px ${MONO}`;
    const values = [r.pj, r.g, r.e, r.p, `${r.dif > 0 ? '+' : ''}${r.dif}`, r.jornadasWon];
    values.forEach((v, idx) => {
      ctx.fillStyle = idx === 4 ? (r.dif > 0 ? POSITIVE : r.dif < 0 ? NEGATIVE : TEXT_2) : TEXT_2;
      ctx.fillText(String(v), TABLE_COLS[idx].x, mid);
    });
    ctx.textAlign = 'right';
    ctx.fillStyle = TEXT;
    ctx.font = `700 ${Math.round(36 * fontScale)}px ${MONO}`;
    ctx.fillText(String(r.pts), PTS_RIGHT, mid);
    ctx.textAlign = 'left';
  });
  y += n * rowH + 60;

  if (showExtra) {
    if (report.kind === 'season') drawMonthChampions(ctx, report, y);
    else drawJornadaWinners(ctx, report, y);
  }

  drawFooter(ctx, totalsLine(report));
  return canvasToBlob(canvas);
}

/** Celda de un mes o una jornada: título arriba y el equipo ganador abajo. */
function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  team: { name: string; color: string } | null,
  state: 'done' | 'live' | 'future'
) {
  roundRect(ctx, x, y, w, h, 16);
  if (team && state === 'done') {
    ctx.fillStyle = rgba(team.color, 0.22);
    ctx.fill();
  } else {
    ctx.fillStyle = state === 'future' ? 'rgba(22,22,22,0.5)' : BG_ELEV;
    ctx.fill();
    if (team && state === 'live') {
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = rgba(team.color, 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.textBaseline = 'middle';
  ctx.fillStyle = state === 'future' ? TEXT_3 : TEXT_2;
  ctx.font = `600 24px ${SANS}`;
  ctx.fillText(title, x + 16, y + 30);

  const nameY = y + h - 32;
  if (team) {
    teamDot(ctx, x + 26, nameY, 10, team.color);
    ctx.fillStyle = lightenForText(team.color);
    ctx.font = `700 26px ${SANS}`;
    ctx.fillText(ellipsize(ctx, team.name, w - 58), x + 44, nameY);
  } else {
    ctx.fillStyle = TEXT_3;
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText('—', x + 16, nameY);
  }
}

function drawMonthChampions(ctx: CanvasRenderingContext2D, report: PeriodReport, y: number) {
  sectionLabel(ctx, 'Campeón de cada mes', y);
  const top = y + 26;
  const cols = 6;
  const gap = 12;
  const w = (INNER_W - gap * (cols - 1)) / cols;
  const h = 104;
  report.monthChampions.forEach((m, i) => {
    const x = PAD + (i % cols) * (w + gap);
    const cy = top + Math.floor(i / cols) * (h + gap);
    drawCell(ctx, x, cy, w, h, m.label, m.team, m.status);
  });

  const titles = report.titles.map((t) => `${t.team.name} ${t.count}`).join(' · ');
  const live = report.monthChampions.some((m) => m.status === 'live' && m.team);
  const note = [titles && `Meses ganados: ${titles}`, live && 'punteado: mes en curso'].filter(Boolean).join('  ·  ');
  if (note) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = TEXT_2;
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText(ellipsize(ctx, note, INNER_W), PAD, top + 2 * h + gap + 46);
  }
}

function drawJornadaWinners(ctx: CanvasRenderingContext2D, report: PeriodReport, y: number) {
  sectionLabel(ctx, 'Equipo del día', y);
  const top = y + 26;
  const shown = report.jornadaWinners.slice(0, 10);
  const cols = Math.max(4, Math.min(5, shown.length));
  const gap = 12;
  const w = (INNER_W - gap * (cols - 1)) / cols;
  const h = 104;
  shown.forEach((j, i) => {
    const x = PAD + (i % cols) * (w + gap);
    const cy = top + Math.floor(i / cols) * (h + gap);
    drawCell(ctx, x, cy, w, h, dayMonth(j.date), j.team, 'done');
  });
}

// ─── Goleadores ──────────────────────────────────────────────────────────────

const MAX_SCORER_ROWS = 10;

async function renderScorers(report: PeriodReport): Promise<Blob> {
  const leaders = report.scorers.filter((s) => s.rank === 1);
  const sameTeam = leaders.every((s) => s.team.id === leaders[0]?.team.id);
  const heroColor = leaders.length > 0 && sameTeam ? leaders[0].team.color : ACCENT;
  const { canvas, ctx } = await createImageCanvas(heroColor);
  await drawBrandHeader(ctx, report.title);

  let y = 220;
  if (leaders.length === 0) {
    y = drawHero(ctx, y, 'Goleadores', 'Sin goles', 'Todavía no hay goles asignados en el período.', TEXT_2, 120);
  } else {
    const goals = plural(leaders[0].goals, 'gol', 'goles');
    const label = `${leaders.length === 1 ? 'Máximo goleador' : 'Máximos goleadores'}${report.finished ? '' : ` · al ${report.asOfLabel}`}`;
    const name =
      leaders.length === 1
        ? leaders[0].player.name
        : leaders.length <= 3
          ? leaders.map((s) => s.player.name).join(' y ').replace(/ y (?=.* y )/g, ', ')
          : `${leaders.length} empatados`;
    const detail = leaders.length === 1 ? `${goals} · ${leaders[0].team.name}` : `${goals} cada uno`;
    y = drawHero(ctx, y, label, name, detail, sameTeam ? lightenForText(heroColor) : ACCENT, 120);
  }

  const rows = report.scorers.slice(0, MAX_SCORER_ROWS);
  const rowH = Math.min(80, (FOOTER_TOP - y) / Math.max(1, rows.length));
  const scale = rowH / 80;
  rows.forEach((s, i) => {
    const top = y + i * rowH;
    const mid = top + rowH / 2;
    if (s.rank === 1) {
      ctx.fillStyle = rgba(s.team.color, 0.16);
      roundRect(ctx, PAD, top + 4, INNER_W, rowH - 8, 16);
      ctx.fill();
    } else if (i > 0 && rows[i - 1].rank !== 1) {
      ctx.fillStyle = LINE;
      ctx.fillRect(PAD + 24, top, INNER_W - 48, 2);
    }
    medal(ctx, PAD + 40, mid, Math.round(24 * scale), s.rank);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TEXT;
    ctx.font = `600 ${Math.round(36 * scale)}px ${SANS}`;
    const name = ellipsize(ctx, s.player.name, 520);
    ctx.fillText(name, PAD + 86, mid);
    const nameW = ctx.measureText(name).width;
    ctx.fillStyle = lightenForText(s.team.color);
    ctx.font = `500 ${Math.round(26 * scale)}px ${SANS}`;
    ctx.fillText(ellipsize(ctx, s.team.name, 760 - nameW - 120), PAD + 86 + nameW + 18, mid + 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = TEXT;
    ctx.font = `700 ${Math.round(42 * scale)}px ${MONO}`;
    ctx.fillText(String(s.goals), IMAGE_WIDTH - PAD - 24, mid);
    ctx.textAlign = 'left';
  });

  const assigned = report.scorers.reduce((sum, s) => sum + s.goals, 0);
  drawFooter(
    ctx,
    `${plural(assigned, 'gol', 'goles')} · ${plural(report.scorers.length, 'goleador', 'goleadores')}`
  );
  return canvasToBlob(canvas);
}

// ─── Carrera por el título ───────────────────────────────────────────────────

async function renderRace(report: PeriodReport): Promise<Blob> {
  const { teams, points } = report.series;
  const leader = report.leader;
  const { canvas, ctx } = await createImageCanvas(leader?.team.color ?? ACCENT);
  await drawBrandHeader(ctx, report.title);

  const n = points.length;
  const y = drawHero(
    ctx,
    220,
    'Carrera por el título',
    leader ? leader.team.name : 'Sin datos',
    leader ? `${report.leaderLabel} con ${leader.pts} pts · ${plural(n, 'jornada', 'jornadas')}` : '',
    leader ? lightenForText(leader.team.color) : ACCENT,
    112
  );

  const left = PAD + 56;
  const right = IMAGE_WIDTH - PAD - 230;
  const top = y + 10;
  const bottom = FOOTER_TOP - 50;
  const plotW = right - left;
  const plotH = bottom - top;
  const maxPts = Math.max(0, ...points.flatMap((p) => Object.values(p.cumulative)));
  const scale = niceScale(maxPts);
  const px = (i: number) => left + (i * plotW) / Math.max(1, n - 1);
  const py = (v: number) => top + plotH - (v / scale.max) * plotH;

  // Grilla y ejes
  ctx.textBaseline = 'middle';
  ctx.font = `500 24px ${MONO}`;
  for (const v of scale.ticks) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(left, py(v) - 1, plotW, 2);
    ctx.fillStyle = TEXT_3;
    ctx.textAlign = 'right';
    ctx.fillText(String(v), left - 16, py(v));
  }
  const step = Math.ceil(n / 6);
  const xLabels = points.map((_, i) => i).filter((i) => i % step === 0 || i === n - 1);
  if (xLabels.length > 1 && xLabels[xLabels.length - 1] - xLabels[xLabels.length - 2] < step * 0.8) {
    xLabels.splice(xLabels.length - 2, 1);
  }
  ctx.fillStyle = TEXT_3;
  ctx.font = `500 24px ${SANS}`;
  for (const i of xLabels) {
    ctx.textAlign = i === 0 ? 'left' : i === n - 1 ? 'right' : 'center';
    ctx.fillText(shortDate(points[i].date).replace('.', ''), px(i), bottom + 34);
  }
  ctx.textAlign = 'left';

  // Líneas: la del líder queda encima.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const showDots = n <= 12;
  for (const team of [...teams].reverse()) {
    const path = () => {
      ctx.beginPath();
      points.forEach((p, i) => {
        const v = p.cumulative[team.id] ?? 0;
        if (i === 0) ctx.moveTo(px(i), py(v));
        else ctx.lineTo(px(i), py(v));
      });
    };
    if (isDarkColor(team.color)) {
      path();
      ctx.strokeStyle = '#737373';
      ctx.lineWidth = 11;
      ctx.stroke();
    }
    path();
    ctx.strokeStyle = team.color;
    ctx.lineWidth = 7;
    ctx.stroke();
    points.forEach((p, i) => {
      if (!showDots && i !== n - 1) return;
      teamDot(ctx, px(i), py(p.cumulative[team.id] ?? 0), i === n - 1 ? 11 : 7, team.color);
    });
  }

  // Etiquetas al final de cada línea, separadas si chocan.
  const last = points[n - 1];
  const gap = 44;
  const ends = teams
    .map((t) => ({ team: t, value: last.cumulative[t.id] ?? 0 }))
    .map((e) => ({ ...e, y: py(e.value) }))
    .sort((a, b) => a.y - b.y);
  const labelY = ends.map((e) => e.y);
  for (let i = 1; i < labelY.length; i++) labelY[i] = Math.max(labelY[i], labelY[i - 1] + gap);
  const overflow = labelY[labelY.length - 1] - bottom;
  if (overflow > 0) for (let i = 0; i < labelY.length; i++) labelY[i] -= overflow;
  for (let i = labelY.length - 2; i >= 0; i--) labelY[i] = Math.min(labelY[i], labelY[i + 1] - gap);

  ends.forEach((e, i) => {
    const ly = labelY[i];
    if (Math.abs(ly - e.y) > 2) {
      ctx.strokeStyle = TEXT_3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(right + 14, e.y);
      ctx.lineTo(right + 30, ly);
      ctx.stroke();
    }
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TEXT;
    ctx.font = `700 30px ${MONO}`;
    const value = String(e.value);
    ctx.fillText(value, right + 38, ly);
    const vw = ctx.measureText(value).width;
    ctx.fillStyle = lightenForText(e.team.color);
    ctx.font = `600 26px ${SANS}`;
    ctx.fillText(ellipsize(ctx, e.team.name, IMAGE_WIDTH - PAD - (right + 38 + vw + 12)), right + 38 + vw + 12, ly);
  });

  drawFooter(ctx, 'Puntos acumulados jornada a jornada', asOf(report));
  return canvasToBlob(canvas);
}
