import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { ConsumerOnboardingService } from '../../core/services/consumer/consumer-onboarding.service';
import { CompanySetupModalComponent } from '../../features/consumer/company-setup-modal/company-setup-modal.component';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';
import { WelcomeSplashComponent } from '../../shared/components/welcome-splash/welcome-splash.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    SidebarComponent,
    LoadingOverlayComponent,
    CompanySetupModalComponent,
    WelcomeSplashComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly onboarding = inject(ConsumerOnboardingService);

  readonly navigating = signal(false);
  readonly sidebarOpen = signal(true);
  readonly showCompanySetup = signal(false);
  readonly showWelcomeSplash = signal(false);

  private companySetupPending = false;

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  ngOnInit(): void {
    if (this.auth.consumeWelcomeSplashPending()) {
      this.showWelcomeSplash.set(true);
    }
    this.syncCompanySetupState();
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

  onWelcomeSplashFinished(): void {
    this.showWelcomeSplash.set(false);
    if (this.companySetupPending) {
      this.companySetupPending = false;
      this.showCompanySetup.set(true);
    }
  }

  onCompanySetupCompleted(): void {
    this.showCompanySetup.set(false);
  }

  private syncCompanySetupState(): void {
    const user = this.auth.currentUser();
    if (!this.auth.isAuthenticated() || !user || user.role !== 'CONSUMER') {
      this.showCompanySetup.set(false);
      return;
    }

    this.onboarding.getStatus().subscribe({
      next: (status) => {
        if (status.needsCompanySetup) {
          this.auth.setNeedsCompanySetup(true);
          this.openCompanySetup();
        } else {
          this.auth.setNeedsCompanySetup(false);
          this.showCompanySetup.set(false);
        }
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.showCompanySetup.set(false);
          return;
        }
        this.showCompanySetup.set(user.needsCompanySetup === true);
        if (user.needsCompanySetup) {
          this.openCompanySetup();
        }
      },
    });
  }

  private openCompanySetup(): void {
    if (this.showWelcomeSplash()) {
      this.companySetupPending = true;
      return;
    }
    this.showCompanySetup.set(true);
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
