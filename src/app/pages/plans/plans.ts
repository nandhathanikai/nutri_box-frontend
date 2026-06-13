import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { PaymentService } from '../../services/payment.service';
import { environment } from '../../../environments/environment';
import { resolveImageUrl } from '../../utils/image-resolver';
import { StickyCtaComponent } from '../../components/sticky-cta/sticky-cta';
import { BrandBarComponent } from '../../components/brand-bar/brand-bar';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, SelectButtonModule, SkeletonModule, TabsModule, TooltipModule, ToastModule, StickyCtaComponent, BrandBarComponent],
  providers: [MessageService],
  templateUrl: './plans.html',
  styleUrl: './plans.scss',
  animations: [
    trigger('stepIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class PlansComponent implements OnInit {
  private apiUrl = `${environment.apiBaseUrl}/api/menu`;

  // ── Data ──────────────────────────────────────────────────────────────
  tiers: any[] = [];
  isLoading = true;

  // ── Selector State ────────────────────────────────────────────────────
  selectedTier: any = null;
  selectedDiet: string | null = null;
  selectedSlot: string | null = null;
  selectedDuration: string | null = null;
  
  // ── Menu Preview ──────────────────────────────────────────────────────
  currentMenuImage: string | null = null;
  isFetchingImage = false;

  // ── Lightbox ──────────────────────────────────────────────────────────
  lightboxVisible = false;
  lightboxImageUrl: string | null = null;
  lightboxTierName = '';
  lightboxTierSlug = '';
  lightboxTierIcon = 'pi-star';
  lightboxLoading = false;

  // ── Computed / Payment ────────────────────────────────────────────────
  computedPrice: any = null;
  isComputingPrice = false;
  isPaymentLoading = false;

  // ── Promo Code State ──────────────────────────────────────────────────
  promoCode = '';
  promoApplied = false;
  isApplyingPromo = false;
  promoMessage = '';
  discountAmount = 0;

  // ── Logged-in user info (for Razorpay prefill) ────────────────────────
  currentUser: any = null;

  // ── Static Options ────────────────────────────────────────────────────
  slotOptions = [
    { label: '🌅 Breakfast Only', value: 'breakfast_only', desc: '6 meals/week or 24/month' },
    { label: '🌙 Dinner Only',    value: 'dinner_only',    desc: '6 meals/week or 24/month' },
    { label: '🍽️ Both Slots',     value: 'both',           desc: '12 meals/week or 48/month' },
  ];

  durationOptions = [
    { label: '⚡ Weekly',  value: 'weekly',  desc: 'Flexible, renew each week' },
    { label: '🗓️ Monthly', value: 'monthly', desc: 'Best value, full month' },
  ];

  constructor(
    private http: HttpClient,
    private msg: MessageService,
    private router: Router,
    private auth: AuthService,
    private payment: PaymentService,
  ) {}

  ngOnInit() {
    this.loadTiers();
    this.auth.getCurrentUser().subscribe({
      next: (u: any) => this.currentUser = u,
      error: () => {}
    });
  }

  loadTiers() {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/tiers`).subscribe({
      next: (data) => {
        this.tiers = data.filter(t => t.is_active);
        this.isLoading = false;
      },
      error: () => this.isLoading = false,
    });
  }

  // ── Selection Handlers ────────────────────────────────────────────────

  selectTier(tier: any) {
    this.removePromo();
    this.selectedTier = tier;
    this.selectedDiet = null;
    this.selectedSlot = null;
    this.selectedDuration = null;
    this.computedPrice = null;
    this.currentMenuImage = null;
  }

  selectDiet(diet: string) {
    this.removePromo();
    this.selectedDiet = diet;
    this.selectedSlot = null;
    this.selectedDuration = null;
    this.computedPrice = null;
    this.fetchMenuImage();
  }

  selectSlot(slot: string) {
    this.removePromo();
    this.selectedSlot = slot;
    this.selectedDuration = null;
    this.computedPrice = null;
  }

  selectDuration(duration: string) {
    this.removePromo();
    this.selectedDuration = duration;
    this.computePrice();
  }

  computePrice() {
    if (!this.selectedTier || !this.selectedDiet || !this.selectedSlot || !this.selectedDuration) return;

    this.isComputingPrice = true;
    const params = `tier_slug=${this.selectedTier.slug}&diet_type=${this.selectedDiet}&slot_combo=${this.selectedSlot}&duration=${this.selectedDuration}`;

    this.http.get<any>(`${this.apiUrl}/plans/compute?${params}`).subscribe({
      next: (data) => {
        this.computedPrice = data;
        this.isComputingPrice = false;
      },
      error: () => this.isComputingPrice = false,
    });
  }

  applyPromo() {
    if (!this.promoCode || this.isApplyingPromo || !this.computedPrice) return;
    this.isApplyingPromo = true;
    this.promoMessage = '';

    const orderTotal = this.computedPrice.subtotal + this.computedPrice.delivery_charge;

    this.http.post<any>(`${environment.apiBaseUrl}/api/offers/validate`, {
      code: this.promoCode.trim().toUpperCase(),
      order_total: orderTotal
    }).subscribe({
      next: (res) => {
        this.isApplyingPromo = false;
        if (res.valid) {
          this.promoApplied = true;
          this.discountAmount = res.discount;
          this.promoMessage = res.message || 'Promo code applied successfully!';
          this.computedPrice.total = Math.max(0, orderTotal - this.discountAmount);
          this.msg.add({ severity: 'success', summary: 'Promo Applied', detail: this.promoMessage });
        } else {
          this.promoApplied = false;
          this.discountAmount = 0;
          this.promoMessage = 'Invalid promo code.';
        }
      },
      error: (err) => {
        this.isApplyingPromo = false;
        this.promoApplied = false;
        this.discountAmount = 0;
        this.promoMessage = err?.error?.detail || 'Invalid promo code.';
        this.msg.add({ severity: 'error', summary: 'Invalid Code', detail: this.promoMessage });
      }
    });
  }

  removePromo() {
    this.promoApplied = false;
    this.promoCode = '';
    this.discountAmount = 0;
    this.promoMessage = '';
    if (this.computedPrice) {
      this.computedPrice.total = this.computedPrice.subtotal + this.computedPrice.delivery_charge;
    }
  }

  fetchMenuImage() {
    if (!this.selectedTier || !this.selectedDiet) {
      this.currentMenuImage = null;
      return;
    }
    this.isFetchingImage = true;
    const today = new Date().toISOString().split('T')[0];
    const params = `week_start_date=${today}&tier_id=${this.selectedTier.id}&diet_type=${this.selectedDiet}`;
    this.http.get<any>(`${this.apiUrl}/weekly-menu-images?${params}`).subscribe({
      next: (res) => {
        if (res.images && res.images.length > 0) {
          this.currentMenuImage = resolveImageUrl(res.images[0].image_url);
        } else {
          this.currentMenuImage = null;
        }
        this.isFetchingImage = false;
      },
      error: () => {
        this.currentMenuImage = null;
        this.isFetchingImage = false;
      }
    });
  }

  // ── Lightbox ──────────────────────────────────────────────────────────

  openMenuLightbox(tier: any, event: Event) {
    event.stopPropagation();  // don't trigger selectTier()
    this.lightboxVisible = true;
    this.lightboxLoading = true;
    this.lightboxImageUrl = null;
    this.lightboxTierName = tier.name;
    this.lightboxTierSlug = tier.slug;
    this.lightboxTierIcon = this.getTierIcon(tier.slug);

    // Try veg first, then nonveg, then 'both'
    const dietPreference = tier.diet_support === 'nonveg_only' ? 'nonveg' : 'veg';
    const today = new Date().toISOString().split('T')[0];
    const params = `week_start_date=${today}&tier_id=${tier.id}&diet_type=${dietPreference}`;

    this.http.get<any>(`${this.apiUrl}/weekly-menu-images?${params}`).subscribe({
      next: (res) => {
        if (res.images && res.images.length > 0) {
          this.lightboxImageUrl = resolveImageUrl(res.images[0].image_url);
        } else {
          // Fallback: try the other diet type
          const fallbackDiet = dietPreference === 'veg' ? 'nonveg' : 'veg';
          const fbParams = `week_start_date=${today}&tier_id=${tier.id}&diet_type=${fallbackDiet}`;
          this.http.get<any>(`${this.apiUrl}/weekly-menu-images?${fbParams}`).subscribe({
            next: (res2) => {
              this.lightboxImageUrl = (res2.images && res2.images.length > 0)
                ? resolveImageUrl(res2.images[0].image_url)
                : null;
              this.lightboxLoading = false;
            },
            error: () => { this.lightboxImageUrl = null; this.lightboxLoading = false; }
          });
          return;
        }
        this.lightboxLoading = false;
      },
      error: () => {
        this.lightboxImageUrl = null;
        this.lightboxLoading = false;
      }
    });
  }

  closeLightbox() {
    this.lightboxVisible = false;
    this.lightboxImageUrl = null;
  }

  goToCustomPlan() {
    this.router.navigate(['/plans/custom']);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  isAllSelected(): boolean {
    return !!(this.selectedTier && this.selectedDiet && this.selectedSlot && this.selectedDuration);
  }

  getDietOptionsForTier(tier: any) {
    if (!tier) return [];
    if (tier.diet_support === 'veg_only')    return [{ label: '🌿 Veg', value: 'veg' }];
    if (tier.diet_support === 'nonveg_only') return [{ label: '🍖 Non-Veg', value: 'nonveg' }];
    return [
      { label: '🌿 Veg',     value: 'veg' },
      { label: '🍖 Non-Veg', value: 'nonveg' },
    ];
  }

  getStartingPrice(tier: any): number {
    if (!tier?.pricing?.length) return 0;
    const ppm = Math.min(...tier.pricing.map((p: any) => p.price_per_meal));
    const weeklyDeliveryPerMeal = +tier.delivery_charge_weekly || 0;
    const meals = 6;
    return (ppm + weeklyDeliveryPerMeal) * meals;
  }

  getTierClass(slug: string): string {
    const map: Record<string, string> = {
      classic:      'tier-classic',
      premium:      'tier-premium',
      protein_rich: 'tier-protein',
      fruits_bowl:  'tier-fruits',
    };
    return map[slug] ?? '';
  }

  getTierIcon(slug: string): string {
    const map: Record<string, string> = {
      protein_rich: 'pi-bolt',
      classic:      'pi-star',
      premium:      'pi-crown',
      fruits_bowl:  'pi-apple',
    };
    return map[slug] ?? 'pi-circle';
  }

  getMealCount(): number {
    if (!this.selectedSlot || !this.selectedDuration) return 0;
    const map: Record<string, number> = {
      'breakfast_only-weekly': 6, 'dinner_only-weekly': 6, 'both-weekly': 12,
      'breakfast_only-monthly': 24, 'dinner_only-monthly': 24, 'both-monthly': 48,
    };
    return map[`${this.selectedSlot}-${this.selectedDuration}`] || 0;
  }

  // ── Payment ───────────────────────────────────────────────────────────

  pay() {
    if (!this.isAllSelected() || !this.computedPrice || this.isPaymentLoading) return;

    this.isPaymentLoading = true;

    this.payment.initiatePayment(
      {
        tier_slug:    this.selectedTier.slug,
        diet_type:    this.selectedDiet!,
        slot_combo:   this.selectedSlot!,
        duration:     this.selectedDuration!,
        display_name: this.computedPrice.display_name,
        total:        this.computedPrice.total,
        promo_code:   this.promoApplied ? this.promoCode.trim().toUpperCase() : undefined,
      },
      this.currentUser?.full_name  || this.currentUser?.name || '',
      this.currentUser?.email      || '',
      this.currentUser?.phone      || '',
    ).subscribe({
      next: (sub) => {
        this.isPaymentLoading = false;
        this.msg.add({
          severity: 'success',
          summary: '🎉 Payment Successful!',
          detail: `${sub.tier_name} subscription starts ${sub.start_date}.`,
          life: 5000,
        });
        this.router.navigate(['/dashboard'], { queryParams: { payment_success: 'true' } });
      },
      error: (err) => {
        this.isPaymentLoading = false;
        if (err?.userCancelled) {
          this.msg.add({ severity: 'info', summary: 'Cancelled', detail: 'Payment was cancelled.', life: 3000 });
        } else {
          this.msg.add({
            severity: 'error',
            summary: 'Payment Failed',
            detail: err?.error?.detail || err?.message || 'Please try again.',
            life: 5000,
          });
        }
      },
    });
  }
}
