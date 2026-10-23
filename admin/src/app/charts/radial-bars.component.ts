import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatPeso } from '../core/format';
import { arcPath } from './geometry';

export interface RadialItem {
  label: string;
  value: number;
  /** CSS colour, e.g. var(--s1). */
  color: string;
}

/** Concentric arcs, one per item, the longest at the outside. Labels sit at the start of each arc. */
@Component({
  selector: 'app-radial-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 240 240" role="img" aria-label="Revenue by category">
      @for (ring of rings(); track ring.label) {
        <path class="track" [attr.d]="ring.track" />
        <path class="bar" [attr.d]="ring.path" [style.stroke]="ring.color" [class.dim]="active() !== null && active() !== ring.label"
          (mouseenter)="active.set(ring.label)" (mouseleave)="active.set(null)" />
        <text [attr.x]="114" [attr.y]="ring.labelY" text-anchor="end">{{ ring.label }}</text>
      }
    </svg>
    <div class="center">
      @if (activeItem(); as a) {
        <b class="display">{{ a.share }}</b>
        <small>{{ a.label }} · {{ a.value }}</small>
      } @else {
        <b class="display">{{ totalLabel() }}</b>
        <small>all categories</small>
      }
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      max-width: 320px;
      margin: 0 auto;
    }
    svg {
      width: 100%;
      display: block;
    }
    path {
      fill: none;
      stroke-linecap: round;
      stroke-width: 11;
    }
    .track {
      stroke: var(--surface-3);
    }
    .bar {
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .bar.dim {
      opacity: 0.25;
    }
    text {
      fill: var(--ink-2);
      font-size: 9px;
      font-weight: 500;
    }
    .center {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
      width: 34%;
      b {
        display: block;
        font-size: 22px;
      }
      small {
        display: block;
        color: var(--muted);
        font-size: 10px;
        line-height: 1.2;
      }
    }
  `,
})
export class RadialBarsComponent {
  readonly items = input.required<RadialItem[]>();
  protected readonly active = signal<string | null>(null);

  private readonly sorted = computed(() => [...this.items()].sort((a, b) => b.value - a.value));
  private readonly total = computed(() => this.items().reduce((s, i) => s + i.value, 0));

  protected readonly rings = computed(() => {
    const items = this.sorted();
    const max = Math.max(...items.map((i) => i.value), 1);
    // Each arc can go up to 3/4 of a circle, starting at 12 o'clock
    return items.map((item, i) => {
      const r = 108 - i * 16;
      return {
        ...item,
        track: arcPath(120, 120, r, 0, Math.PI * 1.5),
        path: item.value > 0 ? arcPath(120, 120, r, 0, Math.max(0.03, (item.value / max) * Math.PI * 1.5)) : '',
        labelY: 120 - r + 3,
      };
    });
  });

  protected readonly totalLabel = computed(() => formatPeso(this.total(), 'short'));
  protected readonly activeItem = computed(() => {
    const item = this.items().find((i) => i.label === this.active());
    if (!item) return null;
    return { label: item.label, value: formatPeso(item.value, 'short'), share: `${Math.round((item.value / (this.total() || 1)) * 100)}%` };
  });
}
