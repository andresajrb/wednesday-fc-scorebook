import { useStore } from '@/store/useStore';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { JornadaActivaScreen } from '@/screens/JornadaActivaScreen';
import { RegistrarPartidaScreen } from '@/screens/RegistrarPartidaScreen';
import { ResumenJornadaScreen } from '@/screens/ResumenJornadaScreen';
import { DetalleEquipoScreen } from '@/screens/DetalleEquipoScreen';
import { ConfiguracionScreen } from '@/screens/ConfiguracionScreen';

export default function App() {
  const screen = useStore((s) => s.ui.currentScreen);

  switch (screen.name) {
    case 'onboarding':
      return <OnboardingScreen />;
    case 'home':
      return <HomeScreen />;
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
