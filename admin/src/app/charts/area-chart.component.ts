import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatPeso } from '../core/format';
import { hostWidth, longDate, niceMax, shortDate, smoothPath } from './geometry';

export interface AreaPoint {
  date: string;
  value: number;
  previous: number;
}

/**
 * Revenue over time on the dark statement card: a glowing area for this period and a
 * dashed line for the same days of the previous period. Hover for a crosshair.
 */
@Component({
  selector: 'app-area-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(mouseleave)': 'hover.set(null)' },
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" (mousemove)="move($event)" (touchstart)="touch($event)" (touchmove)="touch($event)" role="img" [attr.aria-label]="label()">
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e8798f" stop-opacity="0.55" />
          <stop offset="1" stop-color="#e8798f" stop-opacity="0" />
        </linearGradient>
      </defs>

      @for (tick of ticks(); track tick.y) {
        <line class="grid" [attr.x1]="pad.left" [attr.x2]="width() - pad.right" [attr.y1]="tick.y" [attr.y2]="tick.y" />
        <text class="axis" [attr.x]="pad.left - 8" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.label }}</text>
      }
      @for (tick of xTicks(); track tick.x) {
        <text class="axis" [attr.x]="tick.x" [attr.y]="height() - 6" text-anchor="middle">{{ tick.label }}</text>
      }

      <path class="fill" [attr.d]="areaPath()" fill="url(#area-fill)" />
      <path class="prev" [attr.d]="previousPath()" />
      <path class="line" [attr.d]="linePath()" />

      @if (hovered(); as h) {
        <line class="cross" [attr.x1]="h.x" [attr.x2]="h.x" [attr.y1]="pad.top" [attr.y2]="height() - pad.bottom" />
        <circle class="dot-prev" [attr.cx]="h.x" [attr.cy]="h.py" r="4" />
        <circle class="dot" [attr.cx]="h.x" [attr.cy]="h.y" r="6" />
      }
    </svg>
    @if (hovered(); as h) {
      <div class="tip" [style.left.px]="h.x" [style.top.px]="h.y">
        <b>{{ h.date }}</b><br />
        {{ h.value }} <span class="faint">· before: {{ h.prev }}</span>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      user-select: none;
    }
    svg {
      display: block;
      overflow: visible;
    }
    .grid {
      stroke: rgba(255, 255, 255, 0.08);
    }
    .axis {
      fill: var(--hero-muted);
      font-size: 11px;
    }
    .line {
      fill: none;
      stroke: #f2a3b3;
      stroke-width: 2.5;
      stroke-linecap: round;
    }
    .prev {
      fill: none;
      stroke: rgba(255, 255, 255, 0.35);
      stroke-width: 1.5;
      stroke-dasharray: 4 5;
    }
    .cross {
      stroke: rgba(255, 255, 255, 0.3);
    }
    .dot {
      fill: #f2a3b3;
      stroke: var(--hero);
      stroke-width: 3;
    }
    .dot-prev {
      fill: var(--hero);
      stroke: rgba(255, 255, 255, 0.6);
      stroke-width: 1.5;
    }
    .tip {
      background: #fff;
      color: #1f1a24;
    }
    .faint {
      opacity: 0.6;
    }
  `,
})
export class AreaChartComponent {
  readonly points = input.required<AreaPoint[]>();
  readonly height = input(260);

  protected readonly width = hostWidth();
  protected readonly hover = signal<number | null>(null);
  protected readonly pad = { top: 16, right: 8, bottom: 26, left: 52 };

  private readonly max = computed(() => niceMax(Math.max(...this.points().flatMap((p) => [p.value, p.previous]), 0)));

  private readonly x = (i: number) => {
    const n = Math.max(this.points().length - 1, 1);
    return this.pad.left + (i / n) * (this.width() - this.pad.left - this.pad.right);
  };
  private readonly y = (v: number) => this.pad.top + (1 - v / this.max()) * (this.height() - this.pad.top - this.pad.bottom);

  private readonly coords = computed(() => this.points().map((p, i) => ({ x: this.x(i), y: this.y(p.value) })));

  protected readonly linePath = computed(() => smoothPath(this.coords()));
  protected readonly previousPath = computed(() => smoothPath(this.points().map((p, i) => ({ x: this.x(i), y: this.y(p.previous) }))));
  protected readonly areaPath = computed(() => {
    const c = this.coords();
    if (c.length === 0) return '';
    const base = this.height() - this.pad.bottom;
    return `${smoothPath(c)} L${c[c.length - 1]!.x},${base} L${c[0]!.x},${base} Z`;
  });

  protected readonly ticks = computed(() =>
    [0, 0.5, 1].map((f) => ({ y: this.y(this.max() * f), label: formatPeso(this.max() * f, 'short') })),
  );

  protected readonly xTicks = computed(() => {
    const points = this.points();
    const count = Math.min(points.length, Math.max(2, Math.floor(this.width() / 110)));
    const step = (points.length - 1) / Math.max(count - 1, 1);
    return Array.from({ length: count }, (_, k) => Math.round(k * step)).map((i) => ({ x: this.x(i), label: shortDate(points[i]!.date) }));
  });

  protected readonly hovered = computed(() => {
    const i = this.hover();
    const p = i === null ? undefined : this.points()[i];
    if (i === null || !p) return null;
    return { x: this.x(i), y: this.y(p.value), py: this.y(p.previous), date: longDate(p.date), value: formatPeso(p.value, 'whole'), prev: formatPeso(p.previous, 'whole') };
  });

  protected readonly label = computed(() => `Revenue per day, ${this.points().length} days`);

  protected move(event: MouseEvent) {
    this.pick(event.offsetX);
  }

  protected touch(event: TouchEvent) {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    this.pick(event.touches[0]!.clientX - rect.left);
  }

  private pick(px: number) {
    const n = this.points().length;
    if (n === 0) return;
    const f = (px - this.pad.left) / (this.width() - this.pad.left - this.pad.right);
    this.hover.set(Math.max(0, Math.min(n - 1, Math.round(f * (n - 1)))));
  }
}
