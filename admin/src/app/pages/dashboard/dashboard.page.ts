import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AreaChartComponent } from '../../charts/area-chart.component';
import { MirrorBarsComponent } from '../../charts/mirror-bars.component';
import { PunchCardComponent } from '../../charts/punch-card.component';
import { RadialBarsComponent } from '../../charts/radial-bars.component';
import { RingGaugeComponent } from '../../charts/ring-gauge.component';
import { SparkComponent } from '../../charts/spark.component';
import { WaffleComponent } from '../../charts/waffle.component';
import { AdminApi, errorMessage } from '../../core/api';
import { AdminAuth } from '../../core/auth';
import { AgoPipe, PesoPipe, STATUS_LABEL, change, formatPeso, initials } from '../../core/format';
import type { Analytics, Metric, OrderStatus } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
const RANGES = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
  { days: 365, label: '1Y' },
];

/** Groups daily values into at most `n` buckets for the small trend lines. */
function bucket(values: number[], n = 14, mode: 'sum' | 'avg' = 'sum'): number[] {
  if (values.length <= n) return values;
  const size = Math.ceil(values.length / n);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += size) {
    const part = values.slice(i, i + size);
    const sum = part.reduce((a, b) => a + b, 0);
    out.push(mode === 'sum' ? sum : sum / part.length);
  }
  return out;
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, PesoPipe, AgoPipe, AreaChartComponent, RingGaugeComponent, RadialBarsComponent, PunchCardComponent, WaffleComponent, SparkComponent, MirrorBarsComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly api = inject(AdminApi);
  protected readonly auth = inject(AdminAuth);

  protected readonly ranges = RANGES;
  protected readonly days = signal(30);
  protected readonly data = signal<Analytics | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly initials = initials;
  protected readonly seriesColor = SERIES;

  protected readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();
  protected readonly today = new Date().toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long' });

  constructor() {
    void this.load();
  }

  protected setRange(days: number) {
    if (days === this.days()) return;
    this.days.set(days);
    void this.load();
  }

  protected async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(await this.api.analytics(this.days()));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly rangeLabel = computed(() => RANGES.find((r) => r.days === this.days())?.label ?? '');

  protected delta(metric: Metric, invert = false) {
    const c = change(metric.value, metric.previous);
    if (c === null) return { text: 'new', good: true, up: true };
    const good = invert ? c <= 0 : c >= 0;
    return { text: `${c >= 0 ? '+' : ''}${Math.round(c * 100)}%`, good, up: c >= 0 };
  }

  protected readonly area = computed(() => this.data()?.daily.map((d) => ({ date: d.date, value: d.revenue, previous: d.previousRevenue })) ?? []);

  protected readonly kpis = computed(() => {
    const d = this.data();
    if (!d) return [];
    const daily = d.daily;
    return [
      { key: 'orders', label: 'Orders', value: d.kpis.orders.value.toLocaleString('en-PH'), delta: this.delta(d.kpis.orders), spark: bucket(daily.map((x) => x.orders)), kind: 'bars' as const },
      {
        key: 'aov',
        label: 'Average basket',
        value: formatPeso(d.kpis.averageOrder.value, 'whole'),
        delta: this.delta(d.kpis.averageOrder),
        spark: bucket(daily.map((x) => (x.orders ? x.revenue / x.orders : 0)), 14, 'avg'),
        kind: 'line' as const,
      },
      { key: 'new', label: 'New customers', value: d.kpis.newCustomers.value.toLocaleString('en-PH'), delta: this.delta(d.kpis.newCustomers), spark: d.customerMix.map((w) => w.first), kind: 'dots' as const },
    ];
  });

  protected readonly cancel = computed(() => {
    const d = this.data();
    if (!d) return null;
    return { pct: Math.round(d.kpis.cancelRate.value * 1000) / 10, delta: this.delta(d.kpis.cancelRate, true) };
  });

  protected readonly month = computed(() => {
    const m = this.data()?.month;
    if (!m) return null;
    const pace = m.dayOfMonth / m.daysInMonth;
    const projected = pace > 0 ? Math.round(m.revenue / pace) : 0;
    return { ...m, pace, projected, pct: m.lastMonthRevenue ? Math.round((m.revenue / m.lastMonthRevenue) * 100) : null, ahead: m.revenue >= m.lastMonthRevenue * pace };
  });

  /** Orders in the period, walking through the delivery steps. */
  protected readonly pipeline = computed(() => {
    const statuses = this.data()?.statuses ?? [];
    const count = (s: OrderStatus) => statuses.find((x) => x.status === s)?.count ?? 0;
    const flow = (['pending', 'confirmed', 'shipped', 'delivered'] as OrderStatus[]).map((status) => ({ status, label: STATUS_LABEL[status], count: count(status) }));
    const active = flow.reduce((s, f) => s + f.count, 0);
    const cancelled = count('cancelled');
    return {
      flow: flow.map((f) => ({ ...f, share: active ? f.count / active : 0 })),
      active,
      cancelled,
      delivered: active ? Math.round((count('delivered') / active) * 100) : 0,
    };
  });

  protected readonly categories = computed(() => (this.data()?.categories ?? []).map((c, i) => ({ label: c.name, value: c.revenue, color: SERIES[i]! })));

  protected readonly audience = computed(() =>
    (this.data()?.audience ?? []).map((a, i) => ({ label: a.name === 'unisex' ? 'Unisex' : a.name === 'women' ? 'For her' : 'For him', value: a.units, color: SERIES[[4, 0, 2][i]!]! })),
  );

  protected readonly sizes = computed(() => {
    const sizes = this.data()?.sizes ?? [];
    const units = sizes.reduce((s, x) => s + x.units, 0) || 1;
    return sizes.map((s, i) => ({ ...s, share: s.units / units, color: SERIES[i % SERIES.length]! }));
  });

  protected readonly topMax = computed(() => Math.max(1, ...(this.data()?.topProducts ?? []).map((p) => p.revenue)));
}
