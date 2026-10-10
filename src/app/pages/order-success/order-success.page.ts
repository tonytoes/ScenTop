import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { Order } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { PageComponent } from '../../layout/page/page.component';
import { PesoPipe } from '../../shared/peso.pipe';

@Component({
  selector: 'app-order-success',
  imports: [DatePipe, RouterLink, IonIcon, PageComponent, PesoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './order-success.page.scss',
  template: `
    <app-page>
      <section class="container done">
        @if (order(); as o) {
          <div class="check reveal"><ion-icon name="checkmark" /></div>
          <h1 class="reveal">Thank you for your order</h1>
          <p class="lead">
            Your order <strong>{{ o.orderNumber }}</strong> was placed on {{ o.createdAt | date: 'longDate' }}. We will message you on {{ o.shipPhone }} before it is delivered.
          </p>

          <div class="card card--pad summary">
            <ul>
              @for (item of o.items; track $index) {
                <li>
                  <img [src]="item.imageUrl" [alt]="item.name" width="56" height="56" />
                  <span>{{ item.name }}<small>{{ item.sizeMl }} ml &times; {{ item.quantity }}</small></span>
                  <strong>{{ item.unitPriceCents * item.quantity | peso }}</strong>
                </li>
              }
            </ul>
            <dl>
              <div><dt>Shipping</dt><dd>{{ o.shippingFeeCents | peso }}</dd></div>
              <div class="total"><dt>Total to pay on delivery</dt><dd>{{ o.totalCents | peso }}</dd></div>
            </dl>
            <p class="deliver"><ion-icon name="location-outline" /> {{ o.shipName }}, {{ o.shipAddress }}</p>
          </div>

          <div class="actions">
            <a class="btn btn--primary" [routerLink]="['/orders', o.id]">View order</a>
            <a class="btn btn--ghost" routerLink="/shop">Continue shopping</a>
          </div>
        } @else if (error()) {
          <p class="alert">{{ error() }}</p>
          <a class="btn btn--primary" routerLink="/orders">See my orders</a>
        } @else {
          <div class="skeleton" style="height: 320px; width: 100%"></div>
        }
      </section>
    </app-page>
  `,
})
export class OrderSuccessPage {
  private readonly orders = inject(OrderService);

  readonly id = input.required<string>();
  protected readonly order = signal<Order | null>(null);
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => void this.load(id));
    });
  }

  private async load(id: number) {
    try {
      this.order.set(await this.orders.get(id));
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
