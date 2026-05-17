import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Subscription {
  id: number;
  plan_id?: string | null;
  plan_name?: string | null;
  tier_name?: string | null;
  diet_type?: string | null;
  slot_combo?: string | null;
  duration?: string | null;
  meal_count?: number | null;
  price_per_meal?: number | null;
  total_price?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  status: 'active' | 'expiring' | 'expired';
}

export interface SubscribePayload {
  plan_id?: string;
  tier_slug?: string;
  diet_type?: string;
  slot_combo?: string;
  duration?: string;
  start_date?: string;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private apiUrl = `${environment.apiBaseUrl}/api/subscriptions`;

  constructor(private http: HttpClient) {}

  getMySubscription(): Observable<Subscription | null> {
    return this.http.get<Subscription | null>(`${this.apiUrl}/me`);
  }

  getMyHistory(): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${this.apiUrl}/me/all`);
  }

  subscribe(payload: SubscribePayload): Observable<Subscription> {
    return this.http.post<Subscription>(this.apiUrl, payload);
  }

  cancel(subId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${subId}`);
  }

  /**
   * Skip a single delivery (the customer earns 1 credit if before the 6 PM cutoff).
   * deliveryDate format: 'YYYY-MM-DD'
   */
  skipDelivery(deliveryDate: string, session: string, reason?: string): Observable<{
    eligible: boolean;
    message: string;
    credit_id: number | null;
  }> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/api/deliveries/${deliveryDate}/cancel`,
      { session, reason }
    );
  }

  /** Undo a previously-recorded skip. Allowed only before the 6 PM previous-day cutoff. */
  unskipDelivery(deliveryDate: string, session: string): Observable<{ message: string }> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/api/deliveries/${deliveryDate}/uncancel`,
      { session }
    );
  }

  getCalendar(): Observable<CalendarResponse> {
    return this.http.get<CalendarResponse>(`${this.apiUrl}/me/calendar`);
  }
}

export type SessionStatus = 'delivered' | 'today' | 'scheduled' | 'skipped' | 'no_delivery';

export interface CalendarSession {
  key: 'BF' | 'DINNER' | string;
  label: string;
  status: SessionStatus;
  cancellable: boolean;
  undoable: boolean;
  cancellation_id: number | null;
  cutoff_at: string;
}

export interface CalendarDay {
  date: string;        // YYYY-MM-DD
  weekday: string;     // 'Mon' .. 'Sun'
  is_weekend: boolean;
  is_today: boolean;
  is_past: boolean;
  sessions: CalendarSession[];
}

export interface CalendarResponse {
  subscription: {
    id: number;
    tier_name: string | null;
    duration: 'weekly' | 'monthly' | null;
    slot_combo: string | null;
    diet_type: string | null;
    start_date: string | null;
    end_date: string | null;
  } | null;
  days: CalendarDay[];
}
