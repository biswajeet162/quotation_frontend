import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles?: string[];
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
    { label: 'Products', path: '/products', icon: '▣' },
    { label: 'Create quotation', path: '/requests', icon: '◎', roles: ['CONSUMER'] },
    { label: 'Review queries', path: '/admin/queries', icon: '◉', roles: ['ADMIN'] },
    { label: 'Profile', path: '/profile', icon: '◇' },
  ];

  readonly navItems = computed(() => {
    const role = this.auth.currentUser()?.role;
    return this.allNavItems.filter((item) => !item.roles || (role && item.roles.includes(role)));
  });

  logout(): void {
    this.auth.logout();
  }
}
