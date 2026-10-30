import { TestBed } from '@angular/core/testing';
import { SplashComponent } from './splash.component';

describe('SplashComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fades out after a moment, then asks to be removed', () => {
    const fixture = TestBed.createComponent(SplashComponent);
    const finished = vi.fn();
    fixture.componentInstance.finished.subscribe(finished);
    fixture.detectChanges();

    const splash = () => (fixture.nativeElement as HTMLElement).querySelector('.splash')!;
    expect(splash().classList.contains('leaving')).toBe(false);

    vi.advanceTimersByTime(2800);
    fixture.detectChanges();
    expect(splash().classList.contains('leaving')).toBe(true);
    expect(finished).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(finished).toHaveBeenCalledOnce();
  });
});
