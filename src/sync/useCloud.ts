import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ID } from '@/types/domain';
import { setCloudScorer, setReadOnlyCompetitions, useStore } from '@/store/useStore';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { rawStorage } from '@/store/persistence';
import { cloudEnabled, supabase } from './client';
import { pendingRows, type PushedVersions, type RecordRow } from './rows';

export type CloudRole = 'organizer' | 'scorer' | 'viewer';

export const ROLE_LABEL: Record<CloudRole, string> = {
  organizer: 'Organizador',
  scorer: 'Admin',
  viewer: 'Espectador',
};

/** Competición de este teléfono que está en la nube. */
export interface CloudLink {
  linkedAt: string;
  role: CloudRole;
  lastPushAt: string | null;
  /** Reloj del servidor del último registro bajado; null = falta la primera bajada. */
  pulledUpTo: string | null;
}

export interface CloudMember {
  userId: ID;
  role: CloudRole;
  displayName: string | null;
}

/** Va en IndexedDB y no en localStorage: tiene una entrada por registro. */
const PUSHED_KEY = 'miercoles-cloud-pushed';

export type CloudStatus = 'idle' | 'syncing' | 'error';

interface CloudData {
  /** null = sin sesión. */
  userId: ID | null;
  /** Solo el organizador entra con email; los invitados tienen sesión anónima. */
  email: string | null;
  links: Record<ID, CloudLink>;
  status: CloudStatus;
  error: string | null;
  /** Aviso que queda hasta que se cierre (la sincronización no lo borra). */
  notice: string | null;
  /** Email al que se mandó el link y todavía no se abrió. */
  linkSentTo: string | null;
  bannerDismissed: boolean;
  /** Mientras la nube está en prueba, solo se ve en el teléfono que la desbloqueó. */
  unlocked: boolean;
  /** Nombre con el que entró (se muestra a los demás cuando anota una partida). */
  displayName: string | null;
  /** Link de invitación abierto que falta aceptar. */
  pendingInvite: string | null;
  /** Link de espectadores de cada competición, para volver a compartirlo. */
  viewerLinks: Record<ID, string>;
  /** Por competición, la versión de cada registro que ya está en la nube. */
  pushed: Record<ID, PushedVersions>;
  /** Falso hasta leer `pushed` del disco: antes no se sabe qué falta subir. */
  pushedLoaded: boolean;
}

interface CloudActions {
  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  uploadCompetition(competitionId: ID): Promise<void>;
  joinWithInvite(name: string): Promise<void>;
  cancelInvite(): void;
  inviteLink(competitionId: ID, role: 'scorer' | 'viewer'): Promise<string>;
  disableViewerLink(competitionId: ID): Promise<void>;
  fetchMembers(competitionId: ID): Promise<CloudMember[]>;
  removeMember(competitionId: ID, userId: ID): Promise<void>;
  dismissBanner(): void;
  clearError(): void;
  clearNotice(): void;
  toggleUnlocked(): void;
}

const UPSERT_CHUNK = 500;
const PULL_PAGE = 1000;
/** Se vuelve a pedir el último minuto: un registro puede confirmarse con algo de demora. */
const PULL_OVERLAP_MS = 60_000;
const SYNC_DEBOUNCE_MS = 2000;
const RETRY_MS = 30_000;
const POLL_MS = 30_000;
const INVITE_PARAM = 'unirse';
/** Un gol trae varias filas (gol + partida): se espera un poco para bajarlas juntas. */
const LIVE_DEBOUNCE_MS = 300;

/**
 * Estado de la nube en este teléfono. Va aparte de los datos (no viaja en los respaldos)
 * y en localStorage: es chico y tiene que estar listo al arrancar.
 */
