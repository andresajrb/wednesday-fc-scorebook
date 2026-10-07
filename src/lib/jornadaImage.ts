import type { JornadaReport } from '@/lib/jornadaReport';
import { lightenForText } from '@/lib/colors';

export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;

const PAD = 72;
const SANS = '"Geist Variable", system-ui, sans-serif';
const MONO = '"Geist Mono Variable", ui-monospace, monospace';
const BG = '#0a0a0a';
const TEXT = '#fafafa';
const TEXT_2 = '#a1a1a1';
const TEXT_3 = '#525252';
const ACCENT = '#bef264';
const MEDAL = ['#facc15', '#d4d4d8', '#d97706'];

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="226" fill="none" stroke="${ACCENT}" stroke-width="26" stroke-dasharray="206.65 30" transform="rotate(-26.2 256 256)"/><g transform="translate(256,256) scale(0.76) translate(-283.9,-256)"><g fill="none" stroke="${ACCENT}" stroke-width="42.1"><path d="M95 181 L128 315 L158 225 L188 315 L221 181"/><path d="M269 331 L269 181 L333 181"/><path d="M269 256 L321 256"/><path d="M472.85 303.49 A 62 62 0 1 1 472.85 208.51"/></g></g></svg>`;

function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`700 40px ${SANS}`),
      document.fonts.load(`500 40px ${SANS}`),
      document.fonts.load(`700 40px ${MONO}`),
    ]);
  } catch {
    // Con la fuente del sistema la imagen sale igual.
  }
}

/** Achica la fuente hasta que el texto entre en el ancho disponible. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, min: number, width: number): number {
  let size = max;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${SANS}`;
    if (ctx.measureText(text).width <= width) break;
    size -= 4;
  }
  return size;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > width) out = out.slice(0, -1);
  return `${out}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Imagen vertical (1080×1350, formato de WhatsApp/Instagram) con el resumen de la jornada. */
export async function renderJornadaImage(report: JornadaReport): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const winnerColor = report.winner?.team.color ?? ACCENT;
  const innerW = IMAGE_WIDTH - PAD * 2;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  const glow = ctx.createLinearGradient(0, 0, IMAGE_WIDTH * 0.4, 760);
  glow.addColorStop(0, rgba(winnerColor, 0.38));
  glow.addColorStop(1, rgba(winnerColor, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  // Cabecera
  const logo = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(LOGO_SVG)}`);
  let y = PAD;
  if (logo) ctx.drawImage(logo, PAD, y, 64, 64);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ACCENT;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText('MIÉRCOLES DE FÚTBOL', PAD + (logo ? 84 : 0), y + 32);
  ctx.textAlign = 'right';
  ctx.fillStyle = TEXT_2;
  ctx.font = `500 32px ${SANS}`;
  ctx.fillText(report.dateLabel, IMAGE_WIDTH - PAD, y + 32);
  ctx.textAlign = 'left';

  // Equipo del día
  y = 220;
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

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))), 'image/png');
  });
}
