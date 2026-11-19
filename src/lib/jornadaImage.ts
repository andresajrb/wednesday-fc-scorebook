import type { JornadaReport } from '@/lib/jornadaReport';
import { lightenForText } from '@/lib/colors';
import {
  ACCENT,
  BG,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  MEDAL,
  MONO,
  PAD,
  SANS,
  TEXT,
  TEXT_2,
  TEXT_3,
  canvasToBlob,
  createImageCanvas,
  drawBrandHeader,
  ellipsize,
  fitFont,
  rgba,
  roundRect,
} from '@/lib/canvasKit';

/** Imagen vertical (1080×1350, formato de WhatsApp/Instagram) con el resumen de la jornada. */
export async function renderJornadaImage(report: JornadaReport): Promise<Blob> {
  const winnerColor = report.winner?.team.color ?? ACCENT;
  const innerW = IMAGE_WIDTH - PAD * 2;
  const { canvas, ctx } = await createImageCanvas(winnerColor);

  await drawBrandHeader(ctx, report.dateLabel);
  // Equipo del día
  let y = 220;
  ctx.textBaseline = 'alphabetic';
  if (report.winner) {
    const nameColor = lightenForText(report.winner.team.color);
    ctx.fillStyle = nameColor;
    ctx.font = `700 30px ${SANS}`;
    ctx.fillText('EQUIPO DEL DÍA', PAD, y);
    const size = fitFont(ctx, report.winner.team.name, 700, 132, 64, innerW);
    ctx.font = `700 ${size}px ${SANS}`;
    ctx.fillText(report.winner.team.name, PAD - 4, y + 18 + size * 0.86);
    y += 18 + size + 30;
    ctx.fillStyle = TEXT_2;
    ctx.font = `500 34px ${SANS}`;
    const w = report.winner;
    ctx.fillText(
      `${w.g} ${w.g === 1 ? 'victoria' : 'victorias'} · ${w.gf} ${w.gf === 1 ? 'gol' : 'goles'} · ${w.pts} pts`,
      PAD,
      y
    );
    y += 70;
  } else {
    ctx.fillStyle = TEXT;
    ctx.font = `700 96px ${SANS}`;
    ctx.fillText('Jornada', PAD - 4, y + 80);
    y += 170;
  }

  // Tabla
  const cols = [
    { label: 'PJ', x: 600 },
    { label: 'G', x: 680 },
    { label: 'E', x: 750 },
    { label: 'P', x: 820 },
    { label: 'DIF', x: 900 },
    { label: 'PTS', x: IMAGE_WIDTH - PAD - 20 },
  ];
  ctx.textBaseline = 'middle';
  ctx.font = `700 24px ${MONO}`;
  ctx.fillStyle = TEXT_3;
  ctx.fillText('EQUIPO', PAD + 24, y);
  ctx.textAlign = 'center';
  for (const c of cols) ctx.fillText(c.label, c.x, y);
  ctx.textAlign = 'left';
  y += 30;

  const rowH = report.standings.length > 5 ? 62 : 70;
  report.standings.forEach((r, i) => {
    const top = y + i * rowH;
    const mid = top + rowH / 2;
    if (report.winner && r.team.id === report.winner.team.id) {
      ctx.fillStyle = rgba(r.team.color, 0.16);
      roundRect(ctx, PAD, top + 4, innerW, rowH - 8, 16);
      ctx.fill();
    } else if (i > 0) {
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(PAD + 24, top, innerW - 48, 2);
    }
    ctx.fillStyle = r.team.color;
    ctx.beginPath();
    ctx.arc(PAD + 36, mid, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = TEXT;
    ctx.font = `600 34px ${SANS}`;
    ctx.fillText(ellipsize(ctx, r.team.name, 480), PAD + 64, mid);
    ctx.textAlign = 'center';
    ctx.font = `500 32px ${MONO}`;
    const values = [r.pj, r.g, r.e, r.p, `${r.dif > 0 ? '+' : ''}${r.dif}`];
    values.forEach((v, idx) => {
      ctx.fillStyle = idx === 4 ? (r.dif > 0 ? '#4ade80' : r.dif < 0 ? '#f87171' : TEXT_2) : TEXT_2;
      ctx.fillText(String(v), cols[idx].x, mid);
    });
    ctx.fillStyle = TEXT;
    ctx.font = `700 36px ${MONO}`;
    ctx.fillText(String(r.pts), cols[5].x, mid);
    ctx.textAlign = 'left';
  });
  y += report.standings.length * rowH + 50;

  // Goleadores
  const scorers = report.scorers.filter((s) => s.rank <= 3).slice(0, 3);
  if (scorers.length > 0) {
    ctx.fillStyle = TEXT_2;
    ctx.font = `700 26px ${SANS}`;
    ctx.fillText('GOLEADORES', PAD, y);
    y += 26;
    const sRowH = 68;
    scorers.forEach((s, i) => {
      const mid = y + i * sRowH + sRowH / 2;
      ctx.fillStyle = MEDAL[s.rank - 1] ?? TEXT_3;
      ctx.beginPath();
      ctx.arc(PAD + 24, mid, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BG;
      ctx.font = `700 24px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(s.rank), PAD + 24, mid + 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = TEXT;
      ctx.font = `600 36px ${SANS}`;
      const name = ellipsize(ctx, s.player.name, 520);
      ctx.fillText(name, PAD + 68, mid);
      const nameW = ctx.measureText(name).width;
      ctx.fillStyle = lightenForText(s.team.color);
      ctx.font = `500 26px ${SANS}`;
      ctx.fillText(ellipsize(ctx, s.team.name, 760 - nameW - 120), PAD + 68 + nameW + 18, mid + 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = TEXT;
      ctx.font = `700 42px ${MONO}`;
      ctx.fillText(String(s.goals), IMAGE_WIDTH - PAD - 20, mid);
      ctx.textAlign = 'left';
    });
  }

  // Pie
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1f1f1f';
  ctx.fillRect(PAD, IMAGE_HEIGHT - PAD - 62, innerW, 2);
  ctx.fillStyle = TEXT_2;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText(
    `${report.totalMatches} ${report.totalMatches === 1 ? 'partida' : 'partidas'} · ${report.totalGoals} ${report.totalGoals === 1 ? 'gol' : 'goles'}`,
    PAD,
    IMAGE_HEIGHT - PAD
  );
  if (report.curiosities[0]) {
    ctx.textAlign = 'right';
    ctx.fillStyle = TEXT_3;
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText(ellipsize(ctx, report.curiosities[0], innerW - 420), IMAGE_WIDTH - PAD, IMAGE_HEIGHT - PAD);
    ctx.textAlign = 'left';
  }

  return canvasToBlob(canvas);
}
