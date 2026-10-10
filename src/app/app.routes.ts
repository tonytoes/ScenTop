import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

// Every page is loaded the first time it is opened (loadComponent), which keeps the first download small.
export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'ScenTop', loadComponent: () => import('./pages/splash/splash.page').then((m) => m.SplashPage) },
  { path: 'home', title: 'ScenTop | Find your signature scent', loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage) },

  // Shopping
  { path: 'shop', title: 'Shop | ScenTop', loadComponent: () => import('./pages/shop/shop.page').then((m) => m.ShopPage) },
  { path: 'product/:slug', title: 'Perfume | ScenTop', loadComponent: () => import('./pages/product-detail/product-detail.page').then((m) => m.ProductDetailPage) },
  { path: 'wishlist', title: 'Wishlist | ScenTop', loadComponent: () => import('./pages/wishlist/wishlist.page').then((m) => m.WishlistPage) },
  { path: 'cart', title: 'Cart | ScenTop', loadComponent: () => import('./pages/cart/cart.page').then((m) => m.CartPage) },
  { path: 'checkout', title: 'Checkout | ScenTop', canActivate: [authGuard], loadComponent: () => import('./pages/checkout/checkout.page').then((m) => m.CheckoutPage) },
  { path: 'order-success/:id', title: 'Order placed | ScenTop', canActivate: [authGuard], loadComponent: () => import('./pages/order-success/order-success.page').then((m) => m.OrderSuccessPage) },
  { path: 'orders', title: 'My orders | ScenTop', canActivate: [authGuard], loadComponent: () => import('./pages/orders/orders.page').then((m) => m.OrdersPage) },
  { path: 'orders/:id', title: 'Order | ScenTop', canActivate: [authGuard], loadComponent: () => import('./pages/order-detail/order-detail.page').then((m) => m.OrderDetailPage) },

  // Account
  { path: 'login', title: 'Log in | ScenTop', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },
  { path: 'signup', title: 'Create account | ScenTop', canActivate: [guestGuard], loadComponent: () => import('./pages/signup/signup.page').then((m) => m.SignupPage) },
  { path: 'profile', title: 'My profile | ScenTop', canActivate: [authGuard], loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage) },
  { path: 'settings', title: 'Settings | ScenTop', loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage) },

  // Information
  { path: 'about', title: 'Company history | ScenTop', loadComponent: () => import('./pages/about/about.page').then((m) => m.AboutPage) },
  { path: 'about-products', title: 'About our products | ScenTop', loadComponent: () => import('./pages/about-products/about-products.page').then((m) => m.AboutProductsPage) },
  { path: 'about-app', title: 'About the app | ScenTop', loadComponent: () => import('./pages/about-app/about-app.page').then((m) => m.AboutAppPage) },
  { path: 'developers', title: 'Developers | ScenTop', loadComponent: () => import('./pages/developers/developers.page').then((m) => m.DevelopersPage) },
  { path: 'contact', title: 'Contact us | ScenTop', loadComponent: () => import('./pages/contact/contact.page').then((m) => m.ContactPage) },
  { path: 'faq', title: 'FAQs | ScenTop', loadComponent: () => import('./pages/faq/faq.page').then((m) => m.FaqPage) },
  { path: 'terms', title: 'Terms and conditions | ScenTop', loadComponent: () => import('./pages/legal/terms.page').then((m) => m.TermsPage) },
  { path: 'privacy', title: 'Privacy policy | ScenTop', loadComponent: () => import('./pages/legal/privacy.page').then((m) => m.PrivacyPage) },

  { path: '**', title: 'Page not found | ScenTop', loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage) },
];
