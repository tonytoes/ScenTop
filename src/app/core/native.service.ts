import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AlertController, MenuController, NavController } from '@ionic/angular';
import { environment } from '../../environments/environment';
import { ToastService } from './toast.service';

/** Everything that behaves differently inside the Android/iOS app than in a browser. */
@Injectable({ providedIn: 'root' })
export class NativeService {
  private readonly router = inject(Router);
  private readonly navigation = inject(NavController);
  private readonly menus = inject(MenuController);
  private readonly alerts = inject(AlertController);
  private readonly toast = inject(ToastService);

  readonly isNative = Capacitor.isNativePlatform();

  /** Runs once when the app starts. Does nothing in a browser. */
  async init(): Promise<void> {
    if (!this.isNative) return;

    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#fffaf1' }).catch(() => undefined);
    }
    await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    await SplashScreen.hide().catch(() => undefined);

    // Android back button: close the menu or a dialog first, then go back, then leave the app
    await App.addListener('backButton', async ({ canGoBack }) => {
      const menu = await this.menus.getOpen();
      if (menu) return void (await menu.close());

      const alert = await this.alerts.getTop();
      if (alert) return void (await alert.dismiss());

      const atRoot = ['/', '/home'].includes(this.router.url.split('?')[0]!);
      if (atRoot || !canGoBack) return void (await App.exitApp());
      this.navigation.back();
    });
  }

  /** A short tap on the phone. Used when something is added to the cart. */
  async tap(): Promise<void> {
    if (this.isNative) await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  /** Opens the phone's share sheet, or copies the link when sharing is not available. */
  async share(title: string, path: string): Promise<void> {
    const url = `${environment.siteUrl || window.location.origin}${path}`;
    try {
      if ((await Share.canShare()).value) {
        await Share.share({ title, text: `${title} on ScenTop`, url, dialogTitle: 'Share this perfume' });
        return;
      }
      await navigator.clipboard.writeText(url);
      await this.toast.show('Link copied');
    } catch {
      // The person closed the share sheet, which is not an error
    }
  }
}
