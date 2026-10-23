import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface WaffleItem {
  label: string;
  value: number;
  color: string;
}

/** A 10 x 10 grid where each square is 1% of the total. Good for "who buys" splits. */
@Component({
  selector: 'app-waffle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="squares" role="img" [attr.aria-label]="ariaLabel()">
      @for (cell of cells(); track $index) {
        <i [style.background]="cell.color" [class.dim]="active() !== null && active() !== cell.label"></i>
      }
    </div>
    <ul>
      @for (item of shares(); track item.label) {
        <li (mouseenter)="active.set(item.label)" (mouseleave)="active.set(null)">
          <i [style.background]="item.color"></i>
          <span>{{ item.label }}</span>
          <b class="tabular">{{ item.pct }}%</b>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: center;
    }
    .squares {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 3px;
      max-width: 210px;
      i {
        aspect-ratio: 1;
        border-radius: 4px;
        transition: opacity 0.15s;
      }
      .dim {
        opacity: 0.18;
      }
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }
    li {
      display: grid;
      grid-template-columns: 10px 1fr auto;
      gap: 8px;
      align-items: center;
      font-size: 13px;
      cursor: default;
      i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
      span {
        color: var(--ink-2);
        text-transform: capitalize;
      }
      b {
        font-weight: 600;
      }
    }
  `,
})
export class WaffleComponent {
  readonly items = input.required<WaffleItem[]>();
  readonly ariaLabel = input('');
  protected readonly active = signal<string | null>(null);

  /** Whole percentages that always add up to 100 (largest remainder). */
  protected readonly shares = computed(() => {
    const items = this.items();
    const total = items.reduce((s, i) => s + i.value, 0);
    if (!total) return items.map((i) => ({ ...i, pct: 0 }));
    const raw = items.map((i) => (i.value / total) * 100);
    const pct = raw.map(Math.floor);
    let left = 100 - pct.reduce((a, b) => a + b, 0);
    raw
      .map((r, i) => ({ i, rest: r - Math.floor(r) }))
      .sort((a, b) => b.rest - a.rest)
      .forEach(({ i }) => {
        if (left-- > 0) pct[i]!++;
      });
    return items.map((item, i) => ({ ...item, pct: pct[i]! }));
  });

  protected readonly cells = computed(() => {
    const cells = this.shares().flatMap((s) => Array.from({ length: s.pct }, () => ({ label: s.label, color: s.color })));
    while (cells.length < 100) cells.push({ label: '', color: 'var(--surface-3)' });
    return cells;
  });
}
