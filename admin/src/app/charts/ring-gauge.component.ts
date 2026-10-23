import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { arcPath } from './geometry';

/**
 * A 270° gauge: how far `value` has come towards `target`, with a tick showing where
 * it should be by now (`pace`, 0-1). Goes past a full lap in a brighter colour.
 */
@Component({
  selector: 'app-ring-gauge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 200 200" role="img" [attr.aria-label]="ariaLabel()">
      <path class="track" [attr.d]="track" />
      <path class="value" [class.over]="ratio() > 1" [attr.d]="valuePath()" />
      @if (pace() !== null) {
        <line class="pace" [attr.x1]="paceTick().x1" [attr.y1]="paceTick().y1" [attr.x2]="paceTick().x2" [attr.y2]="paceTick().y2" />
      }
    </svg>
    <div class="center"><ng-content /></div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      aspect-ratio: 1;
    }
    svg {
      width: 100%;
      height: 100%;
    }
    path {
      fill: none;
      stroke-linecap: round;
      stroke-width: 16;
    }
    .track {
      stroke: var(--surface-3);
    }
    .value {
      stroke: var(--accent);
      transition: d 0.6s ease;
    }
    .value.over {
      stroke: var(--gold);
    }
    .pace {
      stroke: var(--ink);
      stroke-width: 3;
      stroke-linecap: round;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
    }
  `,
})
export class RingGaugeComponent {
  readonly value = input.required<number>();
  readonly target = input.required<number>();
  readonly pace = input<number | null>(null);
  readonly ariaLabel = input('');

  private static readonly START = -Math.PI * 0.75;
  private static readonly SPAN = Math.PI * 1.5;
  protected readonly track = arcPath(100, 100, 80, RingGaugeComponent.START, RingGaugeComponent.START + RingGaugeComponent.SPAN);

  protected readonly ratio = computed(() => (this.target() > 0 ? this.value() / this.target() : this.value() > 0 ? 1 : 0));
  protected readonly valuePath = computed(() => {
    const r = Math.min(this.ratio(), 1);
    if (r <= 0) return '';
    return arcPath(100, 100, 80, RingGaugeComponent.START, RingGaugeComponent.START + RingGaugeComponent.SPAN * Math.max(r, 0.01));
  });
  protected readonly paceTick = computed(() => {
    const a = RingGaugeComponent.START + RingGaugeComponent.SPAN * Math.min(this.pace() ?? 0, 1);
    return { x1: 100 + 66 * Math.sin(a), y1: 100 - 66 * Math.cos(a), x2: 100 + 94 * Math.sin(a), y2: 100 - 94 * Math.cos(a) };
  });
}