export const useCloud = create<CloudData & CloudActions>()(
  persist(
    (set, get) => ({
      userId: null,
      email: null,
      links: {},
      status: 'idle',
      error: null,
      notice: null,
      linkSentTo: null,
      bannerDismissed: false,
      unlocked: false,
      displayName: null,
      pendingInvite: null,
      viewerLinks: {},
      pushed: {},
      pushedLoaded: false,

      sendMagicLink: async (email) => {
        if (!supabase) return;
        const redirectTo = window.location.origin + window.location.pathname;
        // Un invitado (sesión anónima) que agrega su email conserva sus grupos: se le
        // asigna el email a su misma cuenta en vez de crear otra.
        const user = (await supabase.auth.getUser()).data.user;
        const { error } = user?.is_anonymous
          ? await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo })
          : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
        if (error) throw new Error(authErrorMessage(error.message));
        set({ linkSentTo: email, error: null });
      },

      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        set({ userId: null, email: null, linkSentTo: null });
      },

      uploadCompetition: async (competitionId) => {
        if (!supabase || !get().email) return;
        const { error } = await supabase.rpc('create_group', { cid: competitionId });
        if (error) {
          console.error('[nube] create_group', error);
          set({ status: 'error', error: syncErrorMessage(error.message) });
          return;
        }
        linkCompetition(competitionId, 'organizer');
        set({ bannerDismissed: true });
        await syncNow();
      },

      joinWithInvite: async (name) => {
        const token = get().pendingInvite;
        if (!supabase || !token) return;
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error || !data.user) {
            console.error('[nube] signInAnonymously', error);
            throw new Error('No se pudo entrar. Revisa tu conexión e inténtalo de nuevo.');
          }
          set({ userId: data.user.id, email: null });
        }
        const { data, error } = await supabase.rpc('redeem_invite', { token, name });
        const joined = (data as Array<{ competition_id: ID; role: CloudRole }> | null)?.[0];
        if (error || !joined) {
          console.error('[nube] redeem_invite', error);
          if (error && /no es válido|venció/.test(error.message)) {
            throw new InvalidInviteError('El link no es válido o ya venció. Pide uno nuevo a quien te invitó.');
          }
          throw new Error('No se pudo entrar. Revisa tu conexión e inténtalo de nuevo.');
        }
        linkCompetition(joined.competition_id, joined.role);
        set({ pendingInvite: null, bannerDismissed: true, displayName: name || null });
        await pullCompetition(joined.competition_id);
        useStore.getState().setActiveCompetition(joined.competition_id);
      },

      cancelInvite: () => set({ pendingInvite: null }),

      inviteLink: async (competitionId, role) => {
        if (!supabase) throw new Error('La nube no está disponible.');
        const saved = get().viewerLinks[competitionId];
        if (role === 'viewer' && saved) return saved;
        const { data, error } = await supabase.rpc('create_invite', {
          cid: competitionId,
          invite_role: role,
        });
        if (error || typeof data !== 'string') {
          console.error('[nube] create_invite', error);
          throw new Error('No se pudo crear el link. Revisa tu conexión.');
        }
        const url = `${window.location.origin}/?${INVITE_PARAM}=${data}`;
        if (role === 'viewer') {
          set((s) => ({ viewerLinks: { ...s.viewerLinks, [competitionId]: url } }));
        }
        return url;
      },

      disableViewerLink: async (competitionId) => {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('invites')
          .select('id')
          .eq('competition_id', competitionId)
          .eq('role', 'viewer')
          .is('revoked_at', null);
        if (error) throw new Error('No se pudo desactivar el link. Revisa tu conexión.');
        for (const invite of data ?? []) {
          const { error: revokeError } = await supabase.rpc('revoke_invite', {
            invite_id: invite.id,
          });
          if (revokeError) throw new Error('No se pudo desactivar el link. Revisa tu conexión.');
        }
        set((s) => {
          const viewerLinks = { ...s.viewerLinks };
          delete viewerLinks[competitionId];
          return { viewerLinks };
        });
      },

      fetchMembers: async (competitionId) => {
        if (!supabase) return [];
        const { data, error } = await supabase
          .from('members')
          .select('user_id, role, display_name, created_at')
          .eq('competition_id', competitionId)
          .order('created_at');
        if (error) throw new Error('No se pudo cargar la lista. Revisa tu conexión.');
        return (data ?? []).map((m) => ({
          userId: m.user_id as ID,
          role: m.role as CloudRole,
          displayName: (m.display_name as string | null) ?? null,
        }));
      },

      removeMember: async (competitionId, userId) => {
        if (!supabase) return;
        const { error } = await supabase.rpc('remove_member', {
          cid: competitionId,
          member_id: userId,
        });
        if (error) throw new Error('No se pudo sacar. Revisa tu conexión.');
      },

      dismissBanner: () => set({ bannerDismissed: true }),
      clearError: () => set({ error: null, status: 'idle' }),
      clearNotice: () => set({ notice: null }),
      toggleUnlocked: () => set((s) => ({ unlocked: !s.unlocked })),
    }),
    {
      name: 'miercoles-cloud',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        links: s.links,
        linkSentTo: s.linkSentTo,
        bannerDismissed: s.bannerDismissed,
        unlocked: s.unlocked,
        pendingInvite: s.pendingInvite,
        viewerLinks: s.viewerLinks,
        displayName: s.displayName,
      }),
      // Los links de antes de las invitaciones eran todos del organizador.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CloudData>;
        const links: Record<ID, CloudLink> = {};
        for (const [id, link] of Object.entries(p.links ?? {})) {
          links[id] = { ...link, role: link.role ?? 'organizer', pulledUpTo: link.pulledUpTo ?? null };
        }
        return { ...current, ...p, links };
      },
    }
  )
);

