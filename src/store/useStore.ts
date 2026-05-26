import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AppState,
  ID,
  Match,
  MatchRosterEntry,
  Screen,
  Team,
} from '@/types/domain';
import { DEFAULT_MATCH_DURATION_SECONDS, SCHEMA_VERSION } from '@/types/domain';
import {
  localforageStorage,
  clearStorage,
  consumeHydrationError,
  reportHydrationError,
  subscribeHydrationError,
  type HydrateError,
} from './persistence';
import { migrateAppState } from './migrations';
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
}

interface StoreActions {
  // Onboarding
  completeOnboarding(teams: Array<{ name: string; color: string }>): void;

  // Teams
  renameTeam(teamId: ID, name: string): void;
  setTeamColor(teamId: ID, hex: string): void;

  // Players
  addPlayer(name: string, teamId: ID): ID;
  movePlayer(playerId: ID, toTeamId: ID): void;
  setPlayerActive(playerId: ID, active: boolean): void;
  renamePlayer(playerId: ID, name: string): void;

  // Jornadas
  startJornada(): ID;
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

  // Edit
  reopenMatch(matchId: ID): void;

  // Backup / reset
  replaceState(next: AppState): void;
  resetAll(): Promise<void>;

  // Hydration
  setHydrateError(err: HydrateError | null): void;
  clearHydrateError(): void;

  // Navigation
  navigate(screen: Screen, opts?: { replace?: boolean }): void;
  back(): void;
  resetNavigationToHome(): void;
}

type Store = StoreData & StoreActions;

function makeInitialState(): AppState {
  return {
    version: SCHEMA_VERSION,
    teams: {},
    players: {},
    jornadas: {},
    matches: {},
    goals: {},
    config: {
      onboardingDone: false,
      createdAt: nowISO(),
      autoAssignNextMatch: false,
      matchDurationSeconds: DEFAULT_MATCH_DURATION_SECONDS,
    },
  };
}

function makeInitialUI(state: AppState): StoreData['ui'] {
  const screen: Screen = state.config.onboardingDone ? { name: 'home' } : { name: 'onboarding' };
  return { currentScreen: screen, history: [] };
}

const initialState = makeInitialState();

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      state: initialState,
      ui: makeInitialUI(initialState),
      hydrateError: null,

      setHydrateError: (err) => set(() => ({ hydrateError: err })),
      clearHydrateError: () => set(() => ({ hydrateError: null })),

      completeOnboarding: (teamsInput) =>
        set((s) => {
          const teams: Record<ID, Team> = {};
          for (const t of teamsInput) {
            const id = newId();
            teams[id] = { id, name: t.name, color: t.color, createdAt: nowISO() };
          }
          return {
            state: {
              ...s.state,
              teams,
              config: { ...s.state.config, onboardingDone: true },
            },
            ui: { currentScreen: { name: 'home' }, history: [] },
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
        set((s) => ({
          state: {
            ...s.state,
            players: {
              ...s.state.players,
              [playerId]: { ...s.state.players[playerId], teamId: toTeamId },
            },
          },
        })),

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

      startJornada: () => {
        const id = newId();
        const date = todayISODate();
        set((s) => ({
          state: {
            ...s.state,
            jornadas: {
              ...s.state.jornadas,
              [id]: {
                id,
                date,
                status: 'open',
                createdAt: nowISO(),
              },
            },
          },
        }));
        return id;
      },

      closeJornada: (jornadaId) =>
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
        }),

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

      replaceState: (next) =>
        set(() => ({
          state: next,
          ui: { currentScreen: { name: 'home' }, history: [] },
        })),

      resetAll: async () => {
        await clearStorage();
        const fresh = makeInitialState();
        set(() => ({
          state: fresh,
          ui: makeInitialUI(fresh),
        }));
      },

      navigate: (screen, opts) =>
        set((s) => {
          if (opts?.replace) {
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
            const fallback: Screen = s.state.config.onboardingDone
              ? { name: 'home' }
              : { name: 'onboarding' };
            return { ui: { currentScreen: fallback, history: [] } };
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
        set((s) => ({
          ui: {
            currentScreen: s.state.config.onboardingDone
              ? { name: 'home' }
              : { name: 'onboarding' },
            history: [],
          },
        })),
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
          return persistedState;
        }
      },
    }
  )
);

// Si el storage detectó JSON corrupto o migración fallida durante el hidratado,
// hacemos visible el error al primer render via el flag del store.
// Suscripción al evento de error (puede llegar después del create por ser async).
subscribeHydrationError((err) => {
  useStore.setState({ hydrateError: err });
});
const initialHydrationError = consumeHydrationError();
if (initialHydrationError) {
  useStore.setState({ hydrateError: initialHydrationError });
}
