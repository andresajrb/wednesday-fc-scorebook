import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AppConfig,
  AppState,
  Competition,
  ID,
  Match,
  MatchRosterEntry,
  Screen,
  Team,
  TeamKind,
} from '@/types/domain';
import {
  DEFAULT_COMPETITION_NAME,
  DEFAULT_MATCH_DURATION_SECONDS,
  MAX_JORNADA_TEAMS,
  SCHEMA_VERSION,
} from '@/types/domain';
import {
  localforageStorage,
  clearStorage,
  clearHydrationFailure,
  consumeHydrationError,
  hydrationFailed,
  isApplyingRemoteChange,
  reportHydrationError,
  setApplyingRemoteChange,
  subscribeHydrationError,
  subscribeRemoteChange,
  subscribeWriteError,
  unlockWrites,
  writesAreLocked,
  type HydrateError,
  type WriteError,
} from './persistence';
import { clearSnapshots, looksLikeDataLoss, rotateSnapshot, writeBootSnapshot } from './snapshots';
import { migrateAppState } from './migrations';
import { activeScope, playerCompetition } from './scope';
import { todayISODate } from '@/lib/format';

const newId = (): ID =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const nowISO = () => new Date().toISOString();

interface NavStackEntry {
  screen: Screen;
}

interface StoreData {
  state: AppState;
  ui: {
    currentScreen: Screen;
    history: NavStackEntry[];
  };
  hydrateError: HydrateError | null;
  /** Falso hasta que la hidratación termina (con o sin error). Ninguna pantalla se
   *  monta antes: renderizar con el estado inicial vacío es lo que provocaba el
   *  flash de Onboarding y, con él, la pérdida de datos. */
  hydrationSettled: boolean;
  writeError: WriteError | null;
}

interface StoreActions {
  // Onboarding
  completeOnboarding(
    teams: Array<{ name: string; color: string }>,
    opts?: { competitionName?: string; imports?: TeamImport[] }
  ): void;

  // Competiciones
  setActiveCompetition(competitionId: ID): void;
  renameCompetition(competitionId: ID, name: string): void;
  setCompetitionArchived(competitionId: ID, archived: boolean): void;
  deleteCompetition(competitionId: ID): Promise<void>;
  importTeams(imports: TeamImport[]): void;

  // Teams
  createTeam(input: { name: string; color: string; kind: TeamKind }): ID;
  renameTeam(teamId: ID, name: string): void;
  setTeamColor(teamId: ID, hex: string): void;
  setTeamKind(teamId: ID, kind: TeamKind): void;
  setTeamArchived(teamId: ID, archived: boolean): void;

  // Players
  addPlayer(name: string, teamId: ID): ID;
  movePlayer(playerId: ID, toTeamId: ID): void;
  setPlayerActive(playerId: ID, active: boolean): void;
  renamePlayer(playerId: ID, name: string): void;

  // Jornadas
  startJornada(teamIds: ID[]): ID;
  addTeamToJornada(jornadaId: ID, teamId: ID): void;
  removeTeamFromJornada(jornadaId: ID, teamId: ID): void;
  closeJornada(jornadaId: ID): void;
  reopenJornada(jornadaId: ID): void;

  // Matches
  startMatch(jornadaId: ID, teamAId: ID, teamBId: ID): ID;
  addToRoster(matchId: ID, side: 'A' | 'B', entry: MatchRosterEntry): void;
  finishMatch(matchId: ID, drawWinnerNext?: ID): void;
  cancelMatch(matchId: ID): void;
  startMatchClock(matchId: ID): void;

  // Goals
  addGoal(
    matchId: ID,
    playerId: ID | null,
    scoringForTeamId: ID,
    isLoaned: boolean
  ): ID;
  removeGoal(goalId: ID): void;
  reassignGoal(
    goalId: ID,
    opts: { playerId: ID | null; scoringForTeamId: ID; isLoaned: boolean }
  ): void;

  // Settings
  setAutoAssignNextMatch(value: boolean): void;
  setMatchDurationSeconds(value: number): void;
  setSeasonStartMonth(month: number): void;
  setAlertConfig(
    patch: Partial<Pick<AppConfig, 'soundEnabled' | 'vibrationEnabled' | 'keepScreenOn'>>
  ): void;