/**
 * La nube se muestra si este build la trae y el teléfono la desbloqueó (o ya la usa: tiene
 * sesión, competiciones en la nube o un link de invitación abierto).
 */
export function useCloudVisible(): boolean {
  return useCloud(
    (s) =>
      cloudEnabled &&
      (s.unlocked ||
        s.email !== null ||
        s.pendingInvite !== null ||
        Object.keys(s.links).length > 0)
  );
}

/** Rol de este teléfono en una competición, o null si no está en la nube. */
export function useCloudRole(competitionId: ID | null): CloudRole | null {
  return useCloud((s) => (competitionId ? (s.links[competitionId]?.role ?? null) : null));
}

/** El link no sirve (inventado, vencido, usado o desactivado): reintentar no cambia nada. */
export class InvalidInviteError extends Error {}

function authErrorMessage(message: string): string {
  if (/rate limit|security purposes/i.test(message)) {
    return 'Ya te mandamos un link hace poco. Espera un minuto antes de pedir otro.';
  }
  if (/invalid.*email/i.test(message)) return 'Ese email no es válido.';
  return message;
}

function syncErrorMessage(message: string): string {
  if (/fetch|network|load failed/i.test(message)) {
    return 'No hay conexión con la nube. Se reintenta solo.';
  }
  if (/otro organizador/.test(message)) return message;
  if (/row-level security|permission|JWT/i.test(message)) {
    return 'La nube no aceptó los cambios: vuelve a entrar.';
  }
  return 'No se pudo sincronizar con la nube. Se reintenta solo en unos segundos.';
}

function linkCompetition(competitionId: ID, role: CloudRole): void {
  useCloud.setState((s) => {
    const current = s.links[competitionId];
    if (current?.role === role) return s;
    return {
      links: {
        ...s.links,
        [competitionId]: current
          ? { ...current, role }
          : { linkedAt: new Date().toISOString(), role, lastPushAt: null, pulledUpTo: null },
      },
    };
  });
}

/** Los datos solo se tocan con la hidratación terminada y sana: si no, no son los reales. */
function storeReady(): boolean {
  const store = useStore.getState();
  return store.hydrationSettled && !store.hydrateError;
}

let syncing: Promise<void> | null = null;
let syncAgain = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync(delay = SYNC_DEBOUNCE_MS): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delay);
}

