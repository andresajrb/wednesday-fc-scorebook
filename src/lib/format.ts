import { format, formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export function formatDayShort(dateInput: string | number | Date): string {
  return cap(format(new Date(dateInput), "EEE d MMM", { locale: es }));
}

export function formatDayLong(dateInput: string | number | Date): string {
  return cap(format(new Date(dateInput), "EEEE d 'de' MMMM", { locale: es }));
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
