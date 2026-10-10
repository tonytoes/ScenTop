import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANY } from '../../core/company';
import { PageComponent } from '../../layout/page/page.component';

// TODO (team): this is a plain-language starting point. Have it reviewed before real customers use the shop.
@Component({
  selector: 'app-terms',
  imports: [RouterLink, PageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page back="/settings">
      <header class="page-head">
        <div class="container">
          <span class="eyebrow">Legal</span>
          <h1>Terms and conditions</h1>
        </div>
      </header>

      <section class="container section">
        <div class="prose">
          <p class="updated">Last updated: October 2026</p>

          <h2>Using ScenTop</h2>
          <p>
            By browsing the website or the app, creating an account or placing an order, you agree to these terms.
            You must give correct information, keep your password private and be responsible for what happens on your account.
          </p>

          <h2>Products and prices</h2>
          <ul>
            <li>Prices are in Philippine pesos (PHP) and are shown on each product page.</li>
            <li>Photos are for illustration. Bottles and packaging may look slightly different.</li>
            <li>We may change prices or remove products at any time. The price you see at checkout is the price you pay.</li>
          </ul>

          <h2>Payment and cancellation</h2>
          <p>
            We accept cash on delivery. You pay the rider when your order arrives. You can cancel an order yourself while it is
            pending. Once the shop has confirmed it, please contact us and we will do our best to help.
          </p>

          <h2>Shipment and delivery</h2>
          <p>
            Shipping is a flat fee of ₱50.00 per order. We will contact you on the phone number you give at checkout before delivery.
            Please make sure your address and number are correct. We cannot deliver orders that nobody can receive.
          </p>

          <h2>Reviews</h2>
          <p>
            Reviews should be honest and respectful. We may remove reviews that are abusive, unrelated to the product or not
            written by a real customer.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms? Write to {{ company.email }} or use the <a routerLink="/contact">contact page</a>.
            See also our <a routerLink="/privacy">privacy policy</a>.
          </p>
        </div>
      </section>
    </app-page>
  `,
})
export class TermsPage {
  protected readonly company = COMPANY;
}