/** Sube lo pendiente y baja lo nuevo. Si ya hay una pasada en curso, se encola otra. */
export async function syncNow(): Promise<void> {
  if (syncing) {
    syncAgain = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      do {
        syncAgain = false;
        await syncOnce();
      } while (syncAgain);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

async function syncOnce(): Promise<void> {
  const cloud = useCloud.getState();
  if (!supabase || !cloud.userId || !cloud.pushedLoaded || !storeReady()) return;
  if (!navigator.onLine) return;
  try {
    await discoverMemberships();
    for (const competitionId of Object.keys(useCloud.getState().links)) {
      await pushCompetition(competitionId);
      await pullCompetition(competitionId);
    }
    useCloud.setState({ status: 'idle', error: null });
  } catch (err) {
    console.error('[nube] sincronización', err);
    const message = err instanceof Error ? err.message : String(err);
    useCloud.setState({ status: 'error', error: syncErrorMessage(message) });
    scheduleSync(RETRY_MS);
  }
}

/**
 * Los grupos de los que este usuario es miembro mandan: así el organizador recupera los
 * suyos en un teléfono nuevo, y a quien sacaron de un grupo deja de sincronizarlo.
 */
async function discoverMemberships(): Promise<void> {
  if (!supabase) return;
  const userId = useCloud.getState().userId;
  const { data, error } = await supabase
    .from('members')
    .select('competition_id, role')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const roles = new Map((data ?? []).map((m) => [m.competition_id as ID, m.role as CloudRole]));
  for (const [competitionId, role] of roles) linkCompetition(competitionId, role);
  useCloud.setState((s) => {
    const stale = Object.keys(s.links).filter((id) => !roles.has(id));
    if (stale.length === 0) return s;
    const links = { ...s.links };
    for (const id of stale) delete links[id];
    return { links };
  });
}

async function pushCompetition(competitionId: ID): Promise<void> {
  if (!supabase) return;
  const link = useCloud.getState().links[competitionId];
  if (!link || link.role === 'viewer') return;
  const pushed = useCloud.getState().pushed[competitionId] ?? {};
  const rows = pendingRows(useStore.getState().state, competitionId, pushed);
  if (rows.length === 0) return;
  useCloud.setState({ status: 'syncing' });
  const rejected: RecordRow[] = [];
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await upsertRows(chunk);
    if (!error) continue;
    if (!LOCKED.test(error.message)) throw new Error(error.message);
    // Alguien tomó el control de una partida mientras este teléfono anotaba sin señal:
    // se sube fila por fila para quedarse solo con lo que el servidor rechaza.
    for (const row of chunk) {
      const { error: rowError } = await upsertRows([row]);
      if (!rowError) continue;
      if (!LOCKED.test(rowError.message)) throw new Error(rowError.message);
      rejected.push(row);
    }
  }
  const accepted = rows.filter((r) => !rejected.includes(r));
  await markPushed(competitionId, accepted, { lastPushAt: new Date().toISOString() });
  if (rejected.length > 0) await discardRejected(competitionId, rejected);
}

/** El servidor rechaza cambios en una partida que anota otra persona. */
const LOCKED = /anotando/;

function upsertRows(rows: RecordRow[]) {
  return supabase!.from('records').upsert(rows, { onConflict: 'competition_id,table_name,id' });
}

/** Gana quien tomó el control: lo rechazado vuelve a como está en la nube. */
async function discardRejected(competitionId: ID, rejected: RecordRow[]): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('records')
    .select('table_name, id, competition_id, data, updated_at, deleted_at')
    .eq('competition_id', competitionId)
    .in('id', rejected.map((r) => r.id));
  if (error) throw new Error(error.message);
  const remote = (data ?? []) as RecordRow[];
  const store = useStore.getState();
  const applied = store.applyRemote(remote, { force: true });
  const missing = rejected.filter(
    (r) => !remote.some((x) => x.id === r.id && x.table_name === r.table_name)
  );
  store.discardLocal(missing.map((r) => ({ table: r.table_name, id: r.id })));
  const versions = [...applied, ...missing.map((r) => ({ ...r }))];
  await markPushed(competitionId, versions, {});
  useCloud.setState({
    notice: 'Otra persona tomó el control de la partida: lo que anotaste sin señal no se guardó.',
  });
}

async function pullCompetition(competitionId: ID): Promise<void> {
  if (!supabase || !storeReady()) return;
  const link = useCloud.getState().links[competitionId];
  if (!link) return;
  const since = link.pulledUpTo
    ? new Date(Date.parse(link.pulledUpTo) - PULL_OVERLAP_MS).toISOString()
    : null;
  const rows: Array<RecordRow & { synced_at: string }> = [];
  for (let from = 0; ; from += PULL_PAGE) {
    let query = supabase
      .from('records')
      .select('table_name, id, competition_id, data, updated_at, deleted_at, synced_at')
      .eq('competition_id', competitionId)
      .order('synced_at')
      .range(from, from + PULL_PAGE - 1);
    if (since) query = query.gt('synced_at', since);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Array<RecordRow & { synced_at: string }>));
    if (!data || data.length < PULL_PAGE) break;
  }
  if (rows.length === 0) return;
  const applied = useStore.getState().applyRemote(rows);
  const pulledUpTo = rows.reduce((max, r) => (r.synced_at > max ? r.synced_at : max), '');
  await markPushed(competitionId, applied, { pulledUpTo });
}

