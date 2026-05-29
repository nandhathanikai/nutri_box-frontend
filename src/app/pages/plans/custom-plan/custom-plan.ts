import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

declare const Razorpay: any;

@Component({
  selector: 'app-custom-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SelectModule, TextareaModule, ToastModule, SkeletonModule],
  providers: [MessageService],
  templateUrl: './custom-plan.html',
  styleUrl: './custom-plan.scss'
})
export class CustomPlanComponent implements OnInit, OnDestroy {
  apiUrl = `${environment.apiBaseUrl}/api`;

  tiers: any[] = [];
  currentUser: any = null;

  // ── Form State ────────────────────────────────────────────────────────
  selectedTierId: string | null = null;
  selectedDiet: string | null = null;
  selectedSlot: string | null = null;
  selectedDuration: string | null = null;
  customRequirements: string = '';

  isSubmitting = false;
  submitted = false;

  // ── My Requests ───────────────────────────────────────────────────────
  myRequests: any[] = [];
  isLoadingRequests = false;
  payingRequestId: string | null = null;

  // ── Auto-refresh ──────────────────────────────────────────────────────
  private pollInterval: any = null;
  private razorpayScriptLoaded = false;

  // ── Options ───────────────────────────────────────────────────────────
  dietOptions = [
    { label: '🌿 Veg', value: 'veg' },
    { label: '🍖 Non-Veg', value: 'nonveg' },
    { label: '🌿🍖 Both', value: 'both' }
  ];

  slotOptions = [
    { label: '🌅 Breakfast Only', value: 'breakfast_only' },
    { label: '🌙 Dinner Only', value: 'dinner_only' },
    { label: '🍽️ Both Slots', value: 'both' }
  ];

