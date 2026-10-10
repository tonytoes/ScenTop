import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { registerIcons } from './core/icons';
import { SideMenuComponent } from './layout/side-menu/side-menu.component';
import { SplashComponent } from './layout/splash/splash.component';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, SideMenuComponent, SplashComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-app>
      <app-side-menu />
      <ion-router-outlet id="main-content" />
    </ion-app>

    <!-- Shown on every start and every refresh, whichever page is open -->
    @if (showSplash()) {
      <app-splash (finished)="showSplash.set(false)" />
    }
  `,
})
export class AppComponent {
  protected readonly showSplash = signal(true);

  constructor() {
    registerIcons();
  }
}
