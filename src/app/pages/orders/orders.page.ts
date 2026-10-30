import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { Order } from '../../core/models';
import { STATUS_LABEL, statusBadge } from '../../core/order-status';
import { OrderService } from '../../core/order.service';
import { PageComponent } from '../../layout/page/page.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { PesoPipe } from '../../shared/peso.pipe';

@Component({
  selector: 'app-orders',
  imports: [DatePipe, RouterLink, IonIcon, PageComponent, EmptyStateComponent, PesoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './orders.page.scss',
  template: `
    <app-page [refresh]="reload">
      <header class="page-head">
        <div class="container">
          <span class="eyebrow">Your purchases</span>
          <h1>My orders</h1>
        </div>
      </header>

      <section class="container section">
        @if (loading() && orders().length === 0) {
          <div class="skeleton" style="height: 120px; margin-bottom: 12px"></div>
          <div class="skeleton" style="height: 120px"></div>
        } @else if (error()) {
          <div class="alert row">
            <span>{{ error() }}</span>
            <button type="button" class="btn btn--sm btn--danger" (click)="reload()">Try again</button>
          </div>
        } @else if (orders().length === 0) {
          <app-empty-state icon="receipt-outline" heading="No orders yet" text="When you place an order it will show up here so you can follow it.">
            <a class="btn btn--primary" routerLink="/shop">Start shopping</a>
          </app-empty-state>
        } @else {
          <ul class="orders">
            @for (order of orders(); track order.id) {
              <li>
                <a class="order card" [routerLink]="['/orders', order.id]">
                  <div class="order__top">
                    <div>
                      <strong>{{ order.orderNumber }}</strong>
                      <span class="muted">{{ order.createdAt | date: 'mediumDate' }}</span>
                    </div>
                    <span [class]="badge(order)">{{ label(order) }}</span>
                  </div>
                  <div class="order__mid">
                    <div class="thumbs">
                      @for (item of order.items.slice(0, 3); track $index) {
                        <img [src]="item.imageUrl" [alt]="item.name" width="48" height="48" />
                      }
                      @if (order.items.length > 3) {
                        <span class="more">+{{ order.items.length - 3 }}</span>
                      }
                    </div>
                    <div class="order__total">
                      <small class="muted">{{ order.itemCount }} {{ order.itemCount === 1 ? 'item' : 'items' }}</small>
                      <strong>{{ order.totalCents | peso }}</strong>
                    </div>
                    <ion-icon name="chevron-forward-outline" />
                  </div>
                </a>
              </li>
            }
          </ul>
        }
      </section>
    </app-page>
  `,
})
export class OrdersPage {
  private readonly service = inject(OrderService);

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly badge = (order: Order) => statusBadge(order.status);
  protected readonly label = (order: Order) => STATUS_LABEL[order.status];

  protected readonly reload = () => this.load();

  ionViewWillEnter() {
    void this.load();
  }

  private async load() {
    this.error.set('');
    this.loading.set(true);
    try {
      this.orders.set(await this.service.list());
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
