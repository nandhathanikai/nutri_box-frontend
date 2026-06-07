import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService, Subscription, CalendarResponse, CalendarSession } from '../../services/subscription.service';
import { DeliveryService } from '../../services/delivery.service';
import { MealCalendarComponent } from '../../components/meal-calendar/meal-calendar';
import { BrandBarComponent } from '../../components/brand-bar/brand-bar';
import { GalleryCarouselComponent } from '../../components/gallery-carousel/gallery-carousel';
import { environment } from '../../../environments/environment';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface UserState {
  full_name: string;
  email: string;
  has_subscription: boolean;
  days_until_auto_delete: number | null;
}

interface Offer {
  id: number;
  code: string;
  description: string;
  type: 'pct' | 'flat' | 'free';
  value: number;
  max_cap: number | null;
  valid_until: string;
  audience: string;
}

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, ButtonModule, FormsModule,
    ToastModule, ConfirmDialogModule, RouterModule,
    MealCalendarComponent, BrandBarComponent, GalleryCarouselComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  user: UserState = { full_name: '', email: '', has_subscription: false, days_until_auto_delete: null };
  greeting = '';
  loading = true;

  subscription: Subscription | null = null;
  calendar: CalendarResponse | null = null;
  weekImageUrl: string | null = null;
  offers: Offer[] = [];
  copiedCode: string | null = null;

  // ── Customer Review State ──────────────────────────────────────────────
  myReview: any = null;
  ratingVal = 5;
  reviewText = '';
  submittingReview = false;
  showReviewThanks = false;

  showPaymentSuccess = false;
  cancellingSub = false;
  loadFailed = false;
  activeDeliveries: any[] = [];
  private activeDeliveriesTimer: any = null;

  constructor(
    private authService: AuthService,
    private subs: SubscriptionService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private msg: MessageService,
    private confirm: ConfirmationService,
    private deliveryService: DeliveryService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.greeting = this.getGreeting();
  }

  ngOnInit() {
    this.loadAll();
    this.startShowcaseAutoPlay();
    this.loadActiveDeliveries();
    this.activeDeliveriesTimer = setInterval(() => this.loadActiveDeliveries(true), 30000);

    this.route.queryParams.subscribe(params => {
      if (params['payment_success'] === 'true') {
        this.showPaymentSuccess = true;
        // Clean query parameter from URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { payment_success: null },
          queryParamsHandling: 'merge'
        });
      }
    });
  }

  ngOnDestroy() {
    this.stopShowcaseAutoPlay();
    if (this.activeDeliveriesTimer) {
      clearInterval(this.activeDeliveriesTimer);
    }
  }

  loadActiveDeliveries(silent = false) {
    this.deliveryService.getActiveDeliveries().subscribe({
      next: (deliveries) => {
        this.activeDeliveries = deliveries || [];
        this.cdr.detectChanges();
      },
      error: () => {
        if (!silent) this.activeDeliveries = [];
      }
    });
  }

  private loadAll() {
    this.loading = true;
    this.loadFailed = false;

    forkJoin({
      profile: this.authService.getCurrentUser().pipe(
        catchError(err => {
          console.error('Failed to load profile', err);
          return of(null);
        })
      ),
      sub: this.subs.getMySubscription().pipe(
        catchError(err => {
          console.error('Failed to load subscription', err);
          return of(null);
        })
      ),
      calendar: this.subs.getCalendar().pipe(
        catchError(err => {
          console.error('Failed to load calendar', err);
          return of(null);
        })
      ),
      offers: this.http.get<Offer[]>(`${environment.apiBaseUrl}/api/offers/my-offers`).pipe(
        catchError(err => {
          console.error('Failed to load offers', err);
          return of([] as Offer[]);
        })
      ),
      gallery: this.http.get<any[]>(`${environment.apiBaseUrl}/api/gallery`).pipe(
        catchError(err => {
          console.error('Failed to load gallery', err);
          return of([] as any[]);
        })
      ),
      myReview: this.http.get<any>(`${environment.apiBaseUrl}/api/reviews/my-review`).pipe(
        catchError(err => {
          console.error('Failed to load user review', err);
          return of({ review: null });
        })
      )
    }).subscribe({
      next: (res) => {
        if (!res.profile) {
          this.loading = false;
          this.loadFailed = true;
          this.msg.add({
            severity: 'error',
            summary: 'Connection issue',
            detail: 'We couldn\'t load your profile. Please try again.'
          });
          return;
        }

        const profile = res.profile;
        this.user = {
          full_name: profile.full_name || profile.name || 'User',
          email: profile.email || '',
          has_subscription: !!profile.has_subscription,
          days_until_auto_delete: profile.days_until_auto_delete ?? null,
        };

        this.subscription = res.sub;
        if (res.sub) {
          this.loadWeeklyMenu(res.sub);
        }

        this.calendar = res.calendar;
        this.offers = res.offers || [];

        this.myReview = res.myReview?.review || null;
        if (this.myReview) {
          this.ratingVal = this.myReview.rating;
          this.reviewText = this.myReview.text;
        } else {
          this.ratingVal = 5;
          this.reviewText = '';
        }

        this.galleryImages = (res.gallery || []).map((img: any) => ({
          id: img.id,
          image_url: img.image_url,
          caption: img.caption ?? null,
          sort_order: img.sort_order,
          created_at: img.created_at,
        }));
        this.virtualCenterIndex = 0;

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
        this.msg.add({
          severity: 'error',
          summary: 'Connection issue',
          detail: 'We couldn\'t load your dashboard. Please try again.'
        });
      }
    });
  }

  retryLoad() { this.loadAll(); }

  loadCalendar() {
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

  offerValueLabel(o: Offer): string {
    if (o.type === 'pct')  return `${o.value}% OFF`;
    if (o.type === 'flat') return `₹${o.value} OFF`;
    return 'FREE DELIVERY';
  }

  daysLeft(dateStr: string): number {
    const end = new Date(dateStr).getTime();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((end - today.getTime()) / 86400000));
  }

  copyOfferCode(code: string) {
    this.copiedCode = code;
    navigator.clipboard?.writeText(code).catch(() => {});
    setTimeout(() => { if (this.copiedCode === code) this.copiedCode = null; }, 2500);
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

  // ── Wellness Tips Engine ───────────────────────────────────────────────────
  wellnessTips = [
    { text: 'Avocados are packed with healthy monounsaturated fats that fuel your brain and keeps you focused! 🥑', author: 'NutriBox Chef Team' },
    { text: 'Spinach is high in iron, calcium, and magnesium. It helps build muscles and boosts energy naturally! 🥬', author: 'NutriBox Nutritionist' },
    { text: 'Proper hydration is vital for macro absorption! Drink at least 3 liters of water throughout the day. 💧', author: 'Health Advisor' },
    { text: 'Delivered Mon-Sat: If you skip your meal before 6:00 PM the previous day, it is added back as credits! 🗓️', author: 'Delivery Manager' },
    { text: 'Consistency beats perfection! Eating chef-curated balanced meals regularly builds long-term fitness habits. 🥗', author: 'NutriBox Fitness Coach' },
    { text: 'Eating breakfast within 1 hour of waking up boosts your metabolism and keeps your sugar levels stable! 🌅', author: 'Daily Meal Guide' }
  ];

  currentTip = this.wellnessTips[Math.floor(Math.random() * this.wellnessTips.length)];

  showNextTip() {
    let index = this.wellnessTips.indexOf(this.currentTip);
    let nextIndex = (index + 1) % this.wellnessTips.length;
    this.currentTip = this.wellnessTips[nextIndex];
  }

  galleryImages: any[] = [];
  virtualCenterIndex = 0;   // unbounded; modulo maps to baseImages

  // Removed loadGalleryImages as it is inlined into loadAll forkJoin

  /** Real gallery images, or placeholder slots when gallery is empty */
  get baseImages(): any[] {
    const raw = this.galleryImages;
    if (!raw || raw.length === 0) {
      return Array.from({ length: 5 }, (_, i) => ({ isPlaceholder: true, _id: i }));
    }
    // Return only the real images — no padding or repetition
    return raw;
  }

  /** Visible cards: at most min(imageCount, 5), no duplicates */
  get covercards(): Array<{ img: any; absIdx: number }> {
    const len = this.baseImages.length;
    const visibleCount = Math.min(len, 5);
    // Build offsets centered at 0, e.g.: 1→[0], 2→[0,1], 3→[-1,0,1], 4→[-1,0,1,2], 5→[-2,-1,0,1,2]
    const half = Math.floor(visibleCount / 2);
    const offsets = Array.from({ length: visibleCount }, (_, i) => i - half);
    return offsets.map(offset => {
      const absIdx = this.virtualCenterIndex + offset;
      const imgIdx = ((absIdx % len) + len) % len;
      return { img: this.baseImages[imgIdx], absIdx };
    });
  }

  absFromCenter(absIdx: number): number {
    return Math.abs(absIdx - this.virtualCenterIndex);
  }

  get activeDotIndex(): number {
    const len = this.baseImages.length;
    return ((this.virtualCenterIndex % len) + len) % len;
  }

  // Keep for backward-compat
  get showcaseImages(): any[] { return this.baseImages; }
  get visibleCards(): any[] { return []; }
  get extendedImages(): any[] { return []; }
  get trackTransform(): string { return ''; }
  readonly CARD_STEP = 216;
  silentJump = false;
  setActiveShowcaseIndexFromVisible(_i: number) {}
  absCardDistance(_i: number): number { return 0; }
  activeShowcaseIndex = 0;

  nextShowcase() {
    this.virtualCenterIndex++;
    this.cdr.detectChanges();
  }

  prevShowcase() {
    this.virtualCenterIndex--;
    this.cdr.detectChanges();
  }

  goToCard(dotIndex: number) {
    const len = this.baseImages.length;
    // Shift virtualCenterIndex to land on dotIndex in the shortest direction
    const current = ((this.virtualCenterIndex % len) + len) % len;
    let diff = dotIndex - current;
    if (diff > len / 2) diff -= len;
    if (diff < -len / 2) diff += len;
    this.virtualCenterIndex += diff;
    this.resetShowcaseAutoPlay();
    this.cdr.detectChanges();
  }

  getShowcaseCardClass(index: number): string {
    if (index === this.activeShowcaseIndex) {
      return 'card-large';
    }
    return 'card-small';
  }

  // ── Autoplay Timer Engine ──────────────────────────────────────────────────
  autoPlayTimer: any = null;

  startShowcaseAutoPlay() {
    this.stopShowcaseAutoPlay();
    this.autoPlayTimer = setInterval(() => {
      this.nextShowcase();
    }, 2000); // Slides every 2 seconds
  }

  stopShowcaseAutoPlay() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  resetShowcaseAutoPlay() { this.startShowcaseAutoPlay(); }

  // ── Customer Reviews Handlers ──
  setRating(star: number) {
    this.ratingVal = star;
    this.cdr.detectChanges();
  }

  submitReview() {
    if (!this.reviewText.trim() || this.submittingReview) return;
    this.submittingReview = true;

    this.http.post<any>(`${environment.apiBaseUrl}/api/reviews`, {
      rating: this.ratingVal,
      text: this.reviewText.trim()
    }).subscribe({
      next: (res) => {
        this.submittingReview = false;
        this.showReviewThanks = true;
        this.myReview = { rating: this.ratingVal, text: this.reviewText.trim(), created_at: new Date() };
        this.msg.add({ severity: 'success', summary: 'Success', detail: 'Review submitted successfully!' });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submittingReview = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Could not submit review.' });
        this.cdr.detectChanges();
      }
    });
  }

  deleteReview() {
    this.confirm.confirm({
      message: 'Are you sure you want to delete your review?',
      header: 'Delete Review',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.http.delete<any>(`${environment.apiBaseUrl}/api/reviews`).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Success', detail: 'Review deleted.' });
            this.loadAll(); // reset state
          },
          error: (err) => {
            this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Could not delete review.' });
          }
        });
      }
    });
  }
}
