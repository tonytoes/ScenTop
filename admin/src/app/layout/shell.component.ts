import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminApi } from '../core/api';
import { AdminAuth } from '../core/auth';
import { initials } from '../core/format';
import { ThemeService } from '../core/theme';
import { IconComponent } from '../shared/icon.component';
import { UiService } from '../shared/ui.service';

/** The frame around every admin page: navigation rail, toasts and the confirm dialog. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly auth = inject(AdminAuth);
  protected readonly theme = inject(ThemeService);
  protected readonly ui = inject(UiService);
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  protected readonly initials = initials;

  /** Orders waiting to be confirmed, shown as a badge on the nav. */
  protected readonly pending = signal(0);

  protected readonly nav = [
    { path: '/', icon: 'dashboard', label: 'Overview', exact: true },
    { path: '/orders', icon: 'orders', label: 'Orders', exact: false },
    { path: '/products', icon: 'products', label: 'Products', exact: false },
    { path: '/customers', icon: 'customers', label: 'Customers', exact: false },
    { path: '/messages', icon: 'inbox', label: 'Inbox', exact: false },
  ];

  constructor() {
    void this.refreshBadge();
    this.router.events.subscribe(() => void this.refreshBadge());
  }

  protected logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  private lastBadge = 0;
  private async refreshBadge() {
    // At most once every 20 seconds, however much the admin clicks around
    if (Date.now() - this.lastBadge < 20_000) return;
    this.lastBadge = Date.now();
    try {
      const page = await this.api.orders({ status: 'pending', limit: 1 });
      this.pending.set(page.total);
    } catch {
      // The badge is a nicety; pages show their own errors
    }
  }
}
