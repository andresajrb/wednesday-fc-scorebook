import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Button } from '@/components/primitives/Button';
import { cloudEnabled } from '@/sync/client';
import { InvalidInviteError, useCloud } from '@/sync/useCloud';

/** Se abrió un link de invitación: pide el nombre, entra al grupo y baja sus datos. */
export function JoinSheet() {
  const pendingInvite = useCloud((s) => s.pendingInvite);
  const joinWithInvite = useCloud((s) => s.joinWithInvite);
  const cancelInvite = useCloud((s) => s.cancelInvite);
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  if (!cloudEnabled || !pendingInvite) return null;

  const onJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      await joinWithInvite(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setInvalid(err instanceof InvalidInviteError);
    } finally {
      setJoining(false);
    }
  };

  return (
    <BottomSheet
      open
      onClose={cancelInvite}
      dismissable={!joining}
      title="Te invitaron a una competición"
    >
      <div className="space-y-3" data-sheet="join">
        <p className="text-caption text-text-2 leading-relaxed">
          Escribe tu nombre para que el organizador sepa quién entró. No hace falta registrarse.
        </p>
        <input
          autoComplete="name"
          placeholder="Tu nombre"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) void onJoin();
          }}
          className="w-full h-11 px-3 bg-bg-elev2 border border-border rounded-btn outline-none focus:border-accent text-body"
          aria-label="Tu nombre"
        />
        {!invalid && (
          <Button
            size="lg"
            fullWidth
            leading={<LogIn size={18} strokeWidth={1.75} />}
            disabled={joining || !name.trim()}
            onClick={() => void onJoin()}
          >
            {joining ? 'Entrando y bajando los datos…' : 'Entrar'}
          </Button>
        )}
        {error ? <p className="text-caption text-error leading-relaxed">{error}</p> : null}
        <Button
          variant={invalid ? 'secondary' : 'ghost'}
          size="md"
          fullWidth
          disabled={joining}
          onClick={cancelInvite}
        >
          {invalid ? 'Cerrar' : 'Ahora no'}
        </Button>
      </div>
    </BottomSheet>
  );
}
