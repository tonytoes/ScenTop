import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { registerIcons } from './core/icons';
import { SideMenuComponent } from './layout/side-menu/side-menu.component';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, SideMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-app>
      <app-side-menu />
      <ion-router-outlet id="main-content" />
    </ion-app>
  `,
})
export class AppComponent {
  constructor() {
    registerIcons();
  }
}