const channels = new Map<ID, RealtimeChannel>();

/** Cada competición en la nube avisa al instante cuando alguien cambia algo. */
function syncChannels(): void {
  if (!supabase) return;
  const { links, userId } = useCloud.getState();
  const wanted = new Set(userId ? Object.keys(links) : []);
  for (const [id, channel] of channels) {
    if (wanted.has(id)) continue;
    void supabase.removeChannel(channel);
    channels.delete(id);
  }
  for (const id of wanted) {
    if (channels.has(id)) continue;
    const channel = supabase
      .channel(`records:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'records', filter: `competition_id=eq.${id}` },
        () => scheduleSync(LIVE_DEBOUNCE_MS)
      )
      .subscribe();
    channels.set(id, channel);
  }
}

/** Lo que coincide con la nube no hace falta subirlo. */
async function markPushed(
  competitionId: ID,
  rows: RecordRow[],
  linkPatch: Partial<CloudLink>
): Promise<void> {
  useCloud.setState((s) => {
    const current = s.links[competitionId];
    if (!current) return s;
    const versions = { ...(s.pushed[competitionId] ?? {}) };
    for (const row of rows) versions[row.id] = row.updated_at;
    return {
      links: { ...s.links, [competitionId]: { ...current, ...linkPatch } },
      pushed: { ...s.pushed, [competitionId]: versions },
    };
  });
  await rawStorage.set(PUSHED_KEY, useCloud.getState().pushed);
}

let started = false;

/** Se llama una vez al arrancar: sesión, sincronización tras cada cambio y al volver la señal. */
export function startCloudSync(): void {
  if (started || !supabase) return;
  started = true;

  const params = new URLSearchParams(window.location.search);
  // Link de invitación: se guarda para aceptarlo (pidiendo el nombre) y se limpia la URL.
  const invite = params.get(INVITE_PARAM);
  if (invite) useCloud.setState({ pendingInvite: invite });
  // El link del email vuelve con `?code=` (o con el error, si venció).
  const linkError = params.get('error_description');
  if (linkError) {
    useCloud.setState({
      error: /expired|invalid/i.test(linkError)
        ? 'El link venció o ya se usó. Pide uno nuevo.'
        : linkError,
    });
  }
  if (invite || params.has('code') || params.has('error')) {
    window.history.replaceState(null, '', window.location.pathname);
  }

  void rawStorage
    .get<Record<ID, PushedVersions>>(PUSHED_KEY)
    .catch(() => null)
    .then((pushed) => {
      useCloud.setState({ pushed: pushed ?? {}, pushedLoaded: true });
      scheduleSync(0);
    });

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    useCloud.setState(
      user
        ? { userId: user.id, email: user.is_anonymous ? null : (user.email ?? null) }
        : { userId: null, email: null }
    );
    if (user?.email) useCloud.setState({ linkSentTo: null });
    if (user) scheduleSync(0);
  });

  const applyRoles = (s: CloudData) => {
    const entries = Object.entries(s.links);
    setReadOnlyCompetitions(entries.filter(([, l]) => l.role === 'viewer').map(([id]) => id));
    setCloudScorer(
      s.userId
        ? {
            id: s.userId,
            name: s.displayName ?? s.email?.split('@')[0] ?? 'Organizador',
            competitions: new Set(entries.filter(([, l]) => l.role !== 'viewer').map(([id]) => id)),
          }
        : null
    );
  };
  applyRoles(useCloud.getState());
  useCloud.subscribe((s, prev) => {
    if (
      s.links !== prev.links ||
      s.userId !== prev.userId ||
      s.displayName !== prev.displayName ||
      s.email !== prev.email
    ) {
      applyRoles(s);
    }
    if (s.links !== prev.links || s.userId !== prev.userId) syncChannels();
  });

  useStore.subscribe((s, prev) => {
    if (s.state !== prev.state) scheduleSync();
    if (s.hydrationSettled && !prev.hydrationSettled) scheduleSync(0);
  });
  window.addEventListener('online', () => scheduleSync(0));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(0);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') scheduleSync(0);
  }, POLL_MS);
}
