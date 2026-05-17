import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService, Subscription, CalendarResponse, CalendarSession } from '../../services/subscription.service';
import { MealCalendarComponent } from '../../components/meal-calendar/meal-calendar';
import { environment } from '../../../environments/environment';

interface UserState {
  full_name: string;
  email: string;
  has_subscription: boolean;
  days_until_auto_delete: number | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, ButtonModule,
    ToastModule, ConfirmDialogModule, RouterModule,
    MealCalendarComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  user: UserState = { full_name: '', email: '', has_subscription: false, days_until_auto_delete: null };
  greeting = '';
  loading = true;

  subscription: Subscription | null = null;
  calendar: CalendarResponse | null = null;
  weekImageUrl: string | null = null;

  cancellingSub = false;
  loadFailed = false;

  constructor(
    private authService: AuthService,
    private subs: SubscriptionService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private msg: MessageService,
    private confirm: ConfirmationService,
  ) {
    this.greeting = this.getGreeting();
  }

  ngOnInit() {
    this.loadAll();
  }

  private loadAll() {
    this.loading = true;
    this.loadFailed = false;
    this.authService.getCurrentUser().subscribe({
      next: (profile) => {
        this.user = {
          full_name: profile.full_name || profile.name || 'User',
          email: profile.email || '',
          has_subscription: !!profile.has_subscription,
          days_until_auto_delete: profile.days_until_auto_delete ?? null,
        };
        this.loadSubscription();
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
        this.msg.add({ severity: 'error', summary: 'Connection issue', detail: 'We couldn\'t load your dashboard. Please try again.' });
      }
    });
  }

  retryLoad() { this.loadAll(); }

  private loadSubscription() {
    this.subs.getMySubscription().subscribe({
      next: (sub) => {
        this.subscription = sub;
        if (sub) {
          this.loadCalendar();
          this.loadWeeklyMenu(sub);
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; }
    });
  }

  private loadCalendar() {
    this.subs.getCalendar().subscribe({
      next: (c) => { this.calendar = c; this.cdr.detectChanges(); },
      error: () => { /* keep dashboard usable even if calendar fails */ }
    });
  }

  private loadWeeklyMenu(sub: Subscription) {
    if (!sub.tier_name || !sub.diet_type) return;
    const monday = this.mondayOf(new Date()).toISOString().slice(0, 10);
    this.http.get<any>(`${environment.apiBaseUrl}/api/menu/weekly-menu-images?week_start_date=${monday}`).subscribe({
      next: (data) => {
        const tierName = (sub.tier_name || '').toLowerCase();
        const match = (data.images || []).find((img: any) =>
          (img.tier_name || '').toLowerCase() === tierName &&
          (img.diet_type === sub.diet_type || img.diet_type === 'both')
        );
        this.weekImageUrl = match?.image_url || null;
        this.cdr.detectChanges();
      }
    });
  }

  private mondayOf(d: Date): Date {
    const x = new Date(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  get firstName(): string {
    return this.user.full_name ? this.user.full_name.split(' ')[0] : 'there';
  }

  get isFreshAccount(): boolean {
    return !this.user.has_subscription;
  }

  get daysUntilExpiry(): number {
    if (!this.subscription?.end_date) return 0;
    const end = new Date(this.subscription.end_date).getTime();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((end - today.getTime()) / 86400000));
  }

  get isExpiringSoon(): boolean {
    return this.subscription?.status === 'expiring' || (this.daysUntilExpiry > 0 && this.daysUntilExpiry <= 3);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  handleSkip(payload: { date: string; session: CalendarSession }) {
    this.subs.skipDelivery(payload.date, payload.session.key).subscribe({
      next: (res) => {
        this.msg.add({
          severity: res.eligible ? 'success' : 'warn',
          summary: res.eligible ? 'Credit earned' : 'Skip recorded',
          detail: res.message,
          life: 5000,
        });
        // Refresh calendar to reflect new state
        this.loadCalendar();
      },
      error: (err) => {
        this.msg.add({
          severity: 'error',
          summary: 'Could not skip',
          detail: err.error?.detail || 'Please try again.',
        });
      }
    });
  }

  handleUnskip(payload: { date: string; session: CalendarSession }) {
    this.subs.unskipDelivery(payload.date, payload.session.key).subscribe({
      next: (res) => {
        this.msg.add({
          severity: 'success',
          summary: 'Skip cancelled',
          detail: res.message,
          life: 5000,
        });
        this.loadCalendar();
      },
      error: (err) => {
        this.msg.add({
          severity: 'error',
          summary: 'Could not cancel skip',
          detail: err.error?.detail || 'Please try again.',
        });
      }
    });
  }

  cancelSubscription() {
    if (!this.subscription) return;
    this.confirm.confirm({
      message: 'Cancel your subscription? It will end today and any pending credits will still be honoured.',
      header: 'Cancel subscription',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.cancellingSub = true;
        this.subs.cancel(this.subscription!.id).subscribe({
          next: () => {
            this.cancellingSub = false;
            this.msg.add({ severity: 'success', summary: 'Subscription cancelled' });
            this.subscription = null;
            this.calendar = null;
            this.weekImageUrl = null;
            // After cancelling, reload /me — has_subscription stays true so no grace banner
            this.loadAll();
          },
          error: (err) => {
            this.cancellingSub = false;
            this.msg.add({
              severity: 'error',
              summary: 'Could not cancel',
              detail: err.error?.detail || 'Please try again.',
            });
          }
        });
      }
    });
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  }
}