  // Edit
  reopenMatch(matchId: ID): void;

  // Backup / reset
  replaceState(next: AppState): void;
  resetAll(): Promise<void>;

  // Hydration
  setHydrateError(err: HydrateError | null): void;
  clearHydrateError(): void;
  clearWriteError(): void;

  // Navigation
  navigate(screen: Screen, opts?: { replace?: boolean }): void;
  back(): void;
  resetNavigationToHome(): void;
}

type Store = StoreData & StoreActions;

/** Equipo de otra competición a copiar (con sus jugadores activos, sin historial). */
export interface TeamImport {
  teamId: ID;
  name: string;
}

/** Por qué no se puede archivar o eliminar una competición, o null si se puede. */
export function competitionLockReason(state: AppState, competitionId: ID): string | null {
  const competition = state.competitions[competitionId];
  if (!competition) return 'La competición no existe.';
  const hasOpenJornada = Object.values(state.jornadas).some(
    (j) => j.competitionId === competitionId && j.status === 'open'
  );
  if (hasOpenJornada) return 'Tiene una jornada abierta: ciérrala primero.';
  const visible = Object.values(state.competitions).filter((c) => !c.archived);
  if (!competition.archived && visible.length <= 1) {
    return 'Es la única competición activa: siempre tiene que quedar al menos una.';
  }
  return null;
}

/** Hay que pasar por el onboarding si no hay competición activa o no tiene equipos. */
export function needsOnboarding(state: AppState): boolean {
  const activeId = state.activeCompetitionId;
  if (!activeId || !state.competitions[activeId]) return true;
  return !Object.values(state.teams).some((t) => t.competitionId === activeId);
}

function makeInitialState(): AppState {
  return {
    version: SCHEMA_VERSION,
    competitions: {},
    activeCompetitionId: null,
    teams: {},
    players: {},
    jornadas: {},
    matches: {},
    goals: {},
    config: {
      onboardingDone: false,
      createdAt: nowISO(),
      autoAssignNextMatch: true,
      matchDurationSeconds: DEFAULT_MATCH_DURATION_SECONDS,
      soundEnabled: true,
      vibrationEnabled: true,
      keepScreenOn: true,
    },
  };
}

function makeTeam(
  input: { name: string; color: string; kind?: TeamKind },
  competitionId: ID
): Team {
  return {
    id: newId(),
    competitionId,
    name: input.name,
    color: input.color,
    kind: input.kind ?? 'fixed',
    archived: false,
    createdAt: nowISO(),
  };
}

function makeCompetition(name: string): Competition {
  return { id: newId(), name, archived: false, createdAt: nowISO() };
}

/**
 * Copia equipos de otra competición con sus jugadores activos. Son registros nuevos e
 * independientes: no arrastran historial ni quedan atados al original.
 */
function copyTeams(
  state: AppState,
  imports: TeamImport[],
  competitionId: ID
): Pick<AppState, 'teams' | 'players'> {
  const teams = { ...state.teams };
  const players = { ...state.players };
  for (const { teamId, name } of imports) {
    const source = state.teams[teamId];
    if (!source || source.competitionId === competitionId) continue;
    const team: Team = { ...makeTeam(source, competitionId), name: name.trim() || source.name };
    teams[team.id] = team;
    for (const p of Object.values(state.players)) {
      if (p.teamId !== teamId || !p.active) continue;
      const id = newId();
      players[id] = { id, name: p.name, teamId: team.id, active: true, createdAt: nowISO() };
    }
  }
  return { teams, players };
}

function homeScreen(state: AppState): Screen {
  return needsOnboarding(state) ? { name: 'onboarding' } : { name: 'home' };
}

function makeInitialUI(state: AppState): StoreData['ui'] {
  return { currentScreen: homeScreen(state), history: [] };
}

function firstVisible(competitions: Record<ID, Competition>): ID | null {
  return (
    Object.values(competitions)
      .filter((c) => !c.archived)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id ?? null
  );
}

