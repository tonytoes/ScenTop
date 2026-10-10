import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { Splash } from './splash/splash';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, Splash],
})
export class AppComponent {
  showSplash = true;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide();
    }
  }
} 