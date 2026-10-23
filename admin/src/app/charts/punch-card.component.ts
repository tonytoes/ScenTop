import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * When people shop: a weekday x hour grid of dots. Bigger, darker dots mean more orders.
 * Monday is shown first, the way a shop week reads.
 */
@Component({
  selector: 'app-punch-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(mouseleave)': 'hover.set(null)' },
  template: `
    <div class="grid" role="img" [attr.aria-label]="summary()">
      <span></span>
      @for (h of hours; track h) {
        <span class="hour">{{ h % 6 === 0 ? hourLabel(h) : '' }}</span>
      }
      @for (row of rows(); track row.day) {
        <span class="day">{{ row.label }}</span>
        @for (cell of row.cells; track cell.hour) {
          <span class="cell" (mouseenter)="hover.set(cell)">
            <i [style.width.%]="cell.size" [style.height.%]="cell.size" [style.background]="cell.color"></i>
          </span>
        }
      }
    </div>
    <div class="foot">
      <span class="muted">{{ hint() }}</span>
      <span class="scale" aria-hidden="true">
        less
        @for (s of [0.2, 0.45, 0.7, 1]; track s) {
          <i [style.width.px]="6 + s * 8" [style.height.px]="6 + s * 8" [style.background]="'rgba(var(--seq), ' + (0.25 + s * 0.75) + ')'"></i>
        }
        more
      </span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: 34px repeat(24, minmax(0, 1fr));
      gap: 3px;
      align-items: center;
    }
    .hour {
      font-size: 10px;
      color: var(--muted);
      white-space: nowrap;
    }
    .day {
      font-size: 11px;
      color: var(--ink-2);
    }
    .cell {
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--surface-2);
      cursor: default;
      i {
        display: block;
        border-radius: 50%;
        transition: transform 0.15s;
      }
      &:hover i {
        transform: scale(1.25);
      }
    }
    .foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
      font-size: 12px;
      flex-wrap: wrap;
    }
    .scale {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--muted);
      font-size: 11px;
      i {
        border-radius: 50%;
      }
    }
  `,
})
export class PunchCardComponent {
  readonly cells = input.required<{ day: number; hour: number; orders: number }[]>();

  protected readonly hours = Array.from({ length: 24 }, (_, h) => h);
  protected readonly hover = signal<{ day: number; hour: number; orders: number } | null>(null);
  protected readonly hourLabel = (h: number) => (h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`);

  private readonly max = computed(() => Math.max(1, ...this.cells().map((c) => c.orders)));

  protected readonly rows = computed(() => {
    const lookup = new Map(this.cells().map((c) => [`${c.day}-${c.hour}`, c.orders]));
    return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
      day,
      label: DAYS[day]!,
      cells: this.hours.map((hour) => {
        const orders = lookup.get(`${day}-${hour}`) ?? 0;
        const f = orders / this.max();
        return { day, hour, orders, size: orders ? 28 + Math.sqrt(f) * 72 : 0, color: `rgba(var(--seq), ${0.25 + f * 0.75})` };
      }),
    }));
  });

  private readonly busiest = computed(() => [...this.cells()].sort((a, b) => b.orders - a.orders)[0]);

  protected readonly hint = computed(() => {
    const h = this.hover();
    if (h) return `${DAYS[h.day]} ${this.hourLabel(h.hour)}–${this.hourLabel((h.hour + 1) % 24)}: ${h.orders} order${h.orders === 1 ? '' : 's'}`;
    const b = this.busiest();
    return b ? `Busiest: ${DAYS[b.day]} around ${this.hourLabel(b.hour)} (${b.orders} orders)` : 'No orders in this period yet';
  });

  protected readonly summary = computed(() => `Orders by weekday and hour. ${this.hint()}`);
}