  constructor(
    private http: HttpClient,
    private msg: MessageService,
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    // Load tiers for the optional base-tier dropdown
    this.http.get<any[]>(`${this.apiUrl}/menu/tiers`).subscribe({
      next: (data) => {
        this.tiers = data.filter(t => t.is_active).map(t => ({
          label: t.name,
          value: t.id
        }));
      }
    });

    // Get current user for Razorpay prefill
    this.auth.getCurrentUser().subscribe({
      next: (u: any) => this.currentUser = u,
      error: () => {}
    });

    // Load my requests
    this.loadMyRequests();

    // Poll every 30 seconds for status updates (admin pricing)
    this.pollInterval = setInterval(() => {
      this.loadMyRequests(true);  // silent = true: no loading spinner
    }, 30000);

    // Preload Razorpay script
    this.loadRazorpayScript();
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  // ── Form Submission ───────────────────────────────────────────────────

  submitRequest() {
    if (!this.selectedDiet || !this.selectedSlot || !this.selectedDuration || !this.customRequirements.trim()) {
      this.msg.add({
        severity: 'error',
        summary: 'Required Fields',
        detail: 'Please fill in Diet Type, Meal Slots, Duration, and Your Requirements.',
        life: 4000,
      });
      return;
    }

    this.isSubmitting = true;
    const payload = {
      base_tier_id: this.selectedTierId || null,
      diet_type: this.selectedDiet,
      slot_combo: this.selectedSlot,
      duration: this.selectedDuration,
      custom_requirements: this.customRequirements.trim()
    };

    this.http.post(`${this.apiUrl}/custom-requests`, payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.submitted = true;
        this.resetForm();
        this.loadMyRequests();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.msg.add({
          severity: 'error',
          summary: 'Submission Failed',
          detail: err.error?.detail || 'Could not submit request. Please try again.',
          life: 5000,
        });
      }
    });
  }

  startNewRequest() {
    this.submitted = false;
    this.resetForm();
  }

  private resetForm() {
    this.selectedTierId = null;
    this.selectedDiet = null;
    this.selectedSlot = null;
    this.selectedDuration = null;
    this.customRequirements = '';
  }

  // ── My Requests ───────────────────────────────────────────────────────

  loadMyRequests(silent = false) {
    if (!silent) this.isLoadingRequests = true;
    this.http.get<any[]>(`${this.apiUrl}/custom-requests/my-requests`).subscribe({
      next: (data) => {
        this.myRequests = data;
        this.isLoadingRequests = false;
      },
      error: () => {
        this.isLoadingRequests = false;
      }
    });
  }

  // ── Payment for Custom Plan ───────────────────────────────────────────

  payForRequest(req: any) {
    if (this.payingRequestId) return;  // prevent double-tap
    this.payingRequestId = req.id;

    this.loadRazorpayScript().then(() => {
      // Step 1: Create Razorpay order
      this.http.post<any>(`${this.apiUrl}/custom-requests/${req.id}/pay-order`, {}).subscribe({
        next: (order) => {
          // Step 2: Open Razorpay modal
          const options = {
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: 'Nutribox',
            description: order.plan_name,
            order_id: order.order_id,
            prefill: {
              name: this.currentUser?.full_name || this.currentUser?.name || '',
              email: this.currentUser?.email || '',
              contact: this.currentUser?.phone || '',
            },
            theme: { color: '#4caf8b' },
            modal: {
              ondismiss: () => {
                this.payingRequestId = null;
                this.msg.add({
                  severity: 'info',
                  summary: 'Payment Cancelled',
                  detail: 'You can pay anytime from your My Requests list.',
                  life: 3000,
                });
              }
            },
            handler: (response: any) => {
              // Step 3: Verify payment on backend
              this.http.post<any>(`${this.apiUrl}/custom-requests/${req.id}/verify-payment`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }).subscribe({
                next: () => {
                  this.payingRequestId = null;
                  this.msg.add({
                    severity: 'success',
                    summary: '🎉 Payment Successful!',
                    detail: 'Your custom plan subscription is now active. Check your dashboard!',
                    life: 6000,
                  });
                  this.loadMyRequests();
                  // Navigate to dashboard after a short delay
                  setTimeout(() => this.router.navigate(['/dashboard']), 3000);
                },
                error: (err) => {
                  this.payingRequestId = null;
                  this.msg.add({
                    severity: 'error',
                    summary: 'Verification Failed',
                    detail: err?.error?.detail || 'Payment was captured but verification failed. Please contact support.',
                    life: 8000,
                  });
                }
              });
            }
          };

          const rzp = new Razorpay(options);
          rzp.on('payment.failed', (resp: any) => {
            this.payingRequestId = null;
            this.msg.add({
              severity: 'error',
              summary: 'Payment Failed',
              detail: resp?.error?.description || 'Payment failed. Please try again.',
              life: 5000,
            });
          });
          rzp.open();
        },
        error: (err) => {
          this.payingRequestId = null;
          this.msg.add({
            severity: 'error',
            summary: 'Could Not Initiate Payment',
            detail: err?.error?.detail || 'Please try again or contact support.',
            life: 5000,
          });
        }
      });
    });
  }

  private loadRazorpayScript(): Promise<void> {
    if (this.razorpayScriptLoaded || (typeof Razorpay !== 'undefined')) {
      this.razorpayScriptLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => { this.razorpayScriptLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.head.appendChild(script);
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────

  goBack() {
    this.router.navigate(['/plans']);
  }

  // ── Display Helpers ───────────────────────────────────────────────────

  getDietLabel(value: string): string {
    const map: Record<string, string> = { veg: '🌿 Veg', nonveg: '🍖 Non-Veg', both: '🌿🍖 Both' };
    return map[value] ?? value;
  }

  getSlotLabel(value: string): string {
    const map: Record<string, string> = {
      breakfast_only: '🌅 Breakfast',
      dinner_only: '🌙 Dinner',
      both: '🍽️ Both Slots'
    };
    return map[value] ?? value;
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pending Review',
      priced: 'Quote Ready',
      accepted: 'Accepted',
      rejected: 'Not Accepted',
      paid: 'Paid & Active',
    };
    return map[status] ?? status;
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      pending: 'pi-hourglass',
      priced: 'pi-tag',
      accepted: 'pi-check',
      rejected: 'pi-times',
      paid: 'pi-check-circle',
    };
    return map[status] ?? 'pi-circle';
  }
}
