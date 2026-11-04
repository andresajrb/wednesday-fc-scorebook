import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ID } from '@/types/domain';
import { useStore } from '@/store/useStore';
import { rawStorage } from '@/store/persistence';
import { supabase } from './client';
import { pendingRows, type PushedVersions } from './rows';

/** Competición subida a la nube desde este teléfono. */
export interface CloudLink {
  linkedAt: string;
  lastPushAt: string | null;
}

/** Va en IndexedDB y no en localStorage: tiene una entrada por registro. */
const PUSHED_KEY = 'miercoles-cloud-pushed';

export type CloudStatus = 'idle' | 'pushing' | 'error';

interface CloudData {
  /** null = sin sesión. */
  email: string | null;
  links: Record<ID, CloudLink>;
  status: CloudStatus;
  error: string | null;
  /** Email al que se mandó el link y todavía no se abrió. */
  linkSentTo: string | null;
  bannerDismissed: boolean;
  /** Por competición, la versión de cada registro que ya está en la nube. */
  pushed: Record<ID, PushedVersions>;
  /** Falso hasta leer `pushed` del disco: antes no se sabe qué falta subir. */
  pushedLoaded: boolean;
}

interface CloudActions {
  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  uploadCompetition(competitionId: ID): Promise<void>;
  dismissBanner(): void;
  clearError(): void;
}

const UPSERT_CHUNK = 500;
const PUSH_DEBOUNCE_MS = 2000;
const RETRY_MS = 30_000;

/**
 * Estado de la nube en este teléfono. Va aparte de los datos (no viaja en los respaldos)
 * y en localStorage: es chico y tiene que estar listo al arrancar.
 */
export const useCloud = create<CloudData & CloudActions>()(
  persist(
    (set, get) => ({
      email: null,
      links: {},
      status: 'idle',
      error: null,
      linkSentTo: null,
      bannerDismissed: false,
      pushed: {},
      pushedLoaded: false,

      sendMagicLink: async (email) => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + window.location.pathname },
        });
        if (error) throw new Error(authErrorMessage(error.message));
        set({ linkSentTo: email, error: null });
      },

      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        set({ email: null, linkSentTo: null });
      },

      uploadCompetition: async (competitionId) => {
        if (!supabase || !get().email) return;
        const { error } = await supabase.rpc('create_group', { cid: competitionId });
        if (error) {
          console.error('[nube] create_group', error);
          set({ status: 'error', error: pushErrorMessage(error.message) });
          return;
        }
        set((s) => ({
          links: {
            ...s.links,
            [competitionId]: s.links[competitionId] ?? {
              linkedAt: new Date().toISOString(),
              lastPushAt: null,
            },
          },
          bannerDismissed: true,
        }));
        await pushPending();
      },

      dismissBanner: () => set({ bannerDismissed: true }),
      clearError: () => set({ error: null, status: 'idle' }),
    }),
    {
      name: 'miercoles-cloud',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        links: s.links,
        linkSentTo: s.linkSentTo,
        bannerDismissed: s.bannerDismissed,
      }),
    }
  )
);

function authErrorMessage(message: string): string {
  if (/rate limit|security purposes/i.test(message)) {
    return 'Ya te mandamos un link hace poco. Espera un minuto antes de pedir otro.';
  }
  if (/invalid.*email/i.test(message)) return 'Ese email no es válido.';
  return message;
}

function pushErrorMessage(message: string): string {
  if (/fetch|network|load failed/i.test(message)) {
    return 'No hay conexión con la nube. Se reintenta solo.';
  }
  if (/otro organizador/.test(message)) return message;
  if (/row-level security|permission|JWT/i.test(message)) {
    return 'La nube no aceptó los cambios: vuelve a entrar con tu email.';
  }
  return 'No se pudo subir a la nube. Se reintenta solo en unos segundos.';
}

let pushing: Promise<void> | null = null;
let pushAgain = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function schedulePush(delay = PUSH_DEBOUNCE_MS): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void pushPending();
  }, delay);
}

/** Sube lo pendiente de cada competición enlazada. Si ya hay una subida en curso, se encola. */
export async function pushPending(): Promise<void> {
  if (pushing) {
    pushAgain = true;
    return pushing;
  }
  pushing = (async () => {
    try {
      do {
        pushAgain = false;
        await pushOnce();
      } while (pushAgain);
    } finally {
      pushing = null;
    }
  })();
  return pushing;
}

async function pushOnce(): Promise<void> {
  const cloud = useCloud.getState();
  if (!supabase || !cloud.email || !cloud.pushedLoaded) return;
  const store = useStore.getState();
  // Con la hidratación fallida, el estado en memoria no es el real: no se sube nada.
  if (!store.hydrationSettled || store.hydrateError) return;

  for (const competitionId of Object.keys(cloud.links)) {
    const pushed = useCloud.getState().pushed[competitionId] ?? {};
    const rows = pendingRows(useStore.getState().state, competitionId, pushed);
    if (rows.length === 0) continue;
    if (!navigator.onLine) {
      useCloud.setState({ status: 'idle' });
      return;
    }
    useCloud.setState({ status: 'pushing' });
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const { error } = await supabase
        .from('records')
        .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: 'competition_id,table_name,id' });
      if (error) {
        console.error('[nube] subida', error);
        useCloud.setState({ status: 'error', error: pushErrorMessage(error.message) });
        schedulePush(RETRY_MS);
        return;
      }
    }
    const versions = { ...pushed };
    for (const row of rows) versions[row.id] = row.updated_at;
    useCloud.setState((s) => {
      const current = s.links[competitionId];
      if (!current) return s;
      return {
        links: { ...s.links, [competitionId]: { ...current, lastPushAt: new Date().toISOString() } },
        pushed: { ...s.pushed, [competitionId]: versions },
      };
    });
    await rawStorage.set(PUSHED_KEY, useCloud.getState().pushed);
  }
  useCloud.setState({ status: 'idle', error: null });
}

let started = false;

/** Se llama una vez al arrancar: sesión, subida tras cada cambio y al recuperar la señal. */
export function startCloudSync(): void {
  if (started || !supabase) return;
  started = true;

  // El link del email vuelve con `?code=` (o con el error, si venció): se limpia la URL.
  const params = new URLSearchParams(window.location.search);
  const linkError = params.get('error_description');
  if (linkError) {
    useCloud.setState({
      error: /expired|invalid/i.test(linkError)
        ? 'El link venció o ya se usó. Pide uno nuevo.'
        : linkError,
    });
  }
  if (params.has('code') || params.has('error')) {
    window.history.replaceState(null, '', window.location.pathname);
  }

  void rawStorage
    .get<Record<ID, PushedVersions>>(PUSHED_KEY)
    .catch(() => null)
    .then((pushed) => {
      useCloud.setState({ pushed: pushed ?? {}, pushedLoaded: true });
      schedulePush(0);
    });

  supabase.auth.onAuthStateChange((_event, session) => {
    const email = session?.user.email ?? null;
    useCloud.setState(email ? { email, linkSentTo: null } : { email: null });
    if (email) schedulePush(0);
  });

  useStore.subscribe((s, prev) => {
    if (s.state !== prev.state) schedulePush();
    if (s.hydrationSettled && !prev.hydrationSettled) schedulePush(0);
  });
  window.addEventListener('online', () => schedulePush(0));
}
