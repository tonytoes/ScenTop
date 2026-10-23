import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { shortDate } from './geometry';

/**
 * Weekly orders split around a centre line: first-time buyers grow upwards,
 * returning buyers grow downwards. Shows whether growth is new people or loyal ones.
 */
@Component({
  selector: 'app-mirror-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(mouseleave)': 'hover.set(null)' },
  template: `
    <div class="legend">
      <span><i class="up"></i>First order</span>
      <span><i class="down"></i>Came back</span>
    </div>
    <div class="plot" role="img" [attr.aria-label]="ariaLabel()">
      @for (week of weeks(); track week.week) {
        <div class="col" (mouseenter)="hover.set(week)">
          <div class="half top"><i class="up" [style.height.%]="week.upPct"></i></div>
          <div class="half bottom"><i class="down" [style.height.%]="week.downPct"></i></div>
        </div>
      }
      <hr />
    </div>
    <p class="hint muted">
      @if (hover(); as h) {
        Week of {{ h.label }}: <b>{{ h.first }}</b> first orders, <b>{{ h.repeat }}</b> repeat
      } @else {
        {{ repeatShare() }}% of orders in this period came from returning customers
      }
    </p>
  `,
  styles: `
    :host {
      display: block;
    }
    .legend {
      display: flex;
      gap: 14px;
      font-size: 12px;
      color: var(--ink-2);
      margin-bottom: 10px;
      span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
    }
    .up {
      background: var(--s1);
    }
    .down {
      background: var(--s3);
    }
    .plot {
      position: relative;
      display: flex;
      gap: 3px;
      height: 170px;
    }
    hr {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      margin: 0;
      border: 0;
      border-top: 1px solid var(--line);
    }
    .col {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      border-radius: 6px;
      &:hover {
        background: var(--surface-2);
      }
    }
    .half {
      flex: 1;
      display: flex;
      padding: 1px 15%;
      i {
        width: 100%;
        display: block;
      }
    }
    .top {
      align-items: flex-end;
      i {
        border-radius: 4px 4px 1px 1px;
      }
    }
    .bottom {
      align-items: flex-start;
      i {
        border-radius: 1px 1px 4px 4px;
      }
    }
    .hint {
      margin: 10px 0 0;
      font-size: 12px;
      b {
        color: var(--ink);
      }
    }
  `,
})
export class MirrorBarsComponent {
  readonly data = input.required<{ week: string; first: number; repeat: number }[]>();
  protected readonly hover = signal<{ label: string; first: number; repeat: number } | null>(null);

  protected readonly weeks = computed(() => {
    const max = Math.max(1, ...this.data().flatMap((w) => [w.first, w.repeat]));
    return this.data().map((w) => ({ ...w, label: shortDate(w.week), upPct: (w.first / max) * 100, downPct: (w.repeat / max) * 100 }));
  });

  protected readonly repeatShare = computed(() => {
    const first = this.data().reduce((s, w) => s + w.first, 0);
    const repeat = this.data().reduce((s, w) => s + w.repeat, 0);
    return first + repeat ? Math.round((repeat / (first + repeat)) * 100) : 0;
  });

  protected readonly ariaLabel = computed(() => `First and repeat orders per week. ${this.repeatShare()}% repeat.`);
}
