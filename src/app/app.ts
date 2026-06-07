import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { HeaderComponent } from './components/header/header';
import { FooterComponent } from './components/footer/footer';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav';
import { AuthService } from './services/auth.service';
import { LoadingService } from './services/loading.service';
import { environment } from '../environments/environment';


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
  private http = inject(HttpClient);
  private loadingService = inject(LoadingService);

  settings: any = null;
  isNavigating = false;
  isHttpLoading = false;

  get showGlobalLoader(): boolean {
    return this.isNavigating || this.isHttpLoading;
  }

  // Parallax cursor tracking
  mouseX = 0;
  mouseY = 0;

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    // Calculate percentage offset from screen center
    const x = (event.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    const y = (event.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    this.mouseX = x * 15; // Max 15px shift
    this.mouseY = y * 15; // Max 15px shift
    
    // Set global CSS custom properties
    document.documentElement.style.setProperty('--mouse-x', `${this.mouseX}px`);
    document.documentElement.style.setProperty('--mouse-y', `${this.mouseY}px`);
    
    // Refresh session activity
    this.auth.refreshSession();
  }

  playLoaderVideo() {
    setTimeout(() => {
      const video = document.querySelector('.loader-brand-video') as HTMLVideoElement;
      if (video) {
        video.muted = true;
        video.play().catch(() => {});
      }
    }, 50);
  }

  ngOnInit() {
    // Subscribe to global HTTP loading state
    this.loadingService.isLoading.subscribe((loading) => {
      this.isHttpLoading = loading;
      if (loading) {
        this.playLoaderVideo();
      }
    });

    // Listen to router navigation events for the brand loader transition
    this.router.events.subscribe((event: any) => {
      if (event instanceof NavigationStart) {
        this.isNavigating = true;
        this.playLoaderVideo();
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        // Add a tiny delay (e.g. 500ms) for a premium, visible transition
        setTimeout(() => {
          this.isNavigating = false;
        }, 500);
      }
    });

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

    // Fetch branding and business settings globally
    this.http.get(`${environment.apiBaseUrl}/api/settings`).subscribe({
      next: (data) => { this.settings = data; },
      error: () => {}
    });

    // Fetch user profile if logged in for the persistent brand badge
    if (this.isLoggedIn) {
      this.loadUser();
    }
  }

  currentUser: any = null;

  loadUser() {
    this.auth.getCurrentUser().subscribe({
      next: (u) => { this.currentUser = u; },
      error: () => { this.currentUser = null; }
    });
  }

  get isLoggedIn(): boolean {
    const logged = this.auth.isLoggedIn();
    if (logged && !this.currentUser) {
      this.loadUser();
    }
    return logged;
  }


  get whatsappLink(): string {
    const phone = this.settings?.phone_number || '919629105651'; // standard fallback
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/${digits}`;
  }

  // Reset session timer on key activity
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
    return !this.noHeaderRoutes.includes(this.currentUrl)
      && !this.currentUrl.startsWith('/admin')
      && !this.currentUrl.startsWith('/driver');
  }

  get showFooter(): boolean {
    return !this.noFooterRoutes.includes(this.currentUrl)
      && !this.currentUrl.startsWith('/admin')
      && !this.currentUrl.startsWith('/driver');
  }

  private readonly bottomNavRoutes = ['/dashboard', '/dashboard/credits', '/plans', '/profile'];
  
  get showBottomNav(): boolean {
    return this.bottomNavRoutes.includes(this.currentUrl)
      && !this.currentUrl.startsWith('/driver');
  }

  // Routes where the "Chat with Admin" badge is allowed to appear
  private readonly chatBadgeRoutes = ['/dashboard', '/plans', '/profile'];

  get showChatBadge(): boolean {
    const isCustomer = this.currentUser?.role?.toLowerCase() === 'customer';
    const onAllowedRoute = this.chatBadgeRoutes.some(r => this.currentUrl === r || this.currentUrl.startsWith(r + '/'));
    return this.isLoggedIn && isCustomer && onAllowedRoute
      && !this.currentUrl.startsWith('/driver');
  }
}

