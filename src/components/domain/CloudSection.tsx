import { useState } from 'react';
import { CloudUpload, Check, Mail, LogOut, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { useStore } from '@/store/useStore';
import { getArchivedCompetitions, getVisibleCompetitions } from '@/store/scope';
import { pushPending, useCloud, useCloudVisible } from '@/sync/useCloud';
import { pendingRows } from '@/sync/rows';

/** Configuración › Nube: entrar con email y subir cada competición como un grupo. */
export function CloudSection() {
  const cloud = useCloud();
  const visible = useCloudVisible();
  const state = useStore((s) => s.state);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  if (!visible) return null;

  const competitions = [...getVisibleCompetitions(state), ...getArchivedCompetitions(state)];

  const onSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    setSendError(null);
    try {
      await cloud.sendMagicLink(trimmed);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const onUpload = async (competitionId: string) => {
    setUploading(competitionId);
    try {
      await cloud.uploadCompetition(competitionId);
    } finally {
      setUploading(null);
    }
  };

  return (
    <section data-section="cloud" className="scroll-mt-20">
      <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
        Nube
      </div>
      <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
        {!cloud.email ? (
          <div className="p-3 space-y-3">
            <p className="text-caption text-text-2 leading-relaxed">
              Respalda tus competiciones en la nube: si pierdes o cambias el teléfono, las
              recuperas. Entra con tu email; te mandamos un link para confirmar.
            </p>
            {cloud.linkSentTo ? (
              <div className="rounded-btn bg-accent-soft border border-accent/40 p-3 text-caption leading-relaxed">
                Te mandamos un link a <span className="font-semibold">{cloud.linkSentTo}</span>.
                Ábrelo en este mismo teléfono para entrar.
              </div>
            ) : null}
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onSend();
              }}
              className="w-full h-11 px-3 bg-bg-elev2 border border-border rounded-btn outline-none focus:border-accent text-body"
              aria-label="Email"
            />
            <Button
              size="md"
              fullWidth
              leading={<Mail size={16} strokeWidth={1.75} />}
              disabled={sending || !email.trim()}
              onClick={() => void onSend()}
            >
              {cloud.linkSentTo ? 'Mandar otro link' : 'Mandarme el link'}
            </Button>
            {sendError || cloud.error ? (
              <p className="text-caption text-error leading-relaxed">{sendError ?? cloud.error}</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-caption text-text-3">Conectado como</div>
                <div className="text-body-em font-semibold truncate">{cloud.email}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                leading={<LogOut size={14} strokeWidth={1.75} />}
                onClick={() => void cloud.signOut()}
              >
                Salir
              </Button>
            </div>
            {competitions.map((c) => {
              const link = cloud.links[c.id];
              const pending =
                link && cloud.pushedLoaded
                  ? pendingRows(state, c.id, cloud.pushed[c.id] ?? {}).length
                  : 0;
              return (
                <div
                  key={c.id}
                  data-competition={c.name}
                  className="p-3 border-t border-border flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-body-em font-semibold truncate">{c.name}</div>
                    <div className="text-caption text-text-2">
                      {!link
                        ? 'Solo en este teléfono'
                        : pending > 0
                          ? cloud.status === 'pushing'
                            ? 'Subiendo…'
                            : `${pending} ${pending === 1 ? 'cambio' : 'cambios'} por subir`
                          : 'En la nube · al día'}
                    </div>
                  </div>
                  {!link ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      leading={<CloudUpload size={14} strokeWidth={1.75} />}
                      disabled={uploading !== null}
                      onClick={() => void onUpload(c.id)}
                    >
                      {uploading === c.id ? 'Subiendo…' : 'Subir'}
                    </Button>
                  ) : pending > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      leading={<RefreshCw size={14} strokeWidth={1.75} />}
                      disabled={cloud.status === 'pushing'}
                      onClick={() => void pushPending()}
                    >
                      Reintentar
                    </Button>
                  ) : (
                    <Check size={18} className="text-accent" strokeWidth={2} aria-label="Al día" />
                  )}
                </div>
              );
            })}
            {cloud.error ? (
              <div className="p-3 border-t border-border flex items-start gap-2 text-caption text-error leading-relaxed">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" strokeWidth={1.75} />
                <span>{cloud.error}</span>
              </div>
            ) : null}
          </>
        )}
      </div>
      <p className="text-caption text-text-3 leading-relaxed mt-2">
        Los cambios se suben solos cuando hay señal. Sin señal la app funciona igual.
      </p>
    </section>
  );
}
