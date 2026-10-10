import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent, IonIcon, IonMenu, IonMenuToggle, IonRouterLinkWithHref } from '@ionic/angular';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { WishlistService } from '../../core/wishlist.service';

interface MenuLink {
  label: string;
  hint: string;
  url: string;
  icon: string;
  badge?: () => number;
  loginOnly?: boolean;
}

/** The slide-out menu: who is logged in, where to go, and how to log out. */
@Component({
  selector: 'app-side-menu',
  imports: [IonMenu, IonContent, IonMenuToggle, IonIcon, RouterLink, RouterLinkActive, IonRouterLinkWithHref],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenuComponent {
  private readonly router = inject(Router);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  protected readonly auth = inject(AuthService);

  /** The menu is hidden on the splash, login and sign-up screens. */
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split('?')[0]!),
    ),
    { initialValue: this.router.url.split('?')[0]! },
  );
  protected readonly disabled = computed(() => ['/', '/login', '/signup'].includes(this.path()));

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : '';
  });

  protected readonly shopLinks: MenuLink[] = [
    { label: 'Home', hint: 'Back to the start', url: '/home', icon: 'home-outline' },
    { label: 'Shop', hint: 'Browse every perfume', url: '/shop', icon: 'bag-handle-outline' },
    { label: 'Wishlist', hint: 'Your saved perfumes', url: '/wishlist', icon: 'heart-outline', badge: () => this.wishlist.ids().size },
    { label: 'Cart', hint: 'Items ready to check out', url: '/cart', icon: 'cart-outline', badge: () => this.cart.count() },
    { label: 'My orders', hint: 'Track your purchases', url: '/orders', icon: 'receipt-outline', loginOnly: true },
  ];

  protected readonly aboutLinks: MenuLink[] = [
    { label: 'Company history', hint: 'Our story', url: '/about', icon: 'information-circle-outline' },
    { label: 'About our products', hint: 'Scent families', url: '/about-products', icon: 'sparkles-outline' },
    { label: 'About the app', hint: 'Version and features', url: '/about-app', icon: 'phone-portrait-outline' },
    { label: 'Developers', hint: 'Meet the team', url: '/developers', icon: 'people-outline' },
    { label: 'Contact us', hint: 'We would love to hear from you', url: '/contact', icon: 'call-outline' },
  ];

  protected visible(links: MenuLink[]): MenuLink[] {
    return links.filter((link) => !link.loginOnly || this.auth.isLoggedIn());
  }

  protected async logout() {
    await this.auth.logout();
    await this.router.navigate(['/home']);
  }
}