function omit<T extends { id: ID }>(records: Record<ID, T>, drop: (r: T) => boolean): Record<ID, T> {
  const out: Record<ID, T> = {};
  for (const r of Object.values(records)) if (!drop(r)) out[r.id] = r;
  return out;
}

/** Competición de una jornada; null si no existe. */
function jornadaCompetition(state: AppState, jornadaId: ID): ID | null {
  return state.jornadas[jornadaId]?.competitionId ?? null;
}

function matchCompetition(state: AppState, matchId: ID): ID | null {
  const m = state.matches[matchId];
  return m ? jornadaCompetition(state, m.jornadaId) : null;
}

const initialState = makeInitialState();

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      state: initialState,
      ui: makeInitialUI(initialState),
      hydrateError: null,
      hydrationSettled: false,
      writeError: null,

      setHydrateError: (err) => set(() => ({ hydrateError: err })),
      clearHydrateError: () => set(() => ({ hydrateError: null })),
      clearWriteError: () => set(() => ({ writeError: null })),

      completeOnboarding: (teamsInput, opts = {}) =>
        set((s) => {
          let competitions = s.state.competitions;
          let activeId = s.state.activeCompetitionId;
          // Competición nueva (desde el selector) o primera instalación.
          if (opts.competitionName || !activeId || !competitions[activeId]) {
            const competition = makeCompetition(
              opts.competitionName?.trim() || DEFAULT_COMPETITION_NAME
            );
            competitions = { ...competitions, [competition.id]: competition };
            activeId = competition.id;
          }
          const competitionId: ID = activeId;

          const teams = { ...s.state.teams };
          const existing = Object.values(teams)
            .filter((t) => t.competitionId === competitionId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          // Ya hay equipos: renombrar y recolorear los que están, nunca generar IDs nuevos.
          // Regenerarlos dejaba a todos los jugadores apuntando a equipos inexistentes,
          // o sea invisibles en toda la app.
          existing.forEach((team, i) => {
            const input = teamsInput[i];
            if (input) teams[team.id] = { ...team, name: input.name, color: input.color };
          });
          for (const input of teamsInput.slice(existing.length)) {
            const team = makeTeam(input, competitionId);
            teams[team.id] = team;
          }

          const withTeams = { ...s.state, teams };
          const copied = copyTeams(withTeams, opts.imports ?? [], competitionId);
          const next: AppState = {
            ...withTeams,
            ...copied,
            competitions,
            activeCompetitionId: competitionId,
            config: { ...s.state.config, onboardingDone: true },
          };
          return { state: next, ui: { currentScreen: { name: 'home' }, history: [] } };
        }),

      setActiveCompetition: (competitionId) =>
        set((s) => {
          const competition = s.state.competitions[competitionId];
          if (!competition || competition.archived) return s;
          const next = { ...s.state, activeCompetitionId: competitionId };
          // Las pantallas abiertas apuntan a datos de la otra competición: se vuelve al inicio.
          return { state: next, ui: makeInitialUI(next) };
        }),

      renameCompetition: (competitionId, name) =>
        set((s) => {
          const competition = s.state.competitions[competitionId];
          const trimmed = name.trim();
          if (!competition || !trimmed) return s;
          return {
            state: {
              ...s.state,
              competitions: {
                ...s.state.competitions,
                [competitionId]: { ...competition, name: trimmed },
              },
            },
          };
        }),

      setCompetitionArchived: (competitionId, archived) =>
        set((s) => {
          const competition = s.state.competitions[competitionId];
          if (!competition || competition.archived === archived) return s;
          if (archived && competitionLockReason(s.state, competitionId)) return s;
          const competitions = {
            ...s.state.competitions,
            [competitionId]: { ...competition, archived },
          };
          let activeId = s.state.activeCompetitionId;
          if (archived && activeId === competitionId) activeId = firstVisible(competitions);
          const next = { ...s.state, competitions, activeCompetitionId: activeId };
          return activeId === s.state.activeCompetitionId
            ? { state: next }
            : { state: next, ui: makeInitialUI(next) };
        }),

      deleteCompetition: async (competitionId) => {
        if (competitionLockReason(get().state, competitionId)) return;
        // Borrar es irreversible: antes queda una copia en los respaldos automáticos.
        await rotateSnapshot(get().state, 'delete');
        set((s) => {
          const st = s.state;
          if (!st.competitions[competitionId] || competitionLockReason(st, competitionId)) return s;
          const teams = omit(st.teams, (t) => t.competitionId === competitionId);
          const jornadas = omit(st.jornadas, (j) => j.competitionId === competitionId);
          const players = omit(st.players, (p) => !teams[p.teamId]);
          const matches = omit(st.matches, (m) => !jornadas[m.jornadaId]);
          const goals = omit(st.goals, (g) => !matches[g.matchId]);
          const competitions = { ...st.competitions };
          delete competitions[competitionId];
          let activeId = st.activeCompetitionId;
          if (activeId === competitionId) activeId = firstVisible(competitions);
          const next: AppState = {
            ...st,
            competitions,
            activeCompetitionId: activeId,
            teams,
            players,
            jornadas,
            matches,
            goals,
          };
          return activeId === st.activeCompetitionId
            ? { state: next }
            : { state: next, ui: makeInitialUI(next) };
        });
      },

      importTeams: (imports) =>
        set((s) => {
          const activeId = s.state.activeCompetitionId;
          if (!activeId) return s;
          return { state: { ...s.state, ...copyTeams(s.state, imports, activeId) } };
        }),

      createTeam: (input) => {
        const activeId = get().state.activeCompetitionId;
        if (!activeId) return '';
        const team = makeTeam({ ...input, name: input.name.trim() }, activeId);
        set((s) => ({
          state: { ...s.state, teams: { ...s.state.teams, [team.id]: team } },
        }));
        return team.id;
      },

      setTeamKind: (teamId, kind) =>
        set((s) => {
          const team = s.state.teams[teamId];
          if (!team) return s;
          return {
            state: { ...s.state, teams: { ...s.state.teams, [teamId]: { ...team, kind } } },
          };
        }),

      setTeamArchived: (teamId, archived) =>
        set((s) => {
          const team = s.state.teams[teamId];
          if (!team) return s;
          return {
            state: { ...s.state, teams: { ...s.state.teams, [teamId]: { ...team, archived } } },
          };
        }),

      renameTeam: (teamId, name) =>
        set((s) => ({
          state: {
            ...s.state,
            teams: {
              ...s.state.teams,
              [teamId]: { ...s.state.teams[teamId], name },
            },
          },
        })),

      setTeamColor: (teamId, hex) =>
        set((s) => ({
          state: {
            ...s.state,
            teams: {
              ...s.state.teams,
              [teamId]: { ...s.state.teams[teamId], color: hex },
            },
          },
        })),

      addPlayer: (name, teamId) => {
        const id = newId();
        set((s) => ({
          state: {
            ...s.state,
            players: {
              ...s.state.players,
              [id]: {
                id,
                name: name.trim(),
                teamId,
                active: true,
                createdAt: nowISO(),
              },
            },
          },
        }));
        return id;
      },

      movePlayer: (playerId, toTeamId) =>
        set((s) => {
          // Un jugador nunca cruza de competición: cada una está totalmente separada.
          const target = s.state.teams[toTeamId];
          if (!target || playerCompetition(s.state, playerId) !== target.competitionId) return s;
          return {
            state: {
              ...s.state,
              players: {
                ...s.state.players,
                [playerId]: { ...s.state.players[playerId], teamId: toTeamId },
              },
            },
          };
        }),

      setPlayerActive: (playerId, active) =>
        set((s) => ({
          state: {
            ...s.state,
            players: {
              ...s.state.players,
              [playerId]: { ...s.state.players[playerId], active },
            },
          },
        })),

      renamePlayer: (playerId, name) =>
        set((s) => ({
          state: {
            ...s.state,
            players: {
              ...s.state.players,
              [playerId]: { ...s.state.players[playerId], name: name.trim() },
            },
          },
        })),

      startJornada: (teamIds) => {
        const competitionId = get().state.activeCompetitionId;
        if (!competitionId) return '';
        const id = newId();
        const date = todayISODate();
        set((s) => ({
          state: {
            ...s.state,
            jornadas: {
              ...s.state.jornadas,
              [id]: {
                id,
                competitionId,
                date,
                status: 'open',
                teamIds: [...new Set(teamIds)]
                  .filter((t) => s.state.teams[t]?.competitionId === competitionId)
                  .slice(0, MAX_JORNADA_TEAMS),
                createdAt: nowISO(),
              },
            },
          },
        }));
        return id;
      },

      addTeamToJornada: (jornadaId, teamId) =>
        set((s) => {
          const j = s.state.jornadas[jornadaId];
          const team = s.state.teams[teamId];
          if (!j || !team || j.teamIds.includes(teamId)) return s;
          if (team.competitionId !== j.competitionId) return s;
          if (j.teamIds.length >= MAX_JORNADA_TEAMS) return s;
          // Llega tarde: se forma detrás de los que ya esperaban al terminar la última
          // partida. Si todavía no se jugó ninguna, es como si hubiera llegado a tiempo.
          const finishedOrders = Object.values(s.state.matches)
            .filter((m) => m.jornadaId === jornadaId && m.endedAt && m.result !== null)
            .map((m) => m.order);
          const after = finishedOrders.length > 0 ? Math.max(...finishedOrders) : 0;
          const lateJoins = { ...(j.lateJoins ?? {}) };
          if (after > 0) lateJoins[teamId] = after;
          return {
            state: {
              ...s.state,
              jornadas: {
                ...s.state.jornadas,
                [jornadaId]: {
                  ...j,
                  teamIds: [...j.teamIds, teamId],
                  ...(Object.keys(lateJoins).length > 0 ? { lateJoins } : {}),
                },
              },
            },
          };
        }),

      removeTeamFromJornada: (jornadaId, teamId) =>
        set((s) => {
          const j = s.state.jornadas[jornadaId];
          if (!j) return s;
          // Solo se puede quitar a un equipo que no jugó: sacarlo después dejaría
          // partidas de la tabla sin dueño.
          const played = Object.values(s.state.matches).some(
            (m) => m.jornadaId === jornadaId && (m.teamAId === teamId || m.teamBId === teamId)
          );
          if (played) return s;
          const lateJoins = { ...(j.lateJoins ?? {}) };
          delete lateJoins[teamId];
          const { lateJoins: _omit, ...rest } = j;
          void _omit;
          return {
            state: {
              ...s.state,
              jornadas: {
                ...s.state.jornadas,
                [jornadaId]: {
                  ...rest,
                  teamIds: j.teamIds.filter((t) => t !== teamId),
                  ...(Object.keys(lateJoins).length > 0 ? { lateJoins } : {}),
                },
              },
            },
          };
        }),

      closeJornada: (jornadaId) => {
        set((s) => {
          const j = s.state.jornadas[jornadaId];
          if (!j) return s;
          return {
            state: {
              ...s.state,
              jornadas: {
                ...s.state.jornadas,
                [jornadaId]: { ...j, status: 'closed', closedAt: nowISO() },
              },
            },
          };
        });
        // Cerrar la jornada es el hito natural del día: buen momento para rotar
        // el respaldo automático.
        void rotateSnapshot(get().state, 'jornada');
      },

      reopenJornada: (jornadaId) =>
        set((s) => {
          const j = s.state.jornadas[jornadaId];
          if (!j) return s;
          return {
            state: {
              ...s.state,
              jornadas: {
                ...s.state.jornadas,
                [jornadaId]: { ...j, status: 'open', closedAt: undefined },
              },
            },
          };
        }),

      startMatch: (jornadaId, teamAId, teamBId) => {
        const st = get().state;
        const competitionId = jornadaCompetition(st, jornadaId);
        if (
          !competitionId ||
          st.teams[teamAId]?.competitionId !== competitionId ||
          st.teams[teamBId]?.competitionId !== competitionId
        ) {
          return '';
        }
        const id = newId();
        const existing = Object.values(get().state.matches).filter(
          (m) => m.jornadaId === jornadaId
        );
        const order = existing.length + 1;
        const isFirst = order === 1;
        const players = Object.values(get().state.players).filter((p) => p.active);
        const rosterA: MatchRosterEntry[] = players
          .filter((p) => p.teamId === teamAId)
          .map((p) => ({ playerId: p.id }));
        const rosterB: MatchRosterEntry[] = players
          .filter((p) => p.teamId === teamBId)
          .map((p) => ({ playerId: p.id }));
        const match: Match = {
          id,
          jornadaId,
          order,
          teamAId,
          teamBId,
          type: isFirst ? 'first' : 'normal',
          goalLimit: isFirst ? 2 : 1,
          result: null,
          rosterA,
          rosterB,
          startedAt: nowISO(),
        };
        set((s) => ({
          state: { ...s.state, matches: { ...s.state.matches, [id]: match } },
        }));
        return id;
      },

      addToRoster: (matchId, side, entry) =>
        set((s) => {
          const m = s.state.matches[matchId];
          if (!m) return s;
          // Solo se presta a jugadores de la misma competición.
          if (playerCompetition(s.state, entry.playerId) !== matchCompetition(s.state, matchId)) {
            return s;
          }
          const key = side === 'A' ? 'rosterA' : 'rosterB';
          if (m[key].some((e) => e.playerId === entry.playerId)) return s;
          return {
            state: {
              ...s.state,
              matches: {
                ...s.state.matches,
                [matchId]: { ...m, [key]: [...m[key], entry] },
              },
            },
          };
        }),

      finishMatch: (matchId, drawWinnerNext) =>
        set((s) => {
          const m = s.state.matches[matchId];
          if (!m) return s;
          const goals = Object.values(s.state.goals).filter((g) => g.matchId === matchId);
          const goalsA = goals.filter((g) => g.scoringForTeamId === m.teamAId).length;
          const goalsB = goals.filter((g) => g.scoringForTeamId === m.teamBId).length;
          const result =
            goalsA > goalsB ? 'A' : goalsB > goalsA ? 'B' : 'draw';
          return {
            state: {
              ...s.state,
              matches: {
                ...s.state.matches,
                [matchId]: { ...m, result, drawWinnerNext, endedAt: nowISO() },
              },
            },
          };
        }),

      cancelMatch: (matchId) =>
        set((s) => {
          const newMatches = { ...s.state.matches };
          delete newMatches[matchId];
          const newGoals: Record<ID, (typeof s.state.goals)[ID]> = {};
          for (const [gid, g] of Object.entries(s.state.goals)) {
            if (g.matchId !== matchId) newGoals[gid] = g;
          }
          return { state: { ...s.state, matches: newMatches, goals: newGoals } };
        }),

      startMatchClock: (matchId) =>
        set((s) => {
          const m = s.state.matches[matchId];
          if (!m || m.clockStartedAt) return s;
          return {
            state: {
              ...s.state,
              matches: {
                ...s.state.matches,
                [matchId]: { ...m, clockStartedAt: nowISO() },
              },
            },
          };
        }),

      addGoal: (matchId, playerId, scoringForTeamId, isLoaned) => {
        const st = get().state;
        if (playerId && playerCompetition(st, playerId) !== matchCompetition(st, matchId)) {
          return '';
        }
        const id = newId();
        set((s) => ({
          state: {
            ...s.state,
            goals: {
              ...s.state.goals,
              [id]: {
                id,
                matchId,
                ...(playerId ? { playerId } : {}),
                scoringForTeamId,
                isLoaned,
                createdAt: nowISO(),
              },
            },
          },
        }));
        return id;
      },

      removeGoal: (goalId) =>
        set((s) => {
          const next = { ...s.state.goals };
          delete next[goalId];
          return { state: { ...s.state, goals: next } };
        }),

      reassignGoal: (goalId, opts) =>
        set((s) => {
          const existing = s.state.goals[goalId];
          if (!existing) return s;
          if (
            opts.playerId &&
            playerCompetition(s.state, opts.playerId) !== matchCompetition(s.state, existing.matchId)
          ) {
            return s;
          }
          const { playerId: _omit, ...rest } = existing;
          void _omit;
          const updated = {
            ...rest,
            ...(opts.playerId ? { playerId: opts.playerId } : {}),
            scoringForTeamId: opts.scoringForTeamId,
            isLoaned: opts.isLoaned,
          };
          return {
            state: { ...s.state, goals: { ...s.state.goals, [goalId]: updated } },
          };
        }),

      setAutoAssignNextMatch: (value) =>
        set((s) => ({
          state: {
            ...s.state,
            config: { ...s.state.config, autoAssignNextMatch: value },
          },
        })),

      setMatchDurationSeconds: (value) =>
        set((s) => ({
          state: {
            ...s.state,
            config: {
              ...s.state.config,
              matchDurationSeconds: Math.max(30, Math.round(value)),
            },
          },
        })),

      setSeasonStartMonth: (month) =>
        set((s) => {
          const m = Math.round(month);
          if (m < 1 || m > 12) return s;
          return { state: { ...s.state, config: { ...s.state.config, seasonStartMonth: m } } };
        }),

      setAlertConfig: (patch) =>
        set((s) => ({
          state: { ...s.state, config: { ...s.state.config, ...patch } },
        })),

      reopenMatch: (matchId) =>
        set((s) => {
          const m = s.state.matches[matchId];
          if (!m) return s;
          const { endedAt: _endedAt, drawWinnerNext: _drawWinnerNext, ...rest } = m;
          void _endedAt;
          void _drawWinnerNext;
          return {
            state: {
              ...s.state,
              matches: {
                ...s.state.matches,
                [matchId]: { ...rest, result: null },
              },
            },
          };
        }),

      replaceState: (next) => {
        // Guardamos lo que había ANTES de pisarlo: importar un respaldo
        // equivocado no debe ser un camino sin vuelta.
        void rotateSnapshot(get().state, 'import');
        clearHydrationFailure();
        unlockWrites();
        set(() => ({
          state: next,
          ui: { currentScreen: { name: 'home' }, history: [] },
          hydrateError: null,
        }));
      },

      resetAll: async () => {
        await clearStorage();
        await clearSnapshots();
        const fresh = makeInitialState();
        // Un reset explícito es la única vía legítima para reabrir el candado
        // cuando la hidratación falló.
        clearHydrationFailure();
        unlockWrites();
        set(() => ({
          state: fresh,
          ui: makeInitialUI(fresh),
        }));
      },

      navigate: (screen, opts) =>
        set((s) => {
          if (opts?.replace) {
            // Volver de una partida reemplaza la pantalla por la jornada, que ya está
            // debajo en el historial: sin esto, "Volver" llevaba a la misma jornada.
            const below = s.ui.history[s.ui.history.length - 1];
            if (below && JSON.stringify(below.screen) === JSON.stringify(screen)) {
              return { ui: { currentScreen: screen, history: s.ui.history.slice(0, -1) } };
            }
            return { ui: { currentScreen: screen, history: s.ui.history } };
          }
          return {
            ui: {
              currentScreen: screen,
              history: [...s.ui.history, { screen: s.ui.currentScreen }],
            },
          };
        }),

      back: () =>
        set((s) => {
          if (s.ui.history.length === 0) {
            return { ui: { currentScreen: homeScreen(s.state), history: [] } };
          }
          const next = s.ui.history[s.ui.history.length - 1];
          return {
            ui: {
              currentScreen: next.screen,
              history: s.ui.history.slice(0, -1),
            },
          };
        }),

      resetNavigationToHome: () =>
        set((s) => ({ ui: makeInitialUI(s.state) })),
    }),
    {
      name: 'miercoles-app-state',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localforageStorage),
      partialize: (s) => ({ state: s.state, ui: s.ui }),
      migrate: (persistedState) => {
        if (!persistedState) return persistedState;
        try {
          const ps = persistedState as { state?: AppState };
          if (ps.state) {
            ps.state = migrateAppState(ps.state);
          }
          return ps;
        } catch (err) {
          reportHydrationError({ kind: 'migration', message: String(err) });
          // Relanzamos a propósito. Si devolviéramos el estado sin migrar, zustand
          // lo tomaría como migración exitosa y sellaría `version: SCHEMA_VERSION`
          // en el envoltorio: la migración no volvería a intentarse nunca y la
          // corrupción quedaría grabada para siempre.
          throw err;
        }
      },
      merge: (persistedState, current) => {
        const persisted = persistedState as Partial<StoreData> | undefined;
        if (!persisted) return current;
        const merged = { ...current, ...persisted } as Store;
        // Si el cambio vino de otra pestaña, adoptamos sus datos pero no su
        // navegación: que la pantalla salte sola mientras estás mirando otra cosa
        // es desconcertante.
        merged.ui = sanitizeUI(
          isApplyingRemoteChange() ? current.ui : persisted.ui,
          merged.state
        );
        return merged;
      },
      onRehydrateStorage: () => (hydrated, error) => {
        if (error || !hydrated || hydrationFailed()) {
          // El candado de escritura sigue cerrado: los bytes en disco quedan
          // intactos y recuperables desde la pantalla de error.
          useStore.setState({ hydrationSettled: true });
          return;
        }
        unlockWrites();
        useStore.setState({ hydrationSettled: true });
        void writeBootSnapshot(hydrated.state);
        void looksLikeDataLoss(hydrated.state).then((lost) => {
          if (!lost) return;
          useStore.setState({
            hydrateError: {
              kind: 'empty',
              message: 'Estado vacío con respaldos disponibles.',
            },
          });
        });
      },
    }
  )
);

