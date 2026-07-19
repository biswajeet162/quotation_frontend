import { Component, computed, inject, input, output } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthUser } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth/auth.service';

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

  readonly collapsed = input(false);
  readonly toggleSidebar = output<void>();

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
        { label: 'Distributors', path: '/products/distributors', roles: ['ADMIN'] },
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
    { label: 'Companies', path: '/admin/companies', icon: '◆', roles: ['ADMIN'] },
    { label: 'Users', path: '/admin/users', icon: '◈', roles: ['ADMIN'] },
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
}
