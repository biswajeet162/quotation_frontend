import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: '◫' },
    { label: 'Products', path: '/products', icon: '▣' },
    { label: 'Profile', path: '/profile', icon: '◎' },
  ];
}
