import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface CreateOrderResponse {
  order_id:  string;
  amount:    number;   // paise
  currency:  string;
  key_id:    string;
  plan_name: string;
  total:     number;   // INR
}

export interface VerifyRequest {
  razorpay_order_id:   string;
  razorpay_payment_id: string;
  razorpay_signature:  string;
  tier_slug:  string;
  diet_type:  string;
  slot_combo: string;
  duration:   string;
}

declare const Razorpay: any;

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly baseUrl = `${environment.apiBaseUrl}/api/payments`;
  private scriptLoaded = false;

  constructor(private http: HttpClient) {}

  /** Dynamically load Razorpay Checkout JS (once). */
  private loadScript(): Promise<void> {
    if (this.scriptLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => { this.scriptLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('Failed to load Razorpay script'));
      document.head.appendChild(script);
    });
  }

  /**
   * Full payment flow:
   * 1. Create Razorpay order on backend
   * 2. Open Razorpay Checkout modal
   * 3. On success, verify signature on backend and activate subscription
   *
   * Returns an Observable of the created Subscription (from /api/payments/verify).
   */
  initiatePayment(plan: {
    tier_slug:  string;
    diet_type:  string;
    slot_combo: string;
    duration:   string;
    display_name?: string;
    total?: number;
  }, userName: string, userEmail: string, userPhone: string): Observable<any> {

    return from(this.loadScript()).pipe(
      switchMap(() =>
        this.http.post<CreateOrderResponse>(`${this.baseUrl}/create-order`, {
          tier_slug:  plan.tier_slug,
          diet_type:  plan.diet_type,
          slot_combo: plan.slot_combo,
          duration:   plan.duration,
        })
      ),
      switchMap((order) =>
        new Observable<any>((observer) => {
          const options = {
            key:          order.key_id,
            amount:       order.amount,
            currency:     order.currency,
            name:         'Nutribox',
            description:  order.plan_name,
            order_id:     order.order_id,
            prefill: {
              name:    userName,
              email:   userEmail,
              contact: userPhone,
            },
            theme: { color: '#4caf8b' },
            modal: {
              ondismiss: () => {
                observer.error({ userCancelled: true, message: 'Payment cancelled.' });
              },
            },
            handler: (response: any) => {
              // Verify on backend — only this creates the subscription
              this.http.post<any>(`${this.baseUrl}/verify`, {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                tier_slug:  plan.tier_slug,
                diet_type:  plan.diet_type,
                slot_combo: plan.slot_combo,
                duration:   plan.duration,
              } as VerifyRequest).subscribe({
                next: (sub) => { observer.next(sub); observer.complete(); },
                error: (err) => observer.error(err),
              });
            },
          };

          const rzp = new Razorpay(options);
          rzp.on('payment.failed', (resp: any) => {
            observer.error({
              message: resp.error?.description || 'Payment failed.',
              razorpayError: resp.error,
            });
          });
          rzp.open();
        })
      )
    );
  }
}
