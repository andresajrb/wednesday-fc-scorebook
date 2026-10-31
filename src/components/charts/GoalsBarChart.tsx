import { useState } from 'react';
import type { JornadaPoint } from '@/store/season';
import { CHART, ChartTooltip, TooltipRow, niceScale, shortDate, useChartWidth } from './chartKit';

const HEIGHT = 170;
const PAD = { top: 18, right: 8, bottom: 26, left: 28 };
const MAX_BAR = 24;
const GAP = 2;
/** Con más columnas que esto, el valor sobre cada barra se vuelve ruido: queda en el globo. */
const MAX_CAP_LABELS = 12;

/** Columna con las esquinas de arriba redondeadas y la base recta. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** Goles de cada jornada del período: si hubo jornadas más cerradas o más abiertas. */
export function GoalsBarChart({ points }: { points: JornadaPoint[] }) {
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const scale = niceScale(Math.max(0, ...points.map((p) => p.goals)));
  const slot = plotW / n;
  const barW = Math.max(2, Math.min(MAX_BAR, slot - GAP));
  const y = (v: number) => PAD.top + plotH - (v / scale.max) * plotH;
  const maxGoals = Math.max(...points.map((p) => p.goals));
  const xLabels = n <= 6 ? points.map((_, i) => i) : [0, n - 1];
  const activePoint = active !== null ? points[active] : null;

  return (
    <div ref={ref} className="relative" data-testid="goals-bars">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`Goles por jornada: ${points.map((p) => `${shortDate(p.date)} ${p.goals}`).join(', ')}`}
        tabIndex={0}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded"
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
          if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? n) - 1));
        }}
      >
        {scale.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke={CHART.grid} strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill={CHART.axisText}>
              {v}
            </text>
          </g>
        ))}

        {points.map((p, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const h = y(0) - y(p.goals);
          const showCap = p.goals > 0 && (n <= MAX_CAP_LABELS || p.goals === maxGoals);
          return (
            <g key={p.jornadaId}>
              {h > 0 && (
                <path
                  d={columnPath(cx - barW / 2, y(p.goals), barW, h)}
                  fill={CHART.accent}
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              )}
              {showCap && (
                <text x={cx} y={y(p.goals) - 5} textAnchor="middle" fontSize={10} fill={CHART.textMuted}>
                  {p.goals}
                </text>
              )}
              {/* Zona táctil: todo el ancho de la columna, más grande que la barra. */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              />
            </g>
          );
        })}

        {xLabels.map((i) => (
          <text
            key={i}
            x={PAD.left + slot * i + slot / 2}
            y={HEIGHT - 8}
            textAnchor={n > 6 ? (i === 0 ? 'start' : 'end') : 'middle'}
            fontSize={10}
            fill={CHART.axisText}
          >
            {shortDate(points[i].date)}
          </text>
        ))}
      </svg>

      {activePoint && (
        <ChartTooltip x={PAD.left + slot * active! + slot / 2} width={width}>
          <div className="text-caption font-semibold text-text mb-1">{shortDate(activePoint.date)}</div>
          <TooltipRow value={activePoint.goals} label={activePoint.goals === 1 ? 'gol' : 'goles'} />
          <TooltipRow
            value={activePoint.matches}
            label={activePoint.matches === 1 ? 'partida' : 'partidas'}
          />
        </ChartTooltip>
      )}
    </div>
  );
}
