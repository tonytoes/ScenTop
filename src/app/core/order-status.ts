import { OrderStatus } from './models';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** The order a normal purchase moves through. Cancelled orders are shown separately. */
export const STATUS_STEPS: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered'];

export function statusBadge(status: OrderStatus): string {
  switch (status) {
    case 'delivered':
      return 'badge badge--success';
    case 'cancelled':
      return 'badge badge--danger';
    case 'pending':
      return 'badge badge--warning';
    default:
      return 'badge';
  }
}
