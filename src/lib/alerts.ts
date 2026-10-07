/**
 * Avisos de tiempo: bocina sintetizada con Web Audio (sin archivos, funciona offline),
 * vibración y Wake Lock. Los navegadores bloquean el audio hasta que hay un toque del
 * usuario, así que `unlockAudio` se llama desde "Listo, empezar".
 */

export type AlertKind = 'warning' | 'end';

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: AudioContextCtor | undefined =
    typeof window !== 'undefined'
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
      : undefined;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Debe llamarse dentro de un gesto del usuario (click/tap). */
export function unlockAudio(): void {
  const audio = getContext();
  if (!audio) return;
  try {
    if (audio.state === 'suspended') void audio.resume();
    // Un buffer mudo termina de "abrir" el audio en Safari.
    const buffer = audio.createBuffer(1, 1, 22050);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.start(0);
  } catch {
    // Sin audio no hay bocina, pero el reloj sigue funcionando.
  }
}

// Si la app se recargó con una partida corriendo, nadie va a tocar "Listo, empezar":
// cualquier toque sirve para dejar el audio listo para la bocina.
if (typeof document !== 'undefined') {
  const onGesture = () => {
    if (!ctx || ctx.state !== 'running') unlockAudio();
  };
  document.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
}

function blast(audio: AudioContext, start: number, duration: number, freqs: number[], volume: number) {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.setValueAtTime(volume, start + duration - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  gain.connect(audio.destination);
  for (const freq of freqs) {
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

function playSound(kind: AlertKind): void {
  const audio = getContext();
  if (!audio) return;
  try {
    if (audio.state === 'suspended') void audio.resume();
    const t = audio.currentTime + 0.05;
    if (kind === 'warning') {
      // Dos pitidos cortos: "último minuto".
      blast(audio, t, 0.18, [880], 0.25);
      blast(audio, t + 0.3, 0.18, [880], 0.25);
    } else {
      // Bocina: tres toques, el último largo.
      const horn = [349, 440, 523];
      blast(audio, t, 0.35, horn, 0.22);
      blast(audio, t + 0.5, 0.35, horn, 0.22);
      blast(audio, t + 1.0, 1.1, horn, 0.22);
    }
  } catch {
    // idem
  }
}

const VIBRATION: Record<AlertKind, number[]> = {
  warning: [200, 120, 200],
  end: [400, 150, 400, 150, 900],
};

function vibrate(kind: AlertKind): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(VIBRATION[kind]);
    }
  } catch {
    // iOS Safari no tiene vibración.
  }
}

export function fireAlert(kind: AlertKind, opts: { sound: boolean; vibration: boolean }): void {
  if (opts.sound) playSound(kind);
  if (opts.vibration) vibrate(kind);
}

export function playTestAlert(opts: { sound: boolean; vibration: boolean }): void {
  unlockAudio();
  fireAlert('end', opts);
}

/** Segundos antes del final en que suena el aviso de "último minuto". */
export const WARNING_BEFORE_END_SECONDS = 60;

/** Bloqueo de pantalla. Se pierde al pasar a segundo plano y hay que volver a pedirlo. */
type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };

let sentinel: WakeLockSentinelLike | null = null;
let wanted = false;

async function acquire(): Promise<void> {
  const wakeLock = (navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
  }).wakeLock;
  if (!wakeLock || (sentinel && !sentinel.released)) return;
  try {
    sentinel = await wakeLock.request('screen');
    // Si mientras esperábamos ya no hacía falta, lo soltamos de inmediato.
    if (!wanted) await releaseSentinel();
  } catch {
    sentinel = null;
  }
}

async function releaseSentinel(): Promise<void> {
  const current = sentinel;
  sentinel = null;
  try {
    await current?.release();
  } catch {
    // idem
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted) void acquire();
  });
}

export function setKeepScreenOn(on: boolean): void {
  if (on === wanted) return;
  wanted = on;
  if (on) void acquire();
  else void releaseSentinel();
}

export function isScreenLockHeld(): boolean {
  return !!sentinel && !sentinel.released;
}
