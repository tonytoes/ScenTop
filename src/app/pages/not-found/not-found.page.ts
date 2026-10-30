import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageComponent } from '../../layout/page/page.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, PageComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page>
      <app-empty-state icon="compass-outline" heading="This page wandered off" text="The address may be wrong, or the page has moved. Let's get you back to something that smells nice.">
        <a class="btn btn--primary" routerLink="/home">Back to home</a>
        <a class="btn btn--ghost" routerLink="/shop">Browse perfumes</a>
      </app-empty-state>
    </app-page>
  `,
})
export class NotFoundPage {}
