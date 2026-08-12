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
  clearWriteError(): void;

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
      hydrationSettled: false,
      writeError: null,

      setHydrateError: (err) => set(() => ({ hydrateError: err })),
      clearHydrateError: () => set(() => ({ hydrateError: null })),
      clearWriteError: () => set(() => ({ writeError: null })),

      completeOnboarding: (teamsInput) =>
        set((s) => {
          const existing = Object.values(s.state.teams);
          const teams: Record<ID, Team> = {};

          if (existing.length > 0) {
            // Ya hay equipos: renombrar y recolorear los que están, nunca generar
            // IDs nuevos. Regenerarlos dejaba a todos los jugadores apuntando a
            // equipos inexistentes, o sea invisibles en toda la app.
            const ordered = existing.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            for (const team of ordered) teams[team.id] = team;
            ordered.forEach((team, i) => {
              const input = teamsInput[i];
              if (input) teams[team.id] = { ...team, name: input.name, color: input.color };
            });
            for (const input of teamsInput.slice(ordered.length)) {
              const id = newId();
              teams[id] = { id, name: input.name, color: input.color, createdAt: nowISO() };
            }
          } else {
            for (const t of teamsInput) {
              const id = newId();
              teams[id] = { id, name: t.name, color: t.color, createdAt: nowISO() };
            }
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

  const exists = (() => {
    switch (screen.name) {
      case 'team-detail':
        return Boolean(state.teams[screen.teamId]);
      case 'jornada-active':
      case 'summary':
        return Boolean(state.jornadas[screen.jornadaId]);
      case 'match-record':
        return Boolean(state.matches[screen.matchId]);
      default:
        return true;
    }
  })();

  if (!exists) return fallback;
  if (screen.name === 'onboarding' && state.config.onboardingDone) return fallback;
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
