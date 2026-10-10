import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonIcon } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { Order } from '../../core/models';
import { STATUS_LABEL, STATUS_STEPS, statusBadge } from '../../core/order-status';
import { OrderService } from '../../core/order.service';
import { ToastService } from '../../core/toast.service';
import { PageComponent } from '../../layout/page/page.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { PesoPipe } from '../../shared/peso.pipe';

@Component({
  selector: 'app-order-detail',
  imports: [DatePipe, RouterLink, IonIcon, PageComponent, EmptyStateComponent, PesoPipe],
  templateUrl: './order-detail.page.html',
  styleUrl: './order-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailPage {
  private readonly orders = inject(OrderService);
  private readonly alerts = inject(AlertController);
  private readonly toast = inject(ToastService);

  /** From the address: /orders/:id */
  readonly id = input.required<string>();

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly cancelling = signal(false);

  protected readonly steps = STATUS_STEPS.map((status) => ({ status, label: STATUS_LABEL[status] }));
  protected readonly stepIndex = computed(() => STATUS_STEPS.indexOf(this.order()?.status ?? 'pending'));
  protected readonly badge = computed(() => statusBadge(this.order()?.status ?? 'pending'));
  protected readonly statusLabel = computed(() => STATUS_LABEL[this.order()?.status ?? 'pending']);

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => void this.load(id));
    });
  }

  protected readonly reload = () => this.load(Number(this.id()));

  protected async confirmCancel() {
    const alert = await this.alerts.create({
      header: 'Cancel this order?',
      message: 'This cannot be undone. You can always place a new order.',
      buttons: [
        { text: 'Keep order', role: 'cancel' },
        { text: 'Cancel order', role: 'confirm', cssClass: 'st-danger' },
      ],
    });
    await alert.present();

    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') await this.cancel();
  }

  private async cancel() {
    const order = this.order();
    if (!order) return;

    this.cancelling.set(true);
    try {
      this.order.set(await this.orders.cancel(order.id));
      await this.toast.show('Your order was cancelled');
    } catch (error) {
      await this.toast.show(errorMessage(error));
    } finally {
      this.cancelling.set(false);
    }
  }

  private async load(id: number) {
    this.loading.set(true);
    this.error.set('');
    try {
      this.order.set(await this.orders.get(id));
    } catch (error) {
      this.order.set(null);
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
