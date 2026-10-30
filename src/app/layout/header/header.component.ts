import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonBackButton, IonButtons, IonHeader, IonIcon, IonMenuButton, IonToolbar } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { WishlistService } from '../../core/wishlist.service';

@Component({
  selector: 'app-header',
  imports: [IonHeader, IonToolbar, IonButtons, IonMenuButton, IonBackButton, IonIcon, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  protected readonly wishlist = inject(WishlistService);

  /** Where the back arrow goes when there is no history (for example after opening a shared link). Without it the menu button shows. */
  readonly back = input<string | null>(null);

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : '';
  });

  protected readonly links = [
    { label: 'Home', url: '/home' },
    { label: 'Shop', url: '/shop' },
    { label: 'Our story', url: '/about' },
    { label: 'Contact', url: '/contact' },
  ];

  protected search() {
    void this.router.navigate(['/shop'], { queryParams: { focus: 'search' } });
  }
}
