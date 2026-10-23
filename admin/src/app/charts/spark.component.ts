import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { smoothPath } from './geometry';

/** A tiny trend for a stat tile: a line, bars, or a row of dots. No axes, no hover. */
@Component({
  selector: 'app-spark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 120 40" preserveAspectRatio="none">
      @switch (kind()) {
        @case ('bars') {
          @for (bar of bars(); track $index) {
            <rect [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.w" [attr.height]="bar.h" rx="1.5" [class.last]="$last" />
          }
        }
        @case ('dots') {
          @for (dot of dots(); track $index) {
            <circle [attr.cx]="dot.x" [attr.cy]="dot.y" [attr.r]="dot.r" [class.last]="$last" />
          }
        }
        @default {
          <path class="area" [attr.d]="area()" />
          <path class="line" [attr.d]="line()" vector-effect="non-scaling-stroke" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      height: 40px;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
      overflow: visible;
    }
    rect,
    circle {
      fill: var(--surface-3);
    }
    rect.last,
    circle.last {
      fill: var(--accent);
    }
    .line {
      fill: none;
      stroke: var(--accent);
      stroke-width: 2;
    }
    .area {
      fill: var(--accent-soft);
    }
  `,
})
export class SparkComponent {
  readonly values = input.required<number[]>();
  readonly kind = input<'line' | 'bars' | 'dots'>('line');

  private readonly max = computed(() => Math.max(1, ...this.values()));

  private readonly points = computed(() => {
    const v = this.values();
    return v.map((value, i) => ({ x: v.length > 1 ? (i / (v.length - 1)) * 120 : 60, y: 38 - (value / this.max()) * 34 }));
  });

  protected readonly line = computed(() => smoothPath(this.points()));
  protected readonly area = computed(() => {
    const p = this.points();
    return p.length ? `${smoothPath(p)} L120,40 L0,40 Z` : '';
  });

  protected readonly bars = computed(() => {
    const v = this.values();
    const w = 120 / Math.max(v.length, 1);
    return v.map((value, i) => {
      const h = Math.max(2, (value / this.max()) * 38);
      return { x: i * w + w * 0.15, w: w * 0.7, y: 40 - h, h };
    });
  });

  protected readonly dots = computed(() => {
    const v = this.values();
    const w = 120 / Math.max(v.length, 1);
    return v.map((value, i) => ({ x: i * w + w / 2, y: 20, r: value ? 1.5 + Math.sqrt(value / this.max()) * Math.min(w / 2 - 0.5, 8) : 1 }));
  });
}
