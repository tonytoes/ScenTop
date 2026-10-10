import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANY } from '../../core/company';
import { PageComponent } from '../../layout/page/page.component';

interface FaqGroup {
  title: string;
  questions: { q: string; a: string }[];
}

const GROUPS: FaqGroup[] = [
  {
    title: 'Products',
    questions: [
      { q: 'Are your perfumes safe to wear?', a: 'Our products are high-quality and made from safe ingredients. Each product page lists its main scent notes so you know what to expect.' },
      { q: 'What sizes do you sell?', a: 'Every perfume comes in a 50 ml and a 100 ml bottle. Pick the size on the product page before adding it to your cart.' },
      { q: 'How do I choose a scent?', a: 'Start with a scent family you like (floral, refreshing, gourmand, signature or verdant), then read the scent notes and customer reviews. You can also visit our shop and try before you buy.' },
    ],
  },
  {
    title: 'Orders and delivery',
    questions: [
      { q: 'How do I pay?', a: 'We accept cash on delivery. You pay the rider when your order arrives.' },
      { q: 'How much is shipping?', a: 'Shipping is a flat ₱50.00 per order, shown in your cart and at checkout before you place the order.' },
      { q: 'Can I cancel an order?', a: 'Yes, as long as it is still pending. Open My orders, choose the order and tap Cancel order. Once the shop has confirmed it, please contact us.' },
      { q: 'Where can I see my orders?', a: 'Log in and open My orders from the menu or from Settings. Each order shows its status from pending to delivered.' },
    ],
  },
  {
    title: 'Your account',
    questions: [
      { q: 'Do I need an account to shop?', a: 'You can browse, save perfumes and fill your cart without one. You need an account to check out so we know where to deliver.' },
      { q: 'Will my cart be kept when I log in?', a: 'Yes. Anything you added as a guest is moved into your account when you log in or sign up.' },
      { q: 'How do I delete my account?', a: 'Open Profile and choose Delete my account. We remove your profile, cart, wishlist and reviews.' },
    ],
  },
];

@Component({
  selector: 'app-faq',
  imports: [RouterLink, PageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .wrap { max-width: 760px; }
    h2 { margin: 32px 0 12px; font-size: 1.9rem; }
    h2:first-of-type { margin-top: 0; }
    details { margin-bottom: 10px; border: 1px solid var(--st-line); border-radius: 16px; background: #fff; transition: box-shadow 0.2s ease; }
    details[open] { box-shadow: var(--st-shadow-sm); border-color: var(--st-rose-soft); }
    summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; font-weight: 500; list-style: none; cursor: pointer; }
    summary::-webkit-details-marker { display: none; }
    summary::after { content: '+'; flex: none; color: var(--st-rose); font-size: 24px; line-height: 1; transition: transform 0.2s ease; }
    details[open] summary::after { transform: rotate(45deg); }
    details p { padding: 0 18px 18px; color: var(--st-muted); line-height: 1.7; }
    .help { margin-top: 36px; padding: 24px; text-align: center; background: var(--st-blush); }
    .help p { margin: 6px 0 14px; color: var(--st-muted); }
  `,
  template: `
    <app-page back="/settings">
      <header class="page-head">
        <div class="container">
          <span class="eyebrow">Help</span>
          <h1>Frequently asked questions</h1>
        </div>
      </header>

      <section class="container section wrap">
        @for (group of groups; track group.title) {
          <h2>{{ group.title }}</h2>
          @for (item of group.questions; track item.q) {
            <details>
              <summary>{{ item.q }}</summary>
              <p>{{ item.a }}</p>
            </details>
          }
        }

        <div class="card help">
          <h2 style="margin: 0">Still need help?</h2>
          <p>Write to {{ company.email }} or send us a message.</p>
          <a class="btn btn--primary" routerLink="/contact">Contact us</a>
        </div>
      </section>
    </app-page>
  `,
})
export class FaqPage {
  protected readonly groups = GROUPS;
  protected readonly company = COMPANY;
}
