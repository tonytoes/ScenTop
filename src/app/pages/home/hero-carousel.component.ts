import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';

interface Slide {
  image: string;
  eyebrow: string;
  title: string;
  text: string;
  action: { label: string; url: string; query?: Record<string, string> };
}

const AUTOPLAY_MS = 6000;

/** The big picture banner at the top of the home page. Swipe, tap the arrows, or let it play. */
@Component({
  selector: 'app-hero-carousel',
  imports: [RouterLink, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './hero-carousel.component.scss',
  template: `
    <section class="hero" aria-roledescription="carousel" aria-label="Featured" (mouseenter)="paused = true" (mouseleave)="paused = false" (focusin)="paused = true" (focusout)="paused = false" (touchstart)="paused = true" (touchend)="paused = false">
      <div class="track" #track (scroll)="onScroll()" tabindex="0">
        @for (slide of slides; track slide.title; let i = $index) {
          <article class="slide" role="group" aria-roledescription="slide" [attr.aria-label]="i + 1 + ' of ' + slides.length">
            <img [src]="slide.image" alt="" [attr.loading]="i === 0 ? 'eager' : 'lazy'" [attr.fetchpriority]="i === 0 ? 'high' : null" width="1408" height="768" />
            <div class="shade"></div>
            <div class="copy">
              <span class="eyebrow">{{ slide.eyebrow }}</span>
              <h2>{{ slide.title }}</h2>
              <p>{{ slide.text }}</p>
              <a class="btn btn--light" [routerLink]="slide.action.url" [queryParams]="slide.action.query">
                {{ slide.action.label }} <ion-icon name="arrow-forward-outline" />
              </a>
            </div>
          </article>
        }
      </div>

      <button type="button" class="nav nav--prev" aria-label="Previous slide" (click)="go(active() - 1)"><ion-icon name="arrow-back-outline" /></button>
      <button type="button" class="nav nav--next" aria-label="Next slide" (click)="go(active() + 1)"><ion-icon name="arrow-forward-outline" /></button>

      <div class="dots">
        @for (slide of slides; track slide.title; let i = $index) {
          <button type="button" [class.is-active]="i === active()" [attr.aria-label]="'Go to slide ' + (i + 1)" [attr.aria-current]="i === active()" (click)="go(i)"></button>
        }
      </div>
    </section>
  `,
})
export class HeroCarouselComponent implements OnInit, OnDestroy {
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private timer: ReturnType<typeof setInterval> | undefined;

  protected readonly active = signal(0);
  protected paused = false;

  protected readonly slides: Slide[] = [
    {
      image: 'assets/images/hero-shelf.webp',
      eyebrow: 'Our top three',
      title: 'Experience the essence of luxury perfumes',
      text: 'Floral, fresh, sweet or bold. Find the scent that feels like you.',
      action: { label: 'Shop best sellers', url: '/shop', query: { collection: 'best' } },
    },
    {
      image: 'assets/images/store.webp',
      eyebrow: 'Visit us',
      title: 'Our boutique in Cubao',
      text: 'Come by, try a few scents, and take your favourite home.',
      action: { label: 'Find the shop', url: '/contact' },
    },
    {
      image: 'assets/images/perfumer.webp',
      eyebrow: 'Crafted with care',
      title: 'Blended by hand, worn by you',
      text: 'Every bottle starts with real ingredients and a patient perfumer.',
      action: { label: 'Read our story', url: '/about' },
    },
  ];

  ngOnInit() {
    // People who ask for less motion get a carousel they move themselves
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => {
      if (!this.paused) this.go(this.active() + 1);
    }, AUTOPLAY_MS);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  protected go(index: number) {
    const count = this.slides.length;
    const next = (index + count) % count;
    const track = this.track().nativeElement;
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
  }

  protected onScroll() {
    const track = this.track().nativeElement;
    this.active.set(Math.round(track.scrollLeft / track.clientWidth));
  }
}
