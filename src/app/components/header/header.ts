import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { NotificationsDrawerComponent } from '../notifications-drawer/notifications-drawer';
import { environment } from '../../../environments/environment';

const SEEN_KEY = 'nutribox_seen_announcements';

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
  unreadCount = 0;
  logoPreviewOpen = false;

  constructor(private auth: AuthService, private http: HttpClient) {}

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
      // Fetch announcement count to compute unread badge
      this.fetchUnreadCount();
    }
  }

  private fetchUnreadCount() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/api/announcements?status=active`).subscribe({
      next: (items) => {
        const seenIds: number[] = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
        this.unreadCount = items.filter(a => !seenIds.includes(a.id)).length;
      },
      error: () => { this.unreadCount = 0; }
    });
  }

  openDrawer() {
    this.drawerOpen = true;
    // Mark all current announcements as seen when drawer opens
    this.http.get<any[]>(`${environment.apiBaseUrl}/api/announcements?status=active`).subscribe({
      next: (items) => {
        const ids = items.map(a => a.id);
        localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
        this.unreadCount = 0;
      },
      error: () => {}
    });
  }

  openLogoPreview(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.logoPreviewOpen = true;
  }

  closeLogoPreview() {
    this.logoPreviewOpen = false;
  }

  toggleAvatarMenu() { this.avatarMenuOpen = !this.avatarMenuOpen; }
  closeAvatarMenu() { this.avatarMenuOpen = false; }
  
  logout() {
    this.auth.logout();
    this.closeAvatarMenu();
  }
}

