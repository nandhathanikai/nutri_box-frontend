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
import { StickyCtaComponent } from '../../components/sticky-cta/sticky-cta';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, SelectButtonModule, SkeletonModule, TabsModule, TooltipModule, ToastModule, StickyCtaComponent],
  providers: [MessageService],
  templateUrl: './plans.html',
  styleUrl: './plans.scss'
})
export class PlansComponent implements OnInit {
  apiUrl = `${environment.apiBaseUrl}/api/menu`;

  // ── Data ──────────────────────────────────────────────────────────────
  tiers: any[] = [];
  isLoading = true;

  // ── Selector State ────────────────────────────────────────────────────
  selectedTier: any = null;
  selectedDiet: string | null = null;
  selectedSlot: string | null = null;
  selectedDuration: string | null = null;

  // ── Computed / Payment ────────────────────────────────────────────────
  computedPrice: any = null;
  isComputingPrice = false;
  isPaymentLoading = false;   // covers: create-order + modal + verify

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
    this.selectedTier = tier;
    this.selectedDiet = null;
    this.selectedSlot = null;
    this.selectedDuration = null;
    this.computedPrice = null;
  }

  selectDiet(diet: string) {
    this.selectedDiet = diet;
    this.selectedSlot = null;
    this.selectedDuration = null;
    this.computedPrice = null;
  }

  selectSlot(slot: string) {
    this.selectedSlot = slot;
    this.selectedDuration = null;
    this.computedPrice = null;
  }

  selectDuration(duration: string) {
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
        this.router.navigate(['/dashboard']);
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
