import { Pipe, PipeTransform } from '@angular/core';
import type { OrderStatus } from './models';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const pesoWhole = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 });

export type PesoStyle = 'full' | 'whole' | 'short';

/** Centavos to pesos. `| peso:'short'` gives ₱12.4K, `| peso:'whole'` drops the centavos. */
@Pipe({ name: 'peso' })
export class PesoPipe implements PipeTransform {
  transform(cents: number | null | undefined, style: PesoStyle = 'full'): string {
    return formatPeso(cents ?? 0, style);
  }
}

export function formatPeso(cents: number, style: PesoStyle = 'full'): string {
  const pesos = cents / 100;
  if (style === 'short') return `₱${compact.format(pesos)}`;
  return (style === 'whole' ? pesoWhole : peso).format(pesos);
}

export const formatCompact = (n: number) => compact.format(n);

/** "3 min ago", "yesterday", "12 Mar". */
@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    const seconds = (Date.now() - date.getTime()) / 1000;
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
    if (seconds < 172_800) return 'yesterday';
    if (seconds < 604_800) return `${Math.floor(seconds / 86_400)} days ago`;
    return date.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** The next step for an order, or null when it is finished. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  return ({ pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' } as Partial<Record<OrderStatus, OrderStatus>>)[status] ?? null;
}

export const NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  pending: 'Confirm order',
  confirmed: 'Mark as shipped',
  shipped: 'Mark as delivered',
};

/** Initials for an avatar. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

/** Relative change, or null when there is nothing to compare with. */
export function change(value: number, previous: number): number | null {
  if (!previous) return value ? null : 0;
  return (value - previous) / previous;
}
