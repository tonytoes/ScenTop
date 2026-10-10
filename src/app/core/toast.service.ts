import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toasts = inject(ToastController);

  async show(message: string, options: { duration?: number; icon?: string } = {}): Promise<void> {
    // Only one message at a time, so quick taps do not stack up
    await this.toasts.dismiss().catch(() => false);

    const toast = await this.toasts.create({
      message,
      duration: options.duration ?? 2200,
      position: 'bottom',
      icon: options.icon,
      cssClass: 'st-toast',
      layout: 'baseline',
    });
    await toast.present();
  }
}
