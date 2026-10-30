import type { AppState } from '@/types/domain';
import { activeScope } from './scope';
import { useStore } from './useStore';

/** Estado de la competición activa: es lo que deben leer las pantallas. */
export function useScopedState(): AppState {
  return useStore((s) => activeScope(s.state));
}
