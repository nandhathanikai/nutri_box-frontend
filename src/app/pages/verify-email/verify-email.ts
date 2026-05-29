import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="verify-shell">
      <div class="verify-card">
        <div class="brand">
          <span class="logo-mark">N</span>
          <span class="brand-name">Nutribox</span>
        </div>

        <!-- Loading -->
        <div *ngIf="state === 'loading'" class="state-block">
          <div class="spinner"></div>
          <p>Verifying your email address…</p>
        </div>

        <!-- Success -->
        <div *ngIf="state === 'success'" class="state-block">
          <div class="icon-wrap icon-success">
            <i class="pi pi-check-circle"></i>
          </div>
          <h2>Email Verified!</h2>
          <p>Your account is now active. You can sign in and start your wellness journey.</p>
          <a routerLink="/login" class="btn btn-primary">Sign In →</a>
        </div>

        <!-- Already verified / invalid token -->
        <div *ngIf="state === 'error'" class="state-block">
          <div class="icon-wrap icon-error">
            <i class="pi pi-times-circle"></i>
          </div>
          <h2>Link Invalid or Expired</h2>
          <p>{{ errorMessage }}</p>
          <a routerLink="/login" class="btn btn-ghost">Back to Login</a>
        </div>

        <!-- No token in URL -->
        <div *ngIf="state === 'no-token'" class="state-block">
          <div class="icon-wrap icon-error">
            <i class="pi pi-exclamation-circle"></i>
          </div>
          <h2>Invalid Link</h2>
          <p>This verification link is incomplete. Please use the link from your email.</p>
          <a routerLink="/login" class="btn btn-ghost">Back to Login</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .verify-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a4731 0%, #2d6a4f 60%, #40916c 100%);
      padding: 2rem;
    }

    .verify-card {
      background: #fff;
      border-radius: 20px;
      padding: 2.5rem;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      text-align: center;
    }

    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .logo-mark {
      width: 36px;
      height: 36px;
      background: #2d6a4f;
      color: #fff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 1.1rem;
      line-height: 36px;
    }

    .brand-name {
      font-size: 1.2rem;
      font-weight: 800;
      color: #1a3a2a;
    }

    .state-block { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }

    .icon-wrap {
      width: 72px; height: 72px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 2.2rem; margin-bottom: 0.5rem;
    }
    .icon-success { background: #f0fdf4; color: #2d6a4f; }
    .icon-error   { background: #fee2e2; color: #dc2626; }

    h2 { font-size: 1.4rem; font-weight: 700; color: #1a3a2a; margin: 0; }
    p  { font-size: 0.9rem; color: #6b7280; line-height: 1.5; max-width: 320px; }

    .btn {
      display: inline-block; padding: 0.7rem 1.75rem;
      border-radius: 10px; font-weight: 600; font-size: 0.9rem;
      text-decoration: none; margin-top: 0.5rem; transition: 0.15s;
    }
    .btn-primary { background: #2d6a4f; color: #fff; }
    .btn-primary:hover { background: #1b4332; }
    .btn-ghost   { background: #f9fafb; color: #374151; border: 1px solid #e5e7eb; }
    .btn-ghost:hover { background: #f0fdf4; }

    .spinner {
      width: 48px; height: 48px; border: 3px solid #e5e7eb;
      border-top-color: #2d6a4f; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin-bottom: 0.5rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class VerifyEmailComponent implements OnInit {
  state: 'loading' | 'success' | 'error' | 'no-token' = 'loading';
  errorMessage = 'This link is invalid or has already been used. Please request a new verification email by logging in.';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state = 'no-token';
      return;
    }

    this.http.get(`${environment.apiBaseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`).subscribe({
      next: () => {
        this.state = 'success';
      },
      error: (err) => {
        this.state = 'error';
        if (err?.error?.detail) {
          this.errorMessage = err.error.detail;
        }
      }
    });
  }
}
