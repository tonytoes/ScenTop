import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

export interface ConfirmRequest {
  title: string;
  text: string;
  action: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

/** Toasts and confirmation dialogs, shown by the shell. */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly toasts = signal<Toast[]>([]);
  readonly confirmation = signal<ConfirmRequest | null>(null);
  private nextId = 1;

  toast(text: string, kind: Toast['kind'] = 'ok') {
    const toast = { id: this.nextId++, text, kind };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.toasts.update((list) => list.filter((t) => t.id !== toast.id)), kind === 'error' ? 6000 : 3200);
  }

  confirm(options: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    return new Promise((resolve) => this.confirmation.set({ ...options, resolve }));
  }

  answer(ok: boolean) {
    this.confirmation()?.resolve(ok);
    this.confirmation.set(null);
  }
}
