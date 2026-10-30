import type { AppState, BackupFile } from '@/types/domain';
import { buildBackup, validateBackup } from '@/lib/backup';
import { migrateAppState } from '@/store/migrations';
import { rawStorage } from './persistence';

/**
 * Respaldos automáticos, en keys independientes del blob principal. Si el blob
 * se corrompe o una sesión lo arruina, estos snapshots son la vía de vuelta.
 */
const BOOT_KEY = 'miercoles-snapshot-boot';
const RING_KEYS = [
  'miercoles-snapshot-1',
  'miercoles-snapshot-2',
  'miercoles-snapshot-3',
] as const;

export type SnapshotReason = 'boot' | 'jornada' | 'import' | 'delete';

interface SnapshotRecord {
  reason: SnapshotReason;
  savedAt: string;
  backup: BackupFile;
}

export interface SnapshotInfo {
  key: string;
  reason: SnapshotReason;
  savedAt: string;
  teams: number;
  players: number;
  jornadas: number;
}

const REASON_LABEL: Record<SnapshotReason, string> = {
  boot: 'Al abrir la app',
  jornada: 'Al cerrar una jornada',
  import: 'Antes de importar un respaldo',
  delete: 'Antes de eliminar una competición',
};

export function snapshotReasonLabel(reason: SnapshotReason): string {
  return REASON_LABEL[reason] ?? 'Respaldo';
}

/** Un estado recién inicializado no vale la pena respaldar (ni pisar un snapshot bueno). */
function hasMeaningfulData(state: AppState): boolean {
  return Object.keys(state.teams).length > 0 || Object.keys(state.players).length > 0;
}

function makeRecord(state: AppState, reason: SnapshotReason): SnapshotRecord {
  return { reason, savedAt: new Date().toISOString(), backup: buildBackup(state) };
}

function isRecord(value: unknown): value is SnapshotRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Partial<SnapshotRecord>;
  return typeof r.savedAt === 'string' && typeof r.backup === 'object' && r.backup !== null;
}

let bootSnapshotWritten = false;

/**
 * Foto del estado tal como estaba al abrir la app, tomada después de hidratar
 * bien y antes de cualquier mutación. Es el seguro contra "la sesión de hoy
 * arruinó los datos".
 */
export async function writeBootSnapshot(state: AppState): Promise<void> {
  if (bootSnapshotWritten || !hasMeaningfulData(state)) return;
  bootSnapshotWritten = true;
  try {
    await rawStorage.set(BOOT_KEY, makeRecord(state, 'boot'));
  } catch {
    // Un snapshot que no se pudo guardar no debe romper el arranque.
  }
}

/** Buffer circular de 3: el más nuevo entra en el slot 1 y empuja al resto. */
export async function rotateSnapshot(state: AppState, reason: SnapshotReason): Promise<void> {
  if (!hasMeaningfulData(state)) return;
  try {
    const [first, second] = await Promise.all([
      rawStorage.get<SnapshotRecord>(RING_KEYS[0]),
      rawStorage.get<SnapshotRecord>(RING_KEYS[1]),
    ]);
    if (second) await rawStorage.set(RING_KEYS[2], second);
    if (first) await rawStorage.set(RING_KEYS[1], first);
    await rawStorage.set(RING_KEYS[0], makeRecord(state, reason));
  } catch {
    // idem: el respaldo es best-effort, nunca bloquea la acción del usuario.
  }
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const keys = [BOOT_KEY, ...RING_KEYS];
  const records = await Promise.all(
    keys.map(async (key) => {
      try {
        const value = await rawStorage.get<unknown>(key);
        return isRecord(value) ? ({ key, value } as const) : null;
      } catch {
        return null;
      }
    })
  );

  return records.flatMap((entry) => {
    if (!entry) return [];
    const data = entry.value.backup.data;
    return [
      {
        key: entry.key,
        reason: entry.value.reason,
        savedAt: entry.value.savedAt,
        teams: Object.keys(data?.teams ?? {}).length,
        players: Object.keys(data?.players ?? {}).length,
        jornadas: Object.keys(data?.jornadas ?? {}).length,
      },
    ];
  }).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Valida y migra antes de devolver: un snapshot viejo se trata como cualquier respaldo. */
export async function readSnapshot(key: string): Promise<AppState> {
  const value = await rawStorage.get<unknown>(key);
  if (!isRecord(value)) throw new Error('El respaldo automático no se pudo leer.');
  const backup = validateBackup(value.backup);
  return migrateAppState(backup.data);
}

export async function getSnapshotBackup(key: string): Promise<BackupFile> {
  const value = await rawStorage.get<unknown>(key);
  if (!isRecord(value)) throw new Error('El respaldo automático no se pudo leer.');
  return value.backup;
}

/**
 * ¿Arrancamos sin datos pero existe un respaldo que sí los tiene? Entonces esto
 * no es una instalación nueva: es una pérdida. Mostrar el Onboarding en ese caso
 * es justo lo que hacía que el usuario no se enterara de que se había quedado sin
 * jugadores.
 */
export async function looksLikeDataLoss(current: AppState): Promise<boolean> {
  if (hasMeaningfulData(current)) return false;
  const found = await listSnapshots();
  return found.some((s) => s.players > 0 || s.teams > 0);
}

export async function clearSnapshots(): Promise<void> {
  await Promise.all([BOOT_KEY, ...RING_KEYS].map((key) => rawStorage.remove(key)));
}
