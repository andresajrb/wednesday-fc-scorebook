import type { ReactNode } from 'react';
import { useStore } from '@/store/useStore';
import { Logo } from '@/components/primitives/Logo';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { RecoveryScreen } from '@/components/RecoveryScreen';

interface HydrationBoundaryProps {
  children: ReactNode;
}

/**
 * Nada se monta hasta que la hidratación termina. Antes, la app renderizaba con
 * el estado inicial vacío mientras IndexedDB todavía respondía: eso mostraba un
 * flash de Onboarding aunque hubiera datos, y un toque en ese flash regeneraba
 * los equipos dejando a todos los jugadores huérfanos.
 */
export function HydrationBoundary({ children }: HydrationBoundaryProps) {
  const hydrationSettled = useStore((s) => s.hydrationSettled);
  const hydrateError = useStore((s) => s.hydrateError);

  if (!hydrationSettled) return <SplashScreen />;
  if (hydrateError) return <RecoveryScreen error={hydrateError} />;
  return <>{children}</>;
}

function SplashScreen() {
  return (
    <ScreenShell>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-accent">
        <Logo size={72} className="animate-pulse-dot" />
        <span className="sr-only">Cargando tus datos…</span>
      </div>
    </ScreenShell>
  );
}
