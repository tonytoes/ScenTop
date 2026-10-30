import { DestroyRef, ElementRef, inject, signal } from '@angular/core';

export interface Point {
  x: number;
  y: number;
}

/**
 * A smooth line through the points that never overshoots (monotone cubic), so a quiet
 * day never dips below zero on the chart.
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length < 3) return points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');

  const n = points.length;
  const dx = points.slice(1).map((p, i) => p.x - points[i]!.x);
  const slope = points.slice(1).map((p, i) => (p.y - points[i]!.y) / dx[i]!);
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]!;
    if (i === n - 1) return slope[n - 2]!;
    const a = slope[i - 1]!;
    const b = slope[i]!;
    return a * b <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) / ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b);
  });

  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${p.x + h},${p.y + h * tangent[i]!} ${q.x - h},${q.y - h * tangent[i + 1]!} ${q.x},${q.y}`;
  }
  return d;
}

/** A "nice" top for an axis: 0 → 10, 87 → 100, 1234 → 1500. */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * power >= value)!;
  return step * power;
}

/** SVG arc path from angle a to angle b (radians, 0 = 12 o'clock, clockwise). */
export function arcPath(cx: number, cy: number, r: number, a: number, b: number): string {
  const sweep = Math.min(b - a, Math.PI * 2 - 0.0001);
  const x1 = cx + r * Math.sin(a);
  const y1 = cy - r * Math.cos(a);
  const x2 = cx + r * Math.sin(a + sweep);
  const y2 = cy - r * Math.cos(a + sweep);
  return `M${x1},${y1} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2},${y2}`;
}

/** The component's current width in pixels, kept up to date as the layout changes. */
export function hostWidth(initial = 600) {
  const el = inject(ElementRef).nativeElement as HTMLElement;
  const width = signal(initial);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry!.contentRect.width);
      if (w > 0 && w !== width()) width.set(w);
    });
    observer.observe(el);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
  return width;
}

export const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' });
export const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short' });
