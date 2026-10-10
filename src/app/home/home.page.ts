import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  imports: [
    IonButton,
    IonContent,
  ],
})
export class HomePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser();

  logout(): void {
    this.auth.logout();

    this.router.navigateByUrl('/login', {
      replaceUrl: true,
    });
  }
}