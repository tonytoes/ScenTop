import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

/** A friendly message for pages with nothing to show. Buttons go inside the tag. */
@Component({
  selector: 'app-empty-state',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: block; }
    .empty { display: flex; flex-direction: column; align-items: center; max-width: 420px; margin: 0 auto; padding: 56px 16px; text-align: center; }
    .icon {
      display: grid; place-items: center; width: 88px; height: 88px; margin-bottom: 20px;
      border-radius: 50%; background: var(--st-blush); color: var(--st-rose); font-size: 40px;
    }
    h2 { font-size: 1.9rem; }
    p { margin-top: 8px; color: var(--st-muted); }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 24px; }
  `,
  template: `
    <div class="empty">
      <div class="icon"><ion-icon [name]="icon()" /></div>
      <h2>{{ heading() }}</h2>
      @if (text()) {
        <p>{{ text() }}</p>
      }
      <div class="actions"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('sparkles-outline');
  readonly heading = input.required<string>();
  readonly text = input('');
}
