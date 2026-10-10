import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { PageComponent } from '../../layout/page/page.component';

const DEVELOPERS = [
  { name: 'Narvarte, Michael Ray R.', role: 'Project lead', photo: 'assets/members/Narvarte.avif' },
  { name: 'Lim, Michael Terrence F.', role: 'Front-end developer', photo: 'assets/members/Lim.avif' },
  { name: 'Cinco, Samuel James A.', role: 'Front-end developer', photo: 'assets/members/Cinco.avif' },
  { name: 'Demillo, Orland Gabriel E.', role: 'UI and UX designer', photo: 'assets/members/demillo.avif' },
  { name: 'Balungay, Anthony Miguel G.', role: 'Database developer', photo: 'assets/members/Balungay.avif' },
];

@Component({
  selector: 'app-developers',
  imports: [RouterLink, IonIcon, PageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .dev { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 24px 12px; text-align: center; }
    .avatar { display: grid; place-items: center; width: 96px; height: 96px; margin-bottom: 10px; overflow: hidden; border-radius: 50%; background: linear-gradient(135deg, var(--st-blush) 0%, var(--st-blush-deep) 100%); color: var(--st-rose-dark); font-size: 40px; box-shadow: 0 0 0 4px #fff, var(--st-shadow-sm); }
    .avatar img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; }
    .dev small { color: var(--st-muted); }
    .note { margin-top: 28px; color: var(--st-muted); text-align: center; }
    @media (min-width: 640px) { .grid { grid-template-columns: repeat(3, 1fr); } }
    @media (min-width: 960px) { .grid { grid-template-columns: repeat(5, 1fr); } }
  `,
  template: `
    <app-page>
      <header class="page-head">
        <div class="container">
          <span class="eyebrow">The team</span>
          <h1>Meet the developers</h1>
          <p>The students who designed and built ScenTop.</p>
        </div>
      </header>

      <section class="container section">
        <div class="grid">
          @for (dev of developers; track dev.name) {
            <article class="card dev reveal">
              <div class="avatar">
                @if (dev.photo) {
                  <img [src]="dev.photo" [alt]="'Photo of ' + dev.name" width="96" height="96" loading="lazy" />
                } @else {
                  <ion-icon name="person-outline" aria-hidden="true" />
                }
              </div>
              <strong>{{ dev.name }}</strong>
              <small>{{ dev.role }}</small>
            </article>
          }
        </div>
        <p class="note">Questions or feedback? <a routerLink="/contact">Get in touch</a>.</p>
      </section>
    </app-page>
  `,
})
export class DevelopersPage {
  protected readonly developers = DEVELOPERS;
}
