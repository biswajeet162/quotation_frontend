import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';

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
    { label: 'Create quotation', path: '/requests', icon: '◎', roles: ['CONSUMER'] },
    { label: 'Tracking', path: '/tracking', icon: '◷', roles: ['CONSUMER'] },
    { label: 'Review queries', path: '/admin/queries', icon: '◉', roles: ['ADMIN'] },
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

  logout(): void {
    this.auth.logout();
  }
}