/**
 * La navegación se persiste, así que puede apuntar a entidades que ya no existen
 * (una partida borrada, una jornada eliminada). Validamos contra el estado real
 * y descartamos siempre el back-stack: en un arranque nuevo no significa nada.
 */
function sanitizeUI(ui: StoreData['ui'] | undefined, state: AppState): StoreData['ui'] {
  const fallback = makeInitialUI(state);
  const screen = ui?.currentScreen;
  if (!screen) return fallback;

  // Solo valen las pantallas de la competición activa.
  const scoped = activeScope(state);
  const exists = (() => {
    switch (screen.name) {
      case 'team-detail':
        return Boolean(scoped.teams[screen.teamId]);
      case 'jornada-active':
      case 'summary':
        return Boolean(scoped.jornadas[screen.jornadaId]);
      case 'match-record':
        return Boolean(scoped.matches[screen.matchId]);
      default:
        return true;
    }
  })();

  if (!exists) return fallback;
  if (
    screen.name === 'jornada-setup' &&
    Object.values(scoped.jornadas).some((j) => j.status === 'open')
  ) {
    return fallback;
  }
  // El onboarding de una competición nueva sigue valiendo; el de la primera, solo si hace falta.
  if (screen.name === 'onboarding' && !screen.newCompetitionName && !needsOnboarding(state)) {
    return fallback;
  }
  if (screen.name !== 'onboarding' && needsOnboarding(state)) return fallback;
  return { currentScreen: screen, history: [] };
}

// Si el storage detectó JSON corrupto o migración fallida durante el hidratado,
// hacemos visible el error al primer render via el flag del store.
// Suscripción al evento de error (puede llegar después del create por ser async).
subscribeHydrationError((err) => {
  useStore.setState({ hydrateError: err, hydrationSettled: true });
});
const initialHydrationError = consumeHydrationError();
if (initialHydrationError) {
  useStore.setState({ hydrateError: initialHydrationError, hydrationSettled: true });
}

// Una escritura fallida (cuota llena, IndexedDB abortado, modo privado) era hasta
// ahora completamente invisible: la app seguía mostrando datos que nunca llegaron
// al disco.
subscribeWriteError((err) => {
  useStore.setState({ writeError: err });
});

// Si otra pestaña guardó algo, releemos en vez de seguir con nuestra copia vieja
// y pisarla en la próxima escritura.
subscribeRemoteChange(() => {
  if (writesAreLocked()) return;
  setApplyingRemoteChange(true);
  void Promise.resolve(useStore.persist.rehydrate()).finally(() => {
    setApplyingRemoteChange(false);
  });
});
