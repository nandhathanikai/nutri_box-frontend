import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { HeaderComponent } from './components/header/header';
import { FooterComponent } from './components/footer/footer';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, BottomNavComponent, ToastModule],
  providers: [MessageService],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private msg = inject(MessageService);

  ngOnInit() {
    // Single subscription at the app shell so any page picks up the toast,
    // regardless of which route was active when the timer fired.
    this.auth.sessionExpired$.subscribe((reason) => {
      const detail = reason === 'idle'
        ? 'You\'ve been signed out after 20 minutes of inactivity.'
        : 'Please sign in again to continue.';
      this.msg.add({
        key: 'global',
        severity: 'warn',
        summary: 'Session ended',
        detail,
        life: 6000,
      });
    });
  }

  // Reset session timer on any user activity
  @HostListener('document:mousemove')
  @HostListener('document:keydown')
  @HostListener('document:click')
  @HostListener('document:touchstart')
  onUserActivity() {
    this.auth.refreshSession();
  }

  private get currentUrl(): string {
    return this.router.url.split('?')[0];
  }

  private readonly noHeaderRoutes = ['/', '/home', '/login', '/signup'];
  private readonly noFooterRoutes = ['/login', '/signup'];

  get showHeader(): boolean {
    return !this.noHeaderRoutes.includes(this.currentUrl) && !this.currentUrl.startsWith('/admin');
  }

  get showFooter(): boolean {
    return !this.noFooterRoutes.includes(this.currentUrl) && !this.currentUrl.startsWith('/admin');
  }

  private readonly bottomNavRoutes = ['/dashboard', '/dashboard/credits', '/plans', '/profile'];
  
  get showBottomNav(): boolean {
    return this.bottomNavRoutes.includes(this.currentUrl);
  }
}

