import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { PageComponent } from '../../layout/page/page.component';

// TODO (team): replace the placeholders with the real names, roles and photos of the five developers.
const DEVELOPERS = [
  { name: 'Narvarte, Michael Ray R.', role: 'Project lead' },
  { name: 'Lim, Michael Terrence F.', role: 'Front-end developer' },
  { name: 'Cinco, Samuel James A. ', role: 'Front-end developer' },
  { name: 'Demillo Orland Gabriel E. ', role: 'UI and UX designer' },
  { name: 'Balungay, Anthony Miguel G.', role: 'Database developer' },
];

@Component({
  selector: 'app-developers',
  imports: [RouterLink, IonIcon, PageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .dev { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 24px 12px; text-align: center; }
    .avatar { display: grid; place-items: center; width: 88px; height: 88px; margin-bottom: 10px; border-radius: 50%; background: linear-gradient(135deg, var(--st-blush) 0%, var(--st-blush-deep) 100%); color: var(--st-rose-dark); font-size: 40px; box-shadow: 0 0 0 4px #fff, var(--st-shadow-sm); }
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
              <div class="avatar" aria-hidden="true"><ion-icon name="person-outline" /></div>
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
