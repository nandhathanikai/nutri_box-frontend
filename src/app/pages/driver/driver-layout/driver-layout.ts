import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { DeliveryService } from '../../../services/delivery.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-driver-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="driver-shell">

      <!-- ── Driver Header ─────────────────────────────────────── -->
      <header class="driver-header">

        <!-- Brand -->
        <div class="header-brand">
          <div class="brand-icon">
            <img src="/logo1.png" alt="Nutribox" class="brand-logo" />
          </div>
          <div class="brand-text">
            <span class="brand-name">Nutribox</span>
            <span class="brand-role">Driver Portal</span>
          </div>
        </div>

        <!-- Nav -->
        <nav class="header-nav">
          <a routerLink="/driver/dashboard"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{exact:true}"
             id="nav-my-deliveries">
            <i class="pi pi-truck"></i> My Deliveries
          </a>
        </nav>

        <!-- Right controls -->
        <div class="header-right">

          <!-- Online / Offline toggle pill -->
          <button
            class="status-pill"
            [class.online]="isOnline"
            (click)="toggleStatus()"
            [title]="isOnline ? 'Online — tap to go offline' : 'Offline — tap to go online'"
            id="btn-toggle-status">
            <span class="status-dot"></span>
            {{ isOnline ? 'Online' : 'Offline' }}
          </button>

          <!-- Logout -->
          <button class="btn-logout" (click)="logout()" id="btn-logout">
            <i class="pi pi-sign-out"></i> Logout
          </button>

        </div>
      </header>

      <!-- Page content -->
      <main class="driver-content">
        <router-outlet></router-outlet>
      </main>

    </div>
  `,
  styles: [`
    :host { display: block; font-family: var(--font-family, 'Josefin Sans', sans-serif); }

    /* ── Shell ────────────────────────────────────────────────── */
    .driver-shell {
      min-height: 100vh;
      display: flex; flex-direction: column;
      background: #f3f7f3;
    }

    /* ── Header ───────────────────────────────────────────────── */
    .driver-header {
      background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%);
      color: white;
      padding: 0 1.5rem;
      height: 56px;
      display: flex; align-items: center; gap: 1.25rem;
      position: sticky; top: 0; z-index: 100;
      box-shadow: 0 2px 16px rgba(0,0,0,0.22);
    }

    /* Brand */
    .header-brand {
      display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0;
    }
    .brand-icon {
      width: 36px; height: 36px;
      border-radius: 50%;
      overflow: hidden;
      background: white;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.3);
    }
    .brand-logo {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }
    .brand-name { display: block; font-weight: 700; font-size: 0.92rem; line-height: 1.15; }
    .brand-role {
      display: block; font-size: 0.62rem;
      opacity: 0.65; letter-spacing: 0.08em; text-transform: uppercase;
    }

    /* Nav */
    .header-nav { display: flex; gap: 0.25rem; flex: 1; }
    .header-nav a {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.38rem 0.85rem; border-radius: 7px;
      color: rgba(255,255,255,0.78);
      text-decoration: none;
      font-size: 0.84rem; font-weight: 600;
      transition: background 0.15s, color 0.15s;
    }
    .header-nav a i { font-size: 0.82rem; }
    .header-nav a:hover,
    .header-nav a.active {
      background: rgba(255,255,255,0.16); color: #fff;
    }

    /* Right */
    .header-right { display: flex; align-items: center; gap: 0.6rem; margin-left: auto; }

    /* Status pill */
    .status-pill {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.32rem 0.8rem;
      border: 1.5px solid rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.85);
      border-radius: 20px;
      font-size: 0.76rem; font-weight: 700;
      cursor: pointer; font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .status-pill:hover { background: rgba(255,255,255,0.16); }
    .status-pill.online {
      border-color: #86efac;
      background: rgba(134,239,172,0.15);
      color: #bbf7d0;
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #9ca3af; flex-shrink: 0;
      transition: background 0.2s, box-shadow 0.2s;
    }
    .status-pill.online .status-dot {
      background: #4ade80;
      box-shadow: 0 0 0 3px rgba(74,222,128,0.3);
      animation: pulse-dot 1.8s infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
      50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
    }

    /* Logout */
    .btn-logout {
      display: flex; align-items: center; gap: 0.35rem;
      border: 1.5px solid rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.85);
      border-radius: 8px;
      padding: 0.38rem 0.85rem;
      font-size: 0.82rem; font-weight: 600;
      cursor: pointer; font-family: inherit;
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .btn-logout:hover { background: rgba(255,255,255,0.18); color: #fff; }
    .btn-logout i { font-size: 0.82rem; }

    /* Content area */
    .driver-content {
      flex: 1; padding: 1.5rem;
      max-width: 960px; margin: 0 auto; width: 100%;
    }

    @media (max-width: 600px) {
      .driver-header { padding: 0 1rem; gap: 0.75rem; }
      .driver-content { padding: 1rem 0.75rem; }
      .brand-role { display: none; }
    }
  `]
})
export class DriverLayoutComponent implements OnInit {
  isOnline = false;

  constructor(
    private auth: AuthService,
    private deliveryService: DeliveryService,
    private router: Router
  ) {}

  ngOnInit() {
    // Auto mark driver as available when they open the portal
    this.deliveryService.updateMyStatus('available').subscribe({
      next: () => { this.isOnline = true; },
      error: () => { this.isOnline = false; }
    });
  }

  toggleStatus() {
    const next = this.isOnline ? 'offline' : 'available';
    this.deliveryService.updateMyStatus(next).subscribe({
      next: () => { this.isOnline = !this.isOnline; },
      error: () => {}
    });
  }

  logout() {
    this.deliveryService.updateMyStatus('offline').subscribe({
      complete: () => this._doLogout(),
      error:    () => this._doLogout(),
    });
  }

  private _doLogout() {
    this.deliveryService.stopGpsTracking();
    this.deliveryService.disconnectCustomerTracking();
    this.auth.logout();
  }
}
