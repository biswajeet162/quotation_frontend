import { Component, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, LoadingOverlayComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent {
  private readonly router = inject(Router);

  readonly navigating = signal(false);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.navigating.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.navigating.set(false);
        if (event instanceof NavigationEnd) {
          this.resetPageScroll();
        }
      }
    });
  }

  private resetPageScroll(): void {
    requestAnimationFrame(() => {
      const pageHost = document.querySelector('.app-content > router-outlet + *');
      if (pageHost instanceof HTMLElement) {
        pageHost.scrollTop = 0;
      }
    });
  }
}
