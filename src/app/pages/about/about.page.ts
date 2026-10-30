import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { COMPANY } from '../../core/company';
import { PageComponent } from '../../layout/page/page.component';

// TODO (team): replace this placeholder story with the real ScenTop history, mission and vision.
@Component({
  selector: 'app-about',
  imports: [RouterLink, IonIcon, PageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .hero { display: block; width: 100%; height: clamp(220px, 40vw, 420px); object-fit: cover; border-radius: var(--st-radius-lg); box-shadow: var(--st-shadow); }
    .values { display: grid; gap: 16px; margin-top: 40px; }
    .value { padding: 24px; }
    .value h3 { margin-bottom: 8px; font-size: 1.7rem; }
    .value p { color: var(--st-muted); }
    .visit { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-top: 40px; padding: 24px; }
    .visit p { display: flex; align-items: center; gap: 8px; color: var(--st-muted); }
    .visit ion-icon { color: var(--st-rose); }
    @media (min-width: 768px) { .values { grid-template-columns: 1fr 1fr; } }
  `,
  template: `
    <app-page>
      <header class="page-head">
        <div class="container">
          <span class="eyebrow">Company history</span>
          <h1>Where scent can protect you</h1>
          <p>The story behind ScenTop, what we believe in, and where we are headed.</p>
        </div>
      </header>

      <section class="container section">
        <img class="hero reveal" src="assets/images/store.webp" alt="The ScenTop boutique on a busy street in Cubao, Quezon City" width="1408" height="768" />

        <div class="prose" style="margin-top: 36px">
          <h2>How we started</h2>
          <p>
            ScenTop is a perfume shop in Cubao, Quezon City. We began with a simple idea: choosing a scent should feel personal,
            not like guessing from a label. In the shop we let people try, compare and take their time.
          </p>
          <p>
            This app brings that same care online. Browse by scent family, read what other shoppers think, and have your favourites
            delivered to your door.
          </p>
        </div>

        <div class="values">
          <article class="card value">
            <h3>Our mission</h3>
            <p>To help every customer find a fragrance that fits who they are, with honest descriptions, fair prices and quality products.</p>
          </article>
          <article class="card value">
            <h3>Our vision</h3>
            <p>To be the most trusted place to buy perfume online in the Philippines, where scent can protect, comfort and inspire.</p>
          </article>
        </div>

        <div class="card visit">
          <div>
            <h3>Come and say hello</h3>
            <p><ion-icon name="location-outline" /> {{ company.address }}</p>
            <p><ion-icon name="time-outline" /> {{ company.hours }}</p>
          </div>
          <a class="btn btn--primary" routerLink="/contact">Contact us</a>
        </div>
      </section>
    </app-page>
  `,
})
export class AboutPage {
  protected readonly company = COMPANY;
}
