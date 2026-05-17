import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

const SESSION_DURATION_MS = 20 * 60 * 1000; // 20 minutes
const EXPIRY_KEY = 'session_expiry';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiBaseUrl}/api/auth`;
  private _expiryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Emits whenever a session ends without the user explicitly clicking
   * Logout. The reason lets the UI tell the truth in the toast — "idle"
   * means the 20-minute timer fired, "invalid" means the backend rejected
   * our token (token expired server-side, secret rotated, etc.). */
  readonly sessionExpired$ = new Subject<'idle' | 'invalid'>();

  constructor(private http: HttpClient, private router: Router) {
    // Re-arm the timer on page refresh if a valid session exists
    if (this.isLoggedIn()) {
      this._armTimer();
    }
  }

  signup(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/signup`, userData);
  }

  checkEmail(email: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/check-email?email=${encodeURIComponent(email)}`);
  }


  login(credentials: { email: string; password: string }): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/login/json`, credentials).pipe(
      tap(response => {
        localStorage.setItem('auth_token', response.access_token);
        this._setExpiry();
        this._armTimer();
      })
    );
  }

  logout(options: { reason?: 'idle' | 'invalid' } = {}) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem(EXPIRY_KEY);
    if (this._expiryTimer) {
      clearTimeout(this._expiryTimer);
      this._expiryTimer = null;
    }
    if (options.reason) {
      this.sessionExpired$.next(options.reason);
    }
    this.router.navigate(['/home']);
  }

  /** Call on every user activity to extend the session by 20 minutes. */
  refreshSession() {
    if (this.isLoggedIn()) {
      this._setExpiry();
      this._armTimer();
    }
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;
    const expiry = Number(localStorage.getItem(EXPIRY_KEY));
    if (expiry && Date.now() > expiry) {
      // Session expired — clean up silently
      localStorage.removeItem('auth_token');
      localStorage.removeItem(EXPIRY_KEY);
      return false;
    }
    return true;
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getCurrentUser(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`);
  }

  updateProfile(payload: {
    full_name?: string;
    phone?: string;
    address_line_1?: string;
    address_line_2?: string;
    landmark?: string;
    location_link?: string;
  }): Observable<any> {
    return this.http.put(`${this.apiUrl}/me`, payload);
  }

  updateNotifications(payload: {
    notif_delivery?: boolean;
    notif_subscriptions?: boolean;
    notif_offers?: boolean;
  }): Observable<any> {
    return this.http.put(`${this.apiUrl}/me/notifications`, payload);
  }

  changePassword(current_password: string, new_password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-password`, { current_password, new_password });
  }

  deleteAccount(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/me`);
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-otp`, { email, otp });
  }

  resetPassword(email: string, otp: string, new_password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { email, otp, new_password });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────
  private _setExpiry() {
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + SESSION_DURATION_MS));
  }

  private _armTimer() {
    if (this._expiryTimer) clearTimeout(this._expiryTimer);
    const expiry = Number(localStorage.getItem(EXPIRY_KEY));
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      this.logout({ reason: 'idle' });
      return;
    }
    this._expiryTimer = setTimeout(() => this.logout({ reason: 'idle' }), remaining);
  }
}
