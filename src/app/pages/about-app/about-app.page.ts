import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { APP_VERSION } from '../../core/company';
import { NativeService } from '../../core/native.service';
import { PageComponent } from '../../layout/page/page.component';

@Component({
  selector: 'app-about-app',
  imports: [RouterLink, IonIcon, PageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .top { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
    .logo { width: 112px; height: 112px; margin-bottom: 8px; border-radius: 28px; box-shadow: var(--st-shadow); }
    .version { color: var(--st-muted); font-size: 14px; }
    .lead { max-width: 52ch; margin: 18px auto 0; color: var(--st-muted); text-align: center; }
    .features { display: grid; gap: 14px; margin: 36px 0 0; padding: 0; list-style: none; }
    .features li { display: flex; align-items: flex-start; gap: 14px; padding: 18px; }
    .features ion-icon { flex: none; width: 44px; height: 44px; padding: 10px; border-radius: 14px; background: var(--st-blush); color: var(--st-rose-dark); }
    .features strong { display: block; }
    .features span { color: var(--st-muted); font-size: 14px; }
    .tech { margin-top: 36px; color: var(--st-muted); font-size: 13.5px; text-align: center; }
    @media (min-width: 768px) { .features { grid-template-columns: 1fr 1fr; } }
  `,
  template: `
    <app-page>
      <section class="container section" style="max-width: 880px">
        <div class="top">
          <img class="logo" src="assets/icon/icon-512.png" alt="ScenTop app icon" width="112" height="112" />
          <h1>ScenTop</h1>
          <p class="version">Version {{ version }} &middot; {{ native.isNative ? 'Mobile app' : 'Website' }}</p>
        </div>
        <p class="lead">
          ScenTop is an online perfume shop that helps you find your signature scent. Browse by scent family, save your favourites
          and order in a few taps.
        </p>

        <ul class="features">
          <li class="card"><ion-icon name="sparkles-outline" /><div><strong>Browse and search</strong><span>Filter by scent family, who it is for, and price.</span></div></li>
          <li class="card"><ion-icon name="heart-outline" /><div><strong>Wishlist</strong><span>Save perfumes now and decide later, even before you log in.</span></div></li>
          <li class="card"><ion-icon name="cart-outline" /><div><strong>Cart and checkout</strong><span>Two bottle sizes, clear totals and cash on delivery.</span></div></li>
          <li class="card"><ion-icon name="receipt-outline" /><div><strong>Order tracking</strong><span>Follow each order from pending to delivered.</span></div></li>
          <li class="card"><ion-icon name="person-outline" /><div><strong>Your account</strong><span>Profile photo, saved address and your own reviews.</span></div></li>
          <li class="card"><ion-icon name="shield-checkmark-outline" /><div><strong>Private by design</strong><span>You can delete your account whenever you like.</span></div></li>
        </ul>

        <p class="tech">Built with Ionic, Angular, Capacitor, Express and Neon Postgres. <a routerLink="/developers">Meet the team</a></p>
      </section>
    </app-page>
  `,
})
export class AboutAppPage {
  protected readonly version = APP_VERSION;
  protected readonly native = inject(NativeService);
}
