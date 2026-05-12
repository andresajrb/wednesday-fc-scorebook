import { cn } from '@/lib/cn';

interface MatchClockProps {
  elapsedSeconds: number;
  durationSeconds: number;
  isRunning: boolean;
}

interface ClockStyle {
  textColor: string;
  bgColor: string;
  borderColor: string;
  shadow: string;
  pulse: boolean;
  label: string;
}

function getClockStyle(elapsed: number, duration: number): ClockStyle {
  const remaining = duration - elapsed;
  if (elapsed >= duration) {
    return {
      textColor: '#ffffff',
      bgColor: '#ef4444',
      borderColor: '#ffffff',
      shadow: '0 0 24px rgba(239,68,68,0.65)',
      pulse: true,
      label: 'Tiempo excedido',
    };
  }
  if (remaining <= 30) {
    return {
      textColor: '#ffffff',
      bgColor: '#ef4444',
      borderColor: 'rgba(239,68,68,0.5)',
      shadow: '0 0 16px rgba(239,68,68,0.45)',
      pulse: false,
      label: 'Últimos 30s',
    };
  }
  const pct = elapsed / Math.max(1, duration);
  if (pct >= 0.75) {
    return {
      textColor: '#fdf2f8',
      bgColor: '#ec4899',
      borderColor: 'rgba(236,72,153,0.5)',
      shadow: '0 0 12px rgba(236,72,153,0.35)',
      pulse: false,
      label: 'Recta final',
    };
  }
  if (pct >= 0.5) {
    return {
      textColor: '#0a0a0a',
      bgColor: '#f59e0b',
      borderColor: 'rgba(245,158,11,0.55)',
      shadow: '0 0 10px rgba(245,158,11,0.35)',
      pulse: false,
      label: 'Mitad de partida',
    };
  }
  if (pct >= 0.25) {
    return {
      textColor: '#0a0a0a',
      bgColor: '#22c55e',
      borderColor: 'rgba(34,197,94,0.45)',
      shadow: '0 0 8px rgba(34,197,94,0.3)',
      pulse: false,
      label: 'En juego',
    };
  }
  return {
    textColor: '#0a0a0a',
    bgColor: '#fafafa',
    borderColor: 'rgba(255,255,255,0.25)',
    shadow: 'none',
    pulse: false,
    label: 'Arranque',
  };
}

function format(elapsed: number): string {
  const safe = Math.max(0, Math.floor(elapsed));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MatchClock({ elapsedSeconds, durationSeconds, isRunning }: MatchClockProps) {
  const style = getClockStyle(elapsedSeconds, durationSeconds);
  const exceeded = elapsedSeconds >= durationSeconds;
  return (
    <div
      className={cn(
        'inline-flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl border-2 transition-colors',
        style.pulse && 'animate-pulse-dot'
      )}
      style={{
        backgroundColor: style.bgColor,
        borderColor: style.borderColor,
        boxShadow: style.shadow !== 'none' ? style.shadow : undefined,
        color: style.textColor,
      }}
      role="timer"
      aria-label={`Tiempo de juego: ${format(elapsedSeconds)}`}
    >
      <span className="font-mono tnum font-bold text-[26px] leading-none">
        {format(elapsedSeconds)}
      </span>
      <span
        className="text-[10px] uppercase tracking-wider font-semibold leading-none"
        style={{ color: style.textColor, opacity: 0.85 }}
      >
        {isRunning ? style.label : exceeded ? 'Detenido (excedido)' : 'Detenido'}
      </span>
    </div>
  );
}
