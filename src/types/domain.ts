export type ID = string;

export const SCHEMA_VERSION = 4;

export const DEFAULT_MATCH_DURATION_SECONDS = 7 * 60;

export interface Team {
  id: ID;
  name: string;
  color: string;
  createdAt: string;
}

export interface Player {
  id: ID;
  name: string;
  teamId: ID;
  active: boolean;
  createdAt: string;
}

export type MatchType = 'first' | 'normal';
export type MatchResult = 'A' | 'B' | 'draw' | null;

export interface MatchRosterEntry {
  playerId: ID;
  borrowedFromTeamId?: ID;
}

export interface Match {
  id: ID;
  jornadaId: ID;
  order: number;
  teamAId: ID;
  teamBId: ID;
  type: MatchType;
  goalLimit: number;
  result: MatchResult;
  drawWinnerNext?: ID;
  rosterA: MatchRosterEntry[];
  rosterB: MatchRosterEntry[];
  /** Cuándo se creó el match (los equipos quedaron elegidos). */
  startedAt: string;
  /**
   * Cuándo arrancó efectivamente el cronómetro. Si está vacío, el cronómetro no se inició
   * (el usuario aún no tocó "Listo, empezar"). Se llena al tocar el botón.
   */
  clockStartedAt?: string;
  endedAt?: string;
}

export interface Goal {
  id: ID;
  matchId: ID;
  /** undefined = gol sin asignar a un jugador específico (cuenta solo para el equipo). */
  playerId?: ID;
  scoringForTeamId: ID;
  isLoaned: boolean;
  createdAt: string;
}

export type JornadaStatus = 'open' | 'closed';

export interface Jornada {
  id: ID;
  date: string;
  status: JornadaStatus;
  notes?: string;
  createdAt: string;
  closedAt?: string;
}

export interface AppConfig {
  onboardingDone: boolean;
  createdAt: string;
  autoAssignNextMatch: boolean;
  matchDurationSeconds: number;
}

export interface AppState {
  version: number;
  teams: Record<ID, Team>;
  players: Record<ID, Player>;
  jornadas: Record<ID, Jornada>;
  matches: Record<ID, Match>;
  goals: Record<ID, Goal>;
  config: AppConfig;
}

export interface BackupFile {
  appName: 'miercoles-futbol';
  exportVersion: number;
  exportedAt: string;
  data: AppState;
}

export type Screen =
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'team-detail'; teamId: ID }
  | { name: 'jornada-active'; jornadaId: ID }
  | { name: 'match-record'; matchId: ID }
  | { name: 'summary'; jornadaId: ID }
  | { name: 'settings' };
