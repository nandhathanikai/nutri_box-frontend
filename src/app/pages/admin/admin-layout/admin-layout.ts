import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss'
})
export class AdminLayoutComponent {
  sidebarOpen = false;

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'pi pi-th-large', route: '/admin' },
    { label: "Today's Orders", icon: 'pi pi-truck', route: '/admin/todays-orders' },
    { label: 'Customers', icon: 'pi pi-users', route: '/admin/customers' },
    { label: 'Menu Management', icon: 'pi pi-fw pi-list', route: '/admin/menu' },
    { label: 'Credits', icon: 'pi pi-wallet', route: '/admin/credits' },
    { label: 'Announcements', icon: 'pi pi-bell', route: '/admin/announcements' },
    { label: 'Offers', icon: 'pi pi-tag', route: '/admin/offers' },
    { label: 'Reports', icon: 'pi pi-chart-bar', route: '/admin/reports' },
    { label: 'Settings', icon: 'pi pi-cog', route: '/admin/settings' },
  ];

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }
}
