export type ID = string;

export const SCHEMA_VERSION = 7;

export const DEFAULT_MATCH_DURATION_SECONDS = 7 * 60;

/** Una jornada se juega con 3 a 6 equipos: con 2 no hay rotación. */
export const MIN_JORNADA_TEAMS = 3;
export const MAX_JORNADA_TEAMS = 6;

/** Nombre de la competición donde quedan los datos de antes de v6. */
export const DEFAULT_COMPETITION_NAME = 'Miércoles';

/**
 * Competición: un grupo con sus propios equipos, jugadores y jornadas, totalmente
 * separado de los demás (p. ej. los miércoles y los sábados). La configuración es general.
 */
export interface Competition {
  id: ID;
  name: string;
  archived: boolean;
  createdAt: string;
  /** Último cambio del registro: decide qué versión gana al sincronizar. */
  updatedAt: string;
}

/** `guest`: equipo que viene a cubrir cuando uno fijo no puede. */
export type TeamKind = 'fixed' | 'guest';

export interface Team {
  id: ID;
  competitionId: ID;
  name: string;
  color: string;
  kind: TeamKind;
  /** Archivado: no aparece para jugar, pero su historial se conserva. */
  archived: boolean;
  createdAt: string;
  /** Último cambio del registro: decide qué versión gana al sincronizar. */
  updatedAt: string;
}

export interface Player {
  id: ID;
  name: string;
  teamId: ID;
  active: boolean;
  createdAt: string;
  /** Último cambio del registro: decide qué versión gana al sincronizar. */
  updatedAt: string;
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
  /**
   * En una competición en la nube, quién la anota (usuario de la nube). Los demás la ven
   * en vivo y pueden "tomar el control"; el servidor rechaza goles de cualquier otro.
   */
  scorerId?: ID;
  scorerName?: string;
  /** Último cambio del registro: decide qué versión gana al sincronizar. */
  updatedAt: string;
}

export interface Goal {
  id: ID;
  matchId: ID;
  /** undefined = gol sin asignar a un jugador específico (cuenta solo para el equipo). */
  playerId?: ID;
  scoringForTeamId: ID;
  isLoaned: boolean;
  createdAt: string;
  /** Último cambio del registro: decide qué versión gana al sincronizar. */
  updatedAt: string;
}

export type JornadaStatus = 'open' | 'closed';

export interface Jornada {
  id: ID;
  competitionId: ID;
  date: string;
  status: JornadaStatus;
  /** Equipos que asisten, en orden de llegada (= orden inicial de la cola). */
  teamIds: ID[];
  /**
   * Equipos que llegaron con la jornada en curso: cuántas partidas habían terminado
   * cuando se sumaron. Entran a la cola detrás de los que ya esperaban.
   */
  lateJoins?: Record<ID, number>;
  notes?: string;
  createdAt: string;
  /** Último cambio del registro: decide qué versión gana al sincronizar. */
  updatedAt: string;
  closedAt?: string;
}

/** Colecciones que se sincronizan registro a registro. */
export type SyncTable = 'competitions' | 'teams' | 'players' | 'jornadas' | 'matches' | 'goals';

export const SYNC_TABLES: readonly SyncTable[] = [
  'competitions',
  'teams',
  'players',
  'jornadas',
  'matches',
  'goals',
];

/**
 * Registro borrado. Las listas solo tienen lo vigente; la lápida queda para que los
 * otros dispositivos se enteren del borrado al sincronizar.
 */
export interface Tombstone {
  table: SyncTable;
  /** Competición a la que pertenecía: a qué grupo de la nube hay que avisarle. */
  competitionId: ID | null;
  deletedAt: string;
}

export interface AppConfig {
  onboardingDone: boolean;
  createdAt: string;
  autoAssignNextMatch: boolean;
  matchDurationSeconds: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  keepScreenOn: boolean;
  /** Mes (1-12) en que empieza la temporada. Sin valor = enero (año calendario). */
  seasonStartMonth?: number;
}

/**
 * Listas planas: `teams` y `jornadas` llevan su `competitionId`; jugadores, partidas y
 * goles la heredan. Es la misma forma que tendrá en un servidor. Las pantallas nunca leen
 * estas listas completas: usan la vista de la competición activa (`useScopedState`).
 */
export interface AppState {
  version: number;
  competitions: Record<ID, Competition>;
  activeCompetitionId: ID | null;
  teams: Record<ID, Team>;
  players: Record<ID, Player>;
  jornadas: Record<ID, Jornada>;
  matches: Record<ID, Match>;
  goals: Record<ID, Goal>;
  tombstones: Record<ID, Tombstone>;
  config: AppConfig;
}

export interface BackupFile {
  appName: 'miercoles-futbol';
  exportVersion: number;
  exportedAt: string;
  data: AppState;
}

export type Screen =
  | { name: 'onboarding'; newCompetitionName?: string }
  | { name: 'home' }
  | { name: 'jornada-setup' }
  | { name: 'season' }
  | { name: 'team-detail'; teamId: ID }
  | { name: 'jornada-active'; jornadaId: ID }
  | { name: 'match-record'; matchId: ID }
  | { name: 'summary'; jornadaId: ID }
  | { name: 'settings'; section?: 'cloud' };
