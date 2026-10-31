import { useEffect, useRef, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/** Tokens del gráfico (la app es solo oscura): superficie, grilla y tintas de texto. */
export const CHART = {
  surface: '#161616',
  grid: '#2a2a2a',
  axisText: '#8a8a8a',
  text: '#fafafa',
  textMuted: '#a1a1a1',
  accent: '#bef264',
} as const;

/** Ancho real del contenedor, para dibujar el SVG a escala 1:1 (texto nítido). */
export function useChartWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Máximo y marcas del eje Y en números redondos, a lo sumo 4 intervalos. */
export function niceScale(max: number): { max: number; ticks: number[] } {
  const steps = [1, 2, 3, 5, 10, 15, 20, 25, 50, 100];
  const safeMax = Math.max(1, max);
  const step = steps.find((s) => Math.ceil(safeMax / s) <= 4) ?? Math.ceil(safeMax / 4);
  const top = Math.ceil(safeMax / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { max: top, ticks };
}

export function shortDate(date: string): string {
  // yyyy-MM-dd como fecha local (ver lib/format: new Date('yyyy-MM-dd') es UTC).
  const [y, m, d] = date.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'd MMM', { locale: es });
}

/** Colores muy oscuros (equipo negro) casi no se ven sobre la superficie del gráfico. */
export function isDarkColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.2;
}

/** Globo de detalle: posicionado sobre el gráfico, sin salirse por los costados. */
export function ChartTooltip({
  x,
  width,
  children,
}: {
  x: number;
  width: number;
  children: ReactNode;
}) {
  const boxWidth = 168;
  const left = Math.min(Math.max(x - boxWidth / 2, 0), width - boxWidth);
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 rounded-btn border border-border bg-bg-sheet px-3 py-2 shadow-lg"
      style={{ left, width: boxWidth }}
    >
      {children}
    </div>
  );
}

/** Fila del globo: el valor manda, el nombre acompaña; clave de línea en el color de la serie. */
export function TooltipRow({ color, value, label }: { color?: string; value: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-caption leading-5">
      {color && (
        <span
          className="w-3 h-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color, boxShadow: isDarkColor(color) ? '0 0 0 1px #737373' : undefined }}
          aria-hidden="true"
        />
      )}
      <span className="font-mono tnum font-bold text-text w-6 text-right">{value}</span>
      <span className="text-text-2 truncate">{label}</span>
    </div>
  );
}
