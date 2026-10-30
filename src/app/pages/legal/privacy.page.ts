import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANY } from '../../core/company';
import { PageComponent } from '../../layout/page/page.component';

// TODO (team): the facts below describe what the app really stores. Keep them in sync if that changes,
// and have the text reviewed before launch. App stores ask for a public link to this page.
@Component({
  selector: 'app-privacy',
  imports: [RouterLink, PageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page back="/settings">
      <header class="page-head">
        <div class="container">
          <span class="eyebrow">Legal</span>
          <h1>Privacy policy</h1>
        </div>
      </header>

      <section class="container section">
        <div class="prose">
          <p class="updated">Last updated: October 2026</p>

          <h2>What we collect</h2>
          <ul>
            <li><strong>Account details:</strong> your name, e-mail address, phone number and password. Passwords are stored in a scrambled (hashed) form, never as plain text.</li>
            <li><strong>Delivery details:</strong> the address, phone number and notes you enter at checkout or save in your profile.</li>
            <li><strong>Optional profile picture:</strong> only if you choose to add one.</li>
            <li><strong>Shopping activity:</strong> your cart, wishlist, orders and the reviews you write.</li>
            <li><strong>Messages:</strong> what you send us through the contact form.</li>
          </ul>

          <h2>How we use it</h2>
          <p>
            We use your information to run your account, deliver your orders, contact you about them and answer your messages.
            We do not sell your information and we do not show advertising.
          </p>

          <h2>Where it is kept</h2>
          <p>
            Your information is stored in a secure cloud database. On your phone or browser we keep a login token and, if you are not
            logged in, the items in your cart and wishlist, so the app remembers them.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>You can see and change your details in <a routerLink="/profile">your profile</a>.</li>
            <li>You can delete your account in your profile. This removes your profile, cart, wishlist and reviews. Past orders are kept for our records without your name, phone number or address.</li>
            <li>For anything else, write to {{ company.email }}.</li>
          </ul>

          <h2>Changes</h2>
          <p>If we change this policy we will update the date above.</p>
        </div>
      </section>
    </app-page>
  `,
})
export class PrivacyPage {
  protected readonly company = COMPANY;
}
