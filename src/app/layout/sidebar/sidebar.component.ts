import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IsActiveMatchOptions, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthUser } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { APS_LOGO_DATA_URL } from '../../shared/branding/aps-logo';

// deploy probe 2026-07-11 — remove after confirming production picks this up

interface NavChild {
  label: string;
  path: string;
  roles?: string[];
}

interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles?: string[];
  children?: NavChild[];
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly logoSrc = APS_LOGO_DATA_URL;

  readonly collapsed = input(false);
  readonly toggleSidebar = output<void>();

  /** Admin-only: which nav groups with children are expanded. */
  private readonly expandedGroups = signal<Set<string>>(new Set());

  /** Keep nav active when the path matches, even with ?inq= or other query params. */
  readonly exactActiveOptions: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    fragment: 'ignored',
    matrixParams: 'ignored',
  };

  readonly prefixActiveOptions: IsActiveMatchOptions = {
    paths: 'subset',
    queryParams: 'ignored',
    fragment: 'ignored',
    matrixParams: 'ignored',
  };

  private readonly allNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: '◫' },
    {
      label: 'Products',
      path: '/products',
      icon: '▣',
      roles: ['ADMIN', 'CONSUMER'],
      children: [
        { label: 'Products', path: '/products/all' },
        { label: 'Brands', path: '/products/brands' },
      ],
    },
    {
      label: 'My products',
      path: '/distributor/products',
      icon: '▣',
      roles: ['DISTRIBUTOR'],
      children: [
        { label: 'My products', path: '/distributor/products/my-products' },
        { label: 'Brands', path: '/distributor/products/brands' },
      ],
    },
    { label: 'Tracking', path: '/distributor/tracking', icon: '◷', roles: ['DISTRIBUTOR'] },
    { label: 'Create inquiry', path: '/requests', icon: '◎', roles: ['CONSUMER'] },
    { label: 'Tracking', path: '/tracking', icon: '◷', roles: ['CONSUMER'] },
    { label: 'Review queries', path: '/admin/queries', icon: '◉', roles: ['ADMIN'] },
    { label: 'Create inquiry', path: '/admin/inquiries/create', icon: '◎', roles: ['ADMIN'] },
    {
      label: 'Onboarding',
      path: '/admin/onboarding',
      icon: '◆',
      roles: ['ADMIN'],
      children: [
        { label: 'Companies', path: '/admin/companies' },
        { label: 'Distributors', path: '/products/distributors' },
      ],
    },
    { label: 'Users', path: '/admin/users', icon: '◈', roles: ['ADMIN'] },
    { label: 'Gmail inbox', path: '/admin/gmail-inbox', icon: '✉', roles: ['ADMIN'] },
    { label: 'Company profile', path: '/profile', icon: '◇', roles: ['DISTRIBUTOR'] },
    { label: 'Profile', path: '/profile', icon: '◇', roles: ['ADMIN', 'CONSUMER'] },
  ];

  readonly navItems = computed(() => {
    const role = this.auth.currentUser()?.role;
    return this.allNavItems
      .filter((item) => !item.roles || (role && item.roles.includes(role)))
      .map((item) => ({
        ...item,
        children: item.children?.filter(
          (child) => !child.roles || (role && child.roles.includes(role)),
        ),
      }));
  });

  constructor() {
    this.expandActiveAdminGroups();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.expandActiveAdminGroups());
  }

  /** Collapsible dropdown only for admin groups that have children. */
  isCollapsible(item: NavItem): boolean {
    return this.auth.currentUser()?.role === 'ADMIN' && !!item.children?.length;
  }

  isExpanded(item: NavItem): boolean {
    return this.expandedGroups().has(item.path);
  }

  isGroupActive(item: NavItem): boolean {
    const url = this.router.url.split('?')[0];
    if (item.children?.length) {
      if (url === item.path) {
        return true;
      }
      return item.children.some(
        (child) => url === child.path || url.startsWith(`${child.path}/`),
      );
    }
    return url === item.path || url.startsWith(`${item.path}/`);
  }

  toggleGroup(item: NavItem, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.isCollapsible(item)) {
      return;
    }
    this.expandedGroups.update((current) => {
      const next = new Set(current);
      if (next.has(item.path)) {
        next.delete(item.path);
      } else {
        next.add(item.path);
      }
      return next;
    });
  }

  showChildren(item: NavItem): boolean {
    if (!item.children?.length) {
      return false;
    }
    // Non-admin (e.g. consumer): keep children always visible.
    if (!this.isCollapsible(item)) {
      return true;
    }
    return this.isExpanded(item);
  }

  welcomeRoleLabel(role?: string): string {
    switch (role) {
      case 'ADMIN':
        return 'Admin';
      case 'CONSUMER':
        return 'Customer';
      case 'DISTRIBUTOR':
        return 'Distributor';
      default:
        return role?.trim() || '';
    }
  }

  welcomeDisplayName(user: AuthUser): string | null {
    const companyName = user.companyName?.trim();
    return companyName || null;
  }

  logout(): void {
    this.auth.logout();
  }

  private expandActiveAdminGroups(): void {
    if (this.auth.currentUser()?.role !== 'ADMIN') {
      return;
    }
    const url = this.router.url.split('?')[0];
    this.expandedGroups.update((current) => {
      const next = new Set(current);
      for (const item of this.allNavItems) {
        if (!item.children?.length) {
          continue;
        }
        const childActive = item.children.some(
          (child) => url === child.path || url.startsWith(`${child.path}/`),
        );
        if (childActive || url === item.path) {
          next.add(item.path);
        }
      }
      return next;
    });
  }
}
