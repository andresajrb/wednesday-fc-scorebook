/** Piezas comunes de las imágenes para compartir (jornada, tabla del período). */

export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;

export const PAD = 72;
export const INNER_W = IMAGE_WIDTH - PAD * 2;
export const SANS = '"Geist Variable", system-ui, sans-serif';
export const MONO = '"Geist Mono Variable", ui-monospace, monospace';
export const BG = '#0a0a0a';
export const BG_ELEV = '#161616';
export const LINE = '#1f1f1f';
export const TEXT = '#fafafa';
export const TEXT_2 = '#a1a1a1';
export const TEXT_3 = '#525252';
export const ACCENT = '#bef264';
export const POSITIVE = '#4ade80';
export const NEGATIVE = '#f87171';
export const MEDAL = ['#facc15', '#d4d4d8', '#d97706'];

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="226" fill="none" stroke="${ACCENT}" stroke-width="26" stroke-dasharray="206.65 30" transform="rotate(-26.2 256 256)"/><g transform="translate(256,256) scale(0.76) translate(-283.9,-256)"><g fill="none" stroke="${ACCENT}" stroke-width="42.1"><path d="M95 181 L128 315 L158 225 L188 315 L221 181"/><path d="M269 331 L269 181 L333 181"/><path d="M269 256 L321 256"/><path d="M472.85 303.49 A 62 62 0 1 1 472.85 208.51"/></g></g></svg>`;

export function rgba(hex: string, alpha: number): string {
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

/** Lienzo vertical con fondo oscuro y un brillo del color dado arriba a la izquierda. */
export async function createImageCanvas(glowColor: string): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  const glow = ctx.createLinearGradient(0, 0, IMAGE_WIDTH * 0.4, 760);
  glow.addColorStop(0, rgba(glowColor, 0.38));
  glow.addColorStop(1, rgba(glowColor, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  return { canvas, ctx };
}

/** Logo y nombre a la izquierda, `right` (fecha o período) a la derecha. */
export async function drawBrandHeader(ctx: CanvasRenderingContext2D, right: string): Promise<void> {
  const logo = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(LOGO_SVG)}`);
  const y = PAD;
  if (logo) ctx.drawImage(logo, PAD, y, 64, 64);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ACCENT;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText('MIÉRCOLES DE FÚTBOL', PAD + (logo ? 84 : 0), y + 32);
  ctx.textAlign = 'right';
  ctx.fillStyle = TEXT_2;
  ctx.font = `500 32px ${SANS}`;
  ctx.fillText(right, IMAGE_WIDTH - PAD, y + 32);
  ctx.textAlign = 'left';
}

/** Línea divisoria y texto al pie; `right` va en gris tenue a la derecha. */
export function drawFooter(ctx: CanvasRenderingContext2D, left: string, right?: string): void {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = LINE;
  ctx.fillRect(PAD, IMAGE_HEIGHT - PAD - 62, INNER_W, 2);
  ctx.fillStyle = TEXT_2;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText(left, PAD, IMAGE_HEIGHT - PAD);
  if (right) {
    const leftW = ctx.measureText(left).width;
    ctx.textAlign = 'right';
    ctx.fillStyle = TEXT_3;
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText(ellipsize(ctx, right, INNER_W - leftW - 40), IMAGE_WIDTH - PAD, IMAGE_HEIGHT - PAD);
    ctx.textAlign = 'left';
  }
}

/** Límite inferior del contenido: arriba de la línea del pie. */
export const FOOTER_TOP = IMAGE_HEIGHT - PAD - 62 - 30;

/** Achica la fuente hasta que el texto entre en el ancho disponible. */
export function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  max: number,
  min: number,
  width: number
): number {
  let size = max;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${SANS}`;
    if (ctx.measureText(text).width <= width) break;
    size -= 4;
  }
  return size;
}

export function ellipsize(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > width) out = out.slice(0, -1);
  return `${out}…`;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Punto del color del equipo, con borde para que el negro se vea sobre el fondo. */
export function teamDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Círculo de medalla (oro, plata, bronce) con el puesto adentro. */
export function medal(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rank: number) {
  ctx.fillStyle = MEDAL[rank - 1] ?? '#262626';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rank <= 3 ? BG : TEXT_2;
  ctx.font = `700 ${Math.round(r * 1.05)}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(rank), x, y + 1);
  ctx.textAlign = 'left';
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))), 'image/png');
  });
}
