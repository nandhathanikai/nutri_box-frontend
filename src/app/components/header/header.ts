import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { NotificationsDrawerComponent } from '../notifications-drawer/notifications-drawer';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NotificationsDrawerComponent],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class HeaderComponent implements OnInit {
  initials = '';
  drawerOpen = false;
  avatarMenuOpen = false;
  isLoggedIn = false;

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.isLoggedIn = this.auth.isLoggedIn();
    if (this.isLoggedIn) {
      this.auth.getCurrentUser().subscribe({
        next: (data: any) => {
          const name: string = data.full_name ?? data.name ?? '';
          const parts = name.trim().split(/\s+/);
          const first = parts[0]?.[0]?.toUpperCase() ?? '';
          const last  = parts.length > 1 ? (parts[parts.length - 1][0]?.toUpperCase() ?? '') : '';
          this.initials = first + last || '?';
        },
        error: () => { this.initials = '?'; }
      });
    }
  }

  openDrawer() { this.drawerOpen = true; }
  
  toggleAvatarMenu() { this.avatarMenuOpen = !this.avatarMenuOpen; }
  closeAvatarMenu() { this.avatarMenuOpen = false; }
  
  logout() {
    this.auth.logout();
    this.closeAvatarMenu();
  }
}
