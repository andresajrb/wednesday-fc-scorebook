import { useEffect } from 'react';
import { needsOnboarding, useStore } from '@/store/useStore';
import { getOpenJornada } from '@/store/selectors';
import { activeScope } from '@/store/scope';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { WriteErrorBanner } from '@/components/WriteErrorBanner';
import { requestPersistentStorage } from '@/lib/storage-health';
import { useMatchAlarms } from '@/lib/useMatchAlarms';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { JornadaSetupScreen } from '@/screens/JornadaSetupScreen';
import { TablaScreen } from '@/screens/TablaScreen';
import { JornadaActivaScreen } from '@/screens/JornadaActivaScreen';
import { RegistrarPartidaScreen } from '@/screens/RegistrarPartidaScreen';
import { ResumenJornadaScreen } from '@/screens/ResumenJornadaScreen';
import { DetalleEquipoScreen } from '@/screens/DetalleEquipoScreen';
import { ConfiguracionScreen } from '@/screens/ConfiguracionScreen';
import type { Screen } from '@/types/domain';

function renderScreen(screen: Screen) {
  switch (screen.name) {
    case 'onboarding':
      return <OnboardingScreen newCompetitionName={screen.newCompetitionName} />;
    case 'home':
      return <HomeScreen />;
    case 'jornada-setup':
      return <JornadaSetupScreen />;
    case 'season':
      return <TablaScreen />;
    case 'jornada-active':
      return <JornadaActivaScreen jornadaId={screen.jornadaId} />;
    case 'match-record':
      return <RegistrarPartidaScreen matchId={screen.matchId} />;
    case 'summary':
      return <ResumenJornadaScreen jornadaId={screen.jornadaId} />;
    case 'team-detail':
      return <DetalleEquipoScreen teamId={screen.teamId} />;
    case 'settings':
      return <ConfiguracionScreen />;
  }
}

export default function App() {
  const screen = useStore((s) => s.ui.currentScreen);
  useMatchAlarms();

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // Atajo del manifest ("Iniciar jornada de hoy"). Corre después de la compuerta
  // de hidratación, así que `state` ya es el real y no crea una jornada duplicada.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'start-jornada') return;
    window.history.replaceState({}, '', window.location.pathname);
    const store = useStore.getState();
    if (needsOnboarding(store.state)) return;
    const open = getOpenJornada(activeScope(store.state));
    store.navigate(open ? { name: 'jornada-active', jornadaId: open.id } : { name: 'jornada-setup' });
  }, []);

  return (
    <>
      <WriteErrorBanner />
      {renderScreen(screen)}
      <UpdatePrompt />
    </>
  );
}
