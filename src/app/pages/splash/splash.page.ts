import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';

const SPLASH_MS = 2800;
const SEEN_KEY = 'splashSeen';

/** The welcome screen. Shown once each time the app is opened, then goes to the home page. */
@Component({
  selector: 'app-splash',
  imports: [IonContent],
  templateUrl: './splash.page.html',
  styleUrl: './splash.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplashPage implements OnDestroy {
  private readonly router = inject(Router);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Reloading the page in the same browser tab should not show the splash again
    if (this.alreadySeen()) void this.router.navigate(['/home'], { replaceUrl: true });
  }

  ionViewDidEnter() {
    this.timer = setTimeout(() => this.start(), SPLASH_MS);
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
  }

  protected start() {
    clearTimeout(this.timer);
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage is blocked. The splash simply shows again next time.
    }
    void this.router.navigate(['/home'], { replaceUrl: true });
  }

  private alreadySeen(): boolean {
    try {
      return sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      return false;
    }
  }
}
