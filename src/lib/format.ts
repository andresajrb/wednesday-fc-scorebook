import { format, formatDistanceStrict, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/**
 * `new Date('2026-10-07')` es medianoche UTC: en Venezuela (UTC-4) eso cae el día
 * anterior. Las fechas sin hora (las de las jornadas) se leen como fecha local.
 */
function toDate(dateInput: string | number | Date): Date {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return parseISO(dateInput);
  }
  return new Date(dateInput);
}

export function formatDayShort(dateInput: string | number | Date): string {
  return cap(format(toDate(dateInput), "EEE d MMM", { locale: es }));
}

export function formatDayLong(dateInput: string | number | Date): string {
  return cap(format(toDate(dateInput), "EEEE d 'de' MMMM", { locale: es }));
}

export function formatTime(dateInput: string | number | Date): string {
  return format(new Date(dateInput), 'HH:mm');
}

export function formatRelative(from: string | number | Date, to: number = Date.now()): string {
  return formatDistanceStrict(new Date(from), new Date(to), { locale: es });
}

export function todayISODate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
