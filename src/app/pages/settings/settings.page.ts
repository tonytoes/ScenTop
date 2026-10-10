import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { PageComponent } from '../../layout/page/page.component';

interface SettingsLink {
  label: string;
  hint: string;
  url: string;
  icon: string;
  loginOnly?: boolean;
}

/** The "General settings" screen from the design: profile, help and the legal pages in one place. */
@Component({
  selector: 'app-settings',
  imports: [RouterLink, IonIcon, PageComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly links: SettingsLink[] = [
    { label: 'Profile', hint: 'Update your profile and password', url: '/profile', icon: 'person-outline', loginOnly: true },
    { label: 'My orders', hint: 'Track your purchases', url: '/orders', icon: 'receipt-outline', loginOnly: true },
    { label: 'FAQs', hint: 'Frequently asked questions', url: '/faq', icon: 'help-circle-outline' },
    { label: 'Terms and conditions', hint: 'How the shop works', url: '/terms', icon: 'document-text-outline' },
    { label: 'Privacy policy', hint: 'How we look after your data', url: '/privacy', icon: 'shield-checkmark-outline' },
    { label: 'About the app', hint: 'Version and features', url: '/about-app', icon: 'phone-portrait-outline' },
  ];

  protected visible(): SettingsLink[] {
    return this.links.filter((link) => !link.loginOnly || this.auth.isLoggedIn());
  }

  protected async logout() {
    await this.auth.logout();
    await this.router.navigate(['/home'], { replaceUrl: true });
  }
}
