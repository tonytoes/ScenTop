import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApi, errorMessage } from '../../core/api';
import { AgoPipe, NEXT_ACTION, PesoPipe, STATUS_LABEL, nextStatus } from '../../core/format';
import { ORDER_STATUSES, type Order, type OrderPage, type OrderStatus } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { UiService } from '../../shared/ui.service';

const PAGE_SIZE = 20;
const STEPS: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered'];

@Component({
  selector: 'app-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, PesoPipe, AgoPipe],
  templateUrl: './orders.page.html',
  styleUrl: './orders.page.scss',
})
export class OrdersPage {
  private readonly api = inject(AdminApi);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  /** From the address bar: ?status=pending&id=12 */
  readonly status = input<OrderStatus | undefined>();
  readonly id = input<string | undefined>();

  protected readonly statuses = ORDER_STATUSES;
  protected readonly label = STATUS_LABEL;
  protected readonly steps = STEPS;
  protected readonly nextAction = NEXT_ACTION;
  protected readonly nextStatus = nextStatus;

  protected readonly page = signal<OrderPage | null>(null);
  protected readonly offset = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected query = '';

  protected readonly selected = signal<Order | null>(null);
  protected readonly saving = signal(false);

  protected readonly allCount = computed(() => Object.values(this.page()?.counts ?? {}).reduce((a, b) => a + b, 0));
  protected readonly range = computed(() => {
    const total = this.page()?.total ?? 0;
    return { from: total ? this.offset() + 1 : 0, to: Math.min(this.offset() + PAGE_SIZE, total), total };
  });

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Reload whenever the status tab in the address changes
    effect(() => {
      this.status();
      untracked(() => {
        this.offset.set(0);
        void this.load();
      });
    });
    effect(() => {
      const id = Number(this.id());
      untracked(() => (id ? void this.open(id) : this.selected.set(null)));
    });
  }

  protected setStatus(status: OrderStatus | undefined) {
    void this.router.navigate([], { queryParams: { status: status ?? null, id: null }, queryParamsHandling: 'merge' });
  }

  protected search() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.offset.set(0);
      void this.load();
    }, 250);
  }

  protected go(delta: number) {
    this.offset.update((o) => Math.max(0, o + delta * PAGE_SIZE));
    void this.load();
  }

  protected async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(await this.api.orders({ status: this.status(), q: this.query, limit: PAGE_SIZE, offset: this.offset() }));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected select(order: Order) {
    void this.router.navigate([], { queryParams: { id: order.id }, queryParamsHandling: 'merge' });
  }

  protected close() {
    void this.router.navigate([], { queryParams: { id: null }, queryParamsHandling: 'merge' });
  }

  private async open(id: number) {
    const fromList = this.page()?.items.find((o) => o.id === id);
    if (fromList) this.selected.set(fromList);
    try {
      this.selected.set(await this.api.order(id));
    } catch (error) {
      this.ui.toast(errorMessage(error), 'error');
      this.close();
    }
  }

  protected async setOrderStatus(order: Order, status: OrderStatus) {
    if (status === 'cancelled') {
      const ok = await this.ui.confirm({
        title: `Cancel ${order.orderNumber}?`,
        text: 'The customer will see this order as cancelled. It no longer counts towards sales.',
        action: 'Cancel order',
        danger: true,
      });
      if (!ok) return;
    }
    this.saving.set(true);
    try {
      const updated = await this.api.setOrderStatus(order.id, status);
      this.selected.set(updated);
      this.ui.toast(`${order.orderNumber} is now ${STATUS_LABEL[status].toLowerCase()}`);
      await this.load();
    } catch (error) {
      this.ui.toast(errorMessage(error), 'error');
    } finally {
      this.saving.set(false);
    }
  }

  protected stepState(order: Order, step: OrderStatus): 'done' | 'current' | 'todo' {
    if (order.status === 'cancelled') return 'todo';
    const at = STEPS.indexOf(order.status);
    const i = STEPS.indexOf(step);
    return i < at ? 'done' : i === at ? 'current' : 'todo';
  }
}
