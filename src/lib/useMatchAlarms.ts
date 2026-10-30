import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { fireAlert, setKeepScreenOn, WARNING_BEFORE_END_SECONDS, type AlertKind } from '@/lib/alerts';

/**
 * Si el aviso se cruzó hace más de esto (app en segundo plano, teléfono bloqueado),
 * ya no suena: una bocina a destiempo confunde más de lo que ayuda.
 */
const LATE_TOLERANCE_SECONDS = 10;
const TICK_MS = 500;

/**
 * Avisos ya resueltos por partida. Viven en sessionStorage para que recargar la app
 * justo después de la bocina no la haga sonar otra vez.
 */
const HANDLED_KEY = 'miercoles-alarms-handled';

function readHandled(matchId: string): Set<AlertKind> {
  try {
    const all = JSON.parse(sessionStorage.getItem(HANDLED_KEY) ?? '{}') as Record<string, AlertKind[]>;
    return new Set(all[matchId] ?? []);
  } catch {
    return new Set();
  }
}

function writeHandled(matchId: string, done: Set<AlertKind>): void {
  try {
    // Solo interesa la partida en curso: no acumulamos las viejas.
    sessionStorage.setItem(HANDLED_KEY, JSON.stringify({ [matchId]: [...done] }));
  } catch {
    // Sin sessionStorage, en el peor caso un aviso se repite tras recargar.
  }
}

/**
 * Vigila la partida en curso de cualquier jornada abierta, esté en la pantalla que esté el
 * usuario, y dispara el aviso de último minuto y la bocina final una sola vez.
 */
export function useMatchAlarms(): void {
  const state = useStore((s) => s.state);
  // Cualquier competición: puede haber una jornada abierta en cada una.
  const running = Object.values(state.matches).find(
    (m) =>
      state.jornadas[m.jornadaId]?.status === 'open' &&
      m.result === null &&
      !m.endedAt &&
      m.clockStartedAt
  );
  const { matchDurationSeconds, soundEnabled, vibrationEnabled, keepScreenOn } = state.config;
  const matchId = running?.id;
  const clockStartedAt = running?.clockStartedAt;

  useEffect(() => {
    setKeepScreenOn(!!matchId && keepScreenOn);
  }, [matchId, keepScreenOn]);

  useEffect(() => () => setKeepScreenOn(false), []);

  useEffect(() => {
    if (!matchId || !clockStartedAt) return;
    const start = new Date(clockStartedAt).getTime();
    const thresholds: Array<[AlertKind, number]> = [['end', matchDurationSeconds]];
    // En partidas muy cortas el aviso de último minuto sonaría casi al empezar.
    if (matchDurationSeconds > WARNING_BEFORE_END_SECONDS * 2) {
      thresholds.push(['warning', matchDurationSeconds - WARNING_BEFORE_END_SECONDS]);
    }
    const done = readHandled(matchId);

    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      for (const [kind, at] of thresholds) {
        if (done.has(kind) || elapsed < at) continue;
        done.add(kind);
        writeHandled(matchId, done);
        // Si ya pasó el final, el de último minuto sobra.
        if (kind === 'warning' && done.has('end')) continue;
        if (elapsed - at <= LATE_TOLERANCE_SECONDS) {
          fireAlert(kind, { sound: soundEnabled, vibration: vibrationEnabled });
        }
      }
    };
    // El final primero: si al volver ya pasaron ambos, solo cuenta la bocina.
    thresholds.sort((a, b) => b[1] - a[1]);
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [matchId, clockStartedAt, matchDurationSeconds, soundEnabled, vibrationEnabled]);
}
