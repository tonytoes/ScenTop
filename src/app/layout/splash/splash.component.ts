import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, output, signal } from '@angular/core';

const FADE_OUT_AT_MS = 2800;
const REMOVE_AT_MS = 3300;

/**
 * The animated welcome screen. It covers the whole app every time the app opens or the page is refreshed,
 * fades out, then tells its parent to remove it. (Animation by Orland.)
 */
@Component({
  selector: 'app-splash',
  templateUrl: './splash.component.html',
  styleUrl: './splash.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplashComponent implements OnInit, OnDestroy {
  readonly finished = output<void>();
  protected readonly leaving = signal(false);

  private timers: ReturnType<typeof setTimeout>[] = [];

  ngOnInit() {
    this.timers = [setTimeout(() => this.leaving.set(true), FADE_OUT_AT_MS), setTimeout(() => this.finished.emit(), REMOVE_AT_MS)];
  }

  ngOnDestroy() {
    this.timers.forEach(clearTimeout);
  }
}
