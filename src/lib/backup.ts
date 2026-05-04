import type { AppState, BackupFile } from '@/types/domain';
import { SCHEMA_VERSION } from '@/types/domain';
import { migrateAppState } from '@/store/migrations';

const APP_NAME = 'miercoles-futbol' as const;

export function buildBackup(state: AppState): BackupFile {
  return {
    appName: APP_NAME,
    exportVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: state,
  };
}

export function downloadBackup(state: AppState): void {
  const backup = buildBackup(state);
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `miercoles-futbol-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function validateBackup(input: unknown): BackupFile {
  if (!isObj(input)) throw new BackupError('Archivo no es un objeto JSON válido.');
  if (input.appName !== APP_NAME) {
    throw new BackupError('Este archivo no es un respaldo de Miércoles de Fútbol.');
  }
  if (typeof input.exportVersion !== 'number') {
    throw new BackupError('Falta el campo "exportVersion".');
  }
  if (input.exportVersion > SCHEMA_VERSION) {
    throw new BackupError(
      'Este respaldo viene de una versión más nueva de la app. Actualiza la app.'
    );
  }
  if (!isObj(input.data)) throw new BackupError('Datos del respaldo inválidos.');
  const data = input.data;
  for (const key of ['teams', 'players', 'matches', 'goals', 'jornadas', 'config']) {
    if (!(key in data)) throw new BackupError(`Falta la sección "${key}" en el respaldo.`);
  }
  if (typeof data.version !== 'number') {
    throw new BackupError('Falta versión del estado.');
  }
  // Integridad referencial básica
  const players = data.players as Record<string, { id: string; teamId: string }>;
  const teams = data.teams as Record<string, { id: string }>;
  const matches = data.matches as Record<
    string,
    { id: string; teamAId: string; teamBId: string; jornadaId: string }
  >;
  const goals = data.goals as Record<
    string,
    { id: string; matchId: string; playerId?: string; scoringForTeamId: string }
  >;
  const jornadas = data.jornadas as Record<string, { id: string }>;
  for (const p of Object.values(players)) {
    if (!teams[p.teamId]) {
      throw new BackupError(`Jugador con teamId desconocido: ${p.teamId}.`);
    }
  }
  for (const m of Object.values(matches)) {
    if (!teams[m.teamAId] || !teams[m.teamBId] || !jornadas[m.jornadaId]) {
      throw new BackupError('Partida con referencias inválidas.');
    }
  }
  for (const g of Object.values(goals)) {
    if (!matches[g.matchId] || !teams[g.scoringForTeamId]) {
      throw new BackupError('Gol con referencias inválidas.');
    }
    if (g.playerId && !players[g.playerId]) {
      throw new BackupError('Gol con jugador desconocido.');
    }
  }
  return input as unknown as BackupFile;
}

export async function readBackupFile(file: File): Promise<BackupFile> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('El archivo no es JSON válido.');
  }
  const backup = validateBackup(parsed);
  const migrated = migrateAppState(backup.data);
  return { ...backup, data: migrated };
}
