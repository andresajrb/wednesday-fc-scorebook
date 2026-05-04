export const DEFAULT_TEAMS: Array<{ name: string; color: string }> = [
  { name: 'Azul', color: '#3b82f6' },
  { name: 'Verde', color: '#22c55e' },
  { name: 'Negro', color: '#171717' },
  { name: 'Rojo', color: '#ef4444' },
];

export const COLOR_SWATCHES = [
  '#3b82f6',
  '#22c55e',
  '#171717',
  '#ef4444',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
];

export function softColor(hex: string, alpha = 0.16): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function readableTextColor(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.55 ? '#0a0a0a' : '#fafafa';
}

export function lightenForText(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luma < 0.25) return '#fafafa';
  const lr = Math.min(255, Math.round(r + (255 - r) * 0.45));
  const lg = Math.min(255, Math.round(g + (255 - g) * 0.45));
  const lb = Math.min(255, Math.round(b + (255 - b) * 0.45));
  return `rgb(${lr},${lg},${lb})`;
}
