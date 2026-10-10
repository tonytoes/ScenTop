import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { FooterComponent } from '../footer/footer.component';
import { HeaderComponent } from '../header/header.component';

/**
 * The frame every page sits in: header, scrolling content and footer.
 *
 *   <app-page back="/shop">...page content...</app-page>
 *
 * `back` shows a back arrow instead of the menu button (the value is where it goes when there is no history).
 * Pass `[refresh]="reload"` (an async function) to let people pull down to reload the page.
 */
@Component({
  selector: 'app-page',
  imports: [IonContent, IonRefresher, IonRefresherContent, HeaderComponent, FooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* Lets the header and content take part in the page's own layout */
    :host { display: contents; }
  `,
  template: `
    <app-header [back]="back()" />
    <ion-content [fullscreen]="true">
      @if (refresh()) {
        <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
          <ion-refresher-content />
        </ion-refresher>
      }
      <ng-content />
      @if (footer()) {
        <app-footer />
      }
    </ion-content>
  `,
})
export class PageComponent {
  readonly back = input<string | null>(null);
  readonly footer = input(true);
  /** Pull-to-refresh handler. The gesture is only on when this is set. */
  readonly refresh = input<(() => Promise<unknown>) | null>(null);

  protected async onRefresh(event: Event) {
    const target = event.target as HTMLIonRefresherElement;
    try {
      await this.refresh()?.();
    } finally {
      await target.complete();
    }
  }
}
