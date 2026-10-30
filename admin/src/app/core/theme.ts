import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const KEY = 'scentop-admin-theme';

/** Light or dark mode. Follows the computer's setting until the admin picks one. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>('light');

  init() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      // Storage blocked: just follow the system
    }
    const system = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    this.apply(saved === 'dark' || saved === 'light' ? saved : system);
  }

  toggle() {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, still applied
    }
  }

  private apply(theme: Theme) {
    this.theme.set(theme);
    document.documentElement.dataset['theme'] = theme;
  }
}
