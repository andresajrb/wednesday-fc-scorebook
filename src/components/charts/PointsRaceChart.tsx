import { useState } from 'react';
import type { PeriodSeries } from '@/store/season';
import {
  CHART,
  ChartTooltip,
  TooltipRow,
  isDarkColor,
  niceScale,
  shortDate,
  useChartWidth,
} from './chartKit';

const HEIGHT = 210;
const PAD = { top: 12, right: 84, bottom: 26, left: 28 };
const LABEL_GAP = 13;

/**
 * Puntos acumulados de cada equipo jornada a jornada: muestra cómo se llegó a la tabla
 * (quién arrancó adelante, quién alcanzó a quién). Una línea por equipo, en su color.
 */
export function PointsRaceChart({ series }: { series: PeriodSeries }) {
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const { teams, points } = series;
  const n = points.length;

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const maxPts = Math.max(0, ...points.flatMap((p) => Object.values(p.cumulative)));
  const scale = niceScale(maxPts);
  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => PAD.top + plotH - (v / scale.max) * plotH;
  const last = points[n - 1];

  // Etiquetas al final de cada línea; si chocan, se separan con una línea guía.
  const ends = teams
    .map((t) => ({ team: t, value: last.cumulative[t.id] ?? 0, y: y(last.cumulative[t.id] ?? 0) }))
    .sort((a, b) => a.y - b.y);
  const labelY = ends.map((e) => e.y);
  for (let i = 1; i < labelY.length; i++) labelY[i] = Math.max(labelY[i], labelY[i - 1] + LABEL_GAP);
  const overflow = labelY[labelY.length - 1] - (PAD.top + plotH);
  if (overflow > 0) for (let i = 0; i < labelY.length; i++) labelY[i] -= overflow;
  for (let i = labelY.length - 2; i >= 0; i--) labelY[i] = Math.min(labelY[i], labelY[i + 1] - LABEL_GAP);

  const indexAt = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * width;
    if (n === 1) return 0;
    return Math.min(n - 1, Math.max(0, Math.round(((px - PAD.left) / plotW) * (n - 1))));
  };

  const xLabels = n <= 6 ? points.map((_, i) => i) : [0, n - 1];
  const activePoint = active !== null ? points[active] : null;

  return (
    <div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 mb-2" aria-label="Leyenda">
        {teams.map((t) => (
          <li key={t.id} className="inline-flex items-center gap-1.5 text-caption text-text-2">
            <span
              className="w-3 h-0.5 rounded-full"
              style={{
                backgroundColor: t.color,
                boxShadow: isDarkColor(t.color) ? '0 0 0 1px #737373' : undefined,
              }}
              aria-hidden="true"
            />
            {t.name}
          </li>
        ))}
      </ul>
      <div ref={ref} className="relative" data-testid="points-race">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={`Puntos acumulados por jornada. Al final: ${ends
            .map((e) => `${e.team.name} ${e.value}`)
            .join(', ')}`}
          tabIndex={0}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded"
          onPointerMove={(e) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerDown={(e) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
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
          {xLabels.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor={n > 1 && i === n - 1 ? 'end' : n > 1 && i === 0 ? 'start' : 'middle'}
              fontSize={10}
              fill={CHART.axisText}
            >
              {shortDate(points[i].date)}
            </text>
          ))}

          {activePoint && (
            <line
              x1={x(active!)}
              x2={x(active!)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke={CHART.axisText}
              strokeWidth={1}
            />
          )}

          {teams.map((t) => {
            const d = points
              .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.cumulative[t.id] ?? 0)}`)
              .join(' ');
            const dark = isDarkColor(t.color);
            return (
              <g key={t.id}>
                {/* Un equipo negro no se ve sobre la superficie oscura: lleva un halo claro. */}
                {dark && (
                  <path d={d} fill="none" stroke="#737373" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
                )}
                <path d={d} fill="none" stroke={t.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}

          {ends.map((e, i) => {
            const dark = isDarkColor(e.team.color);
            const ex = x(n - 1);
            const moved = Math.abs(labelY[i] - e.y) > 2;
            return (
              <g key={e.team.id}>
                {moved && (
                  <line x1={ex + 5} y1={e.y} x2={ex + 12} y2={labelY[i]} stroke={CHART.axisText} strokeWidth={1} />
                )}
                <circle cx={ex} cy={e.y} r={4} fill={e.team.color} stroke={dark ? '#737373' : CHART.surface} strokeWidth={2} />
                <text x={ex + 14} y={labelY[i]} dy="0.32em" fontSize={11} fill={CHART.text}>
                  {e.team.name.length > 9 ? `${e.team.name.slice(0, 8)}…` : e.team.name}
                  <tspan fill={CHART.textMuted}> {e.value}</tspan>
                </text>
              </g>
            );
          })}

          {activePoint &&
            teams.map((t) => (
              <circle
                key={t.id}
                cx={x(active!)}
                cy={y(activePoint.cumulative[t.id] ?? 0)}
                r={4}
                fill={t.color}
                stroke={isDarkColor(t.color) ? '#737373' : CHART.surface}
                strokeWidth={2}
              />
            ))}
        </svg>

        {activePoint && (
          <ChartTooltip x={x(active!)} width={width}>
            <div className="text-caption font-semibold text-text mb-1">
              {shortDate(activePoint.date)} · jornada {active! + 1}
            </div>
            {[...teams]
              .sort((a, b) => (activePoint.cumulative[b.id] ?? 0) - (activePoint.cumulative[a.id] ?? 0))
              .map((t) => (
                <TooltipRow key={t.id} color={t.color} value={activePoint.cumulative[t.id] ?? 0} label={t.name} />
              ))}
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}
