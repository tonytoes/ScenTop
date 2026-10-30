import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, model } from '@angular/core';
import { IonIcon } from '@ionic/angular';

/**
 * Five stars.
 *   <app-rating-stars [value]="4.5" [count]="12" />          shows a rating
 *   <app-rating-stars [(value)]="rating" interactive />        lets people pick one
 */
@Component({
  selector: 'app-rating-stars',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 6px; }
    .stars { display: inline-flex; color: #d9a21b; font-size: var(--size, 16px); }
    button { padding: 2px; border: 0; background: none; color: inherit; font-size: inherit; line-height: 0; cursor: pointer; }
    .meta { color: var(--st-muted); font-size: 12.5px; }
    .meta strong { color: var(--st-ink); font-weight: 600; }
  `,
  template: `
    <span class="stars" [attr.role]="interactive() ? 'radiogroup' : 'img'" [attr.aria-label]="label()">
      @for (star of stars(); track $index) {
        @if (interactive()) {
          <button type="button" role="radio" [attr.aria-checked]="value() === $index + 1" [attr.aria-label]="$index + 1 + ' of 5 stars'" (click)="value.set($index + 1)">
            <ion-icon [name]="star" />
          </button>
        } @else {
          <ion-icon [name]="star" />
        }
      }
    </span>
    @if (count() !== null) {
      <span class="meta"><strong>{{ value().toFixed(1) }}</strong> ({{ count() }})</span>
    }
  `,
})
export class RatingStarsComponent {
  readonly value = model(0);
  readonly count = input<number | null>(null);
  readonly interactive = input(false, { transform: booleanAttribute });

  protected readonly label = computed(() => (this.interactive() ? 'Choose a rating' : `Rated ${this.value().toFixed(1)} out of 5`));

  /** Icon names for the five stars: full, half or empty. */
  protected readonly stars = computed(() => {
    const value = this.value();
    return [1, 2, 3, 4, 5].map((n) => (value >= n - 0.25 ? 'star' : value >= n - 0.75 ? 'star-half' : 'star-outline'));
  });
}
