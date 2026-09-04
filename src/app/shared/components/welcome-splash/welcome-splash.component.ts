import { Component, OnDestroy, OnInit, output, signal } from '@angular/core';
import { APS_LOGO_DATA_URL } from '../../branding/aps-logo';

/** Total time the splash is visible (ms). Change this to adjust duration. */
export const SPLASH_DURATION_MS = 4_000;

/** Fade-out starts this many ms before the splash is removed. */
const SPLASH_FADE_MS = 500;

@Component({
  selector: 'app-welcome-splash',
  templateUrl: './welcome-splash.component.html',
  styleUrl: './welcome-splash.component.css',
})
export class WelcomeSplashComponent implements OnInit, OnDestroy {
  readonly finished = output<void>();
  readonly visible = signal(true);
  readonly logoSrc = APS_LOGO_DATA_URL;

  private timerId: ReturnType<typeof setTimeout> | null = null;
  private fadeTimerId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.fadeTimerId = setTimeout(() => this.visible.set(false), SPLASH_DURATION_MS - SPLASH_FADE_MS);
    this.timerId = setTimeout(() => this.finished.emit(), SPLASH_DURATION_MS);
  }

  ngOnDestroy(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
    }
    if (this.fadeTimerId !== null) {
      clearTimeout(this.fadeTimerId);
    }
  }
}
