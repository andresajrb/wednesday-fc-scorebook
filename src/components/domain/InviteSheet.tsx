import { useEffect, useState } from 'react';
import { Share2, Link2Off, UserMinus } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Button } from '@/components/primitives/Button';
import { ConfirmDialog } from '@/components/primitives/ConfirmDialog';
import { useStore } from '@/store/useStore';
import { ROLE_LABEL, useCloud, type CloudMember } from '@/sync/useCloud';

/**
 * Comparte el texto con la hoja del teléfono (WhatsApp, Telegram…). Sin ella, lo copia.
 * Devuelve lo que pasó para avisarlo.
 */
async function shareText(text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}

/** Organizador › Invitar: link de espectadores para el grupo, link personal de admin y miembros. */
export function InviteSheet({
  competitionId,
  onClose,
}: {
  competitionId: string | null;
  onClose: () => void;
}) {
  const name = useStore((s) =>
    competitionId ? (s.state.competitions[competitionId]?.name ?? '') : ''
  );
  const inviteLink = useCloud((s) => s.inviteLink);
  const disableViewerLink = useCloud((s) => s.disableViewerLink);
  const fetchMembers = useCloud((s) => s.fetchMembers);
  const removeMember = useCloud((s) => s.removeMember);
  const myId = useCloud((s) => s.userId);
  const hasViewerLink = useCloud((s) => Boolean(competitionId && s.viewerLinks[competitionId]));
  const [members, setMembers] = useState<CloudMember[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CloudMember | null>(null);

  useEffect(() => {
    if (!competitionId) return;
    setMembers(null);
    setNotice(null);
    setError(null);
    fetchMembers(competitionId).then(setMembers, (err: Error) => setError(err.message));
  }, [competitionId, fetchMembers]);

  if (!competitionId) return null;

  const run = async (key: string, task: () => Promise<string | null>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      setNotice(await task());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const share = (role: 'viewer' | 'scorer') =>
    run(role, async () => {
      const url = await inviteLink(competitionId, role);
      const text =
        role === 'viewer'
          ? `Sigue la tabla de *${name}* en la app: ${url}`
          : `Te invito a anotar en *${name}*: ${url}\n_El link es solo para ti y vence en 7 días._`;
      const result = await shareText(text);
      return result === 'copied' ? 'Link copiado: pégalo en WhatsApp.' : null;
    });

  return (
    <>
      <BottomSheet open onClose={onClose} title={`Invitar a ${name}`}>
        <div className="space-y-5" data-sheet="invite">
          <div className="space-y-2">
            <div className="text-body-em font-semibold">Espectadores</div>
            <p className="text-caption text-text-2 leading-relaxed">
              Un solo link para pegar en el grupo de WhatsApp. Ven la tabla y las jornadas, pero no
              pueden cambiar nada.
            </p>
            <Button
              size="md"
              fullWidth
              leading={<Share2 size={16} strokeWidth={1.75} />}
              disabled={busy !== null}
              onClick={() => void share('viewer')}
            >
              {busy === 'viewer' ? 'Creando link…' : 'Compartir link de espectadores'}
            </Button>
            {hasViewerLink ? (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                leading={<Link2Off size={14} strokeWidth={1.75} />}
                disabled={busy !== null}
                onClick={() =>
                  void run('disable', async () => {
                    await disableViewerLink(competitionId);
                    return 'Link desactivado. Los que ya entraron siguen dentro.';
                  })
                }
              >
                Desactivar el link de espectadores
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-body-em font-semibold">Admin</div>
            <p className="text-caption text-text-2 leading-relaxed">
              Puede anotar partidas y goles. El link es para una sola persona y vence en 7 días:
              mándaselo por privado.
            </p>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              leading={<Share2 size={16} strokeWidth={1.75} />}
              disabled={busy !== null}
              onClick={() => void share('scorer')}
            >
              {busy === 'scorer' ? 'Creando link…' : 'Compartir link de admin'}
            </Button>
          </div>

          {notice ? (
            <p className="text-caption text-accent leading-relaxed" role="status">
              {notice}
            </p>
          ) : null}
          {error ? <p className="text-caption text-error leading-relaxed">{error}</p> : null}

          <div className="space-y-2">
            <div className="text-body-em font-semibold">Miembros</div>
            {members === null ? (
              <p className="text-caption text-text-3">Cargando…</p>
            ) : (
              <div className="bg-bg-elev2 border border-border rounded-card overflow-hidden">
                {members.map((m, idx) => (
                  <div
                    key={m.userId}
                    data-member={m.displayName ?? ''}
                    className={`p-3 flex items-center gap-3 ${idx > 0 ? 'border-t border-border' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-body-em font-semibold truncate">
                        {m.userId === myId ? 'Tú' : (m.displayName ?? 'Sin nombre')}
                      </div>
                      <div className="text-caption text-text-2">{ROLE_LABEL[m.role]}</div>
                    </div>
                    {m.role !== 'organizer' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        leading={<UserMinus size={14} strokeWidth={1.75} />}
                        onClick={() => setRemoving(m)}
                      >
                        Sacar
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={removing !== null}
        title="Sacar del grupo"
        description={`${removing?.displayName ?? 'Esta persona'} deja de ver y de anotar en ${name}, y la competición se borra de su teléfono.`}
        confirmLabel="Sacar"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const member = removing;
          setRemoving(null);
          if (!member) return;
          void run('remove', async () => {
            await removeMember(competitionId, member.userId);
            setMembers((list) => list?.filter((m) => m.userId !== member.userId) ?? null);
            return null;
          });
        }}
      />
    </>
  );
}
