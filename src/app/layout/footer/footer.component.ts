import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { COMPANY } from '../../core/company';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, IonIcon],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  protected readonly company = COMPANY;
  protected readonly year = new Date().getFullYear();

  protected readonly columns = [
    {
      title: 'Shop',
      links: [
        { label: 'All perfumes', url: '/shop', query: {} },
        { label: 'Best sellers', url: '/shop', query: { collection: 'best' } },
        { label: 'New arrivals', url: '/shop', query: { collection: 'new' } },
        { label: 'Wishlist', url: '/wishlist', query: {} },
      ],
    },
    {
      title: 'ScenTop',
      links: [
        { label: 'Company history', url: '/about', query: {} },
        { label: 'About our products', url: '/about-products', query: {} },
        { label: 'About the app', url: '/about-app', query: {} },
        { label: 'Developers', url: '/developers', query: {} },
      ],
    },
    {
      title: 'Help',
      links: [
        { label: 'Contact us', url: '/contact', query: {} },
        { label: 'FAQs', url: '/faq', query: {} },
        { label: 'Terms and conditions', url: '/terms', query: {} },
        { label: 'Privacy policy', url: '/privacy', query: {} },
      ],
    },
  ];
}
