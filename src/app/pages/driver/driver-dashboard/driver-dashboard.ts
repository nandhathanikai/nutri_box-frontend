import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DeliveryService, DriverDeliveriesResponse, DeliveryItem } from '../../../services/delivery.service';

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver-dashboard.html',
  styleUrl: './driver-dashboard.scss',
})
export class DriverDashboardComponent implements OnInit, OnDestroy {
  data: DriverDeliveriesResponse | null = null;
  loading = false;
  actionLoading: number | null = null; // assignment_id being actioned
  lastActionTime: { [key: number]: number } = {};

  private refreshTimer: any = null;

  constructor(private deliveryService: DeliveryService, private router: Router) {}

  ngOnInit() {
    this.load();
    this.refreshTimer = setInterval(() => this.load(true), 30_000);
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  load(silent = false) {
    if (!silent) this.loading = true;
    this.deliveryService.getMyDeliveries().subscribe({
      next: (res) => { this.data = res; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get displayDate(): string {
    if (!this.data?.date) return '';
    return new Date(this.data.date).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  get totalDeliveries(): number {
    return this.data?.sessions.reduce((s, sess) => s + sess.deliveries.length, 0) ?? 0;
  }

  get deliveredCount(): number {
    return this.data?.sessions.reduce((s, sess) =>
      s + sess.deliveries.filter(d => d.status === 'delivered').length, 0) ?? 0;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  openRoute(item: DeliveryItem) {
    this.router.navigate(['/driver/route', item.assignment_id]);
  }

  startDelivery(item: DeliveryItem) {
    if (this.actionLoading) return;
    this.actionLoading = item.assignment_id;
    this.deliveryService.startDelivery(item.assignment_id).subscribe({
      next: () => {
        item.status = 'on_the_way';
        this.actionLoading = null;
        this.lastActionTime[item.assignment_id] = Date.now();
        // Start GPS tracking
        this.deliveryService.startGpsTracking(item.assignment_id);
      },
      error: () => { this.actionLoading = null; },
    });
  }

  markDelivered(item: DeliveryItem) {
    if (this.actionLoading) return;
    
    // Cooldown of 1.5 seconds to prevent ghost clicks/accidental double-taps on mobile
    const lastAction = this.lastActionTime[item.assignment_id];
    if (lastAction && (Date.now() - lastAction < 1500)) {
      console.warn('Ignoring rapid click on markDelivered');
      return;
    }

    const confirmDelivered = window.confirm(`Are you sure you have delivered this order to ${item.customer_name}?`);
    if (!confirmDelivered) return;

    this.actionLoading = item.assignment_id;
    this.deliveryService.markDelivered(item.assignment_id).subscribe({
      next: () => {
        item.status = 'delivered';
        item.delivered_at = new Date().toISOString();
        this.actionLoading = null;
        this.deliveryService.stopGpsTracking();
      },
      error: () => { this.actionLoading = null; },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  statusClass(status: string): string {
    switch (status) {
      case 'on_the_way': return 'status-on-way';
      case 'delivered': return 'status-delivered';
      default: return 'status-assigned';
    }
  }

  tierClass(slug: string): string {
    const s = (slug || '').toLowerCase();
    if (s.includes('premium') || s.includes('gold')) return 'tier-premium';
    if (s.includes('standard') || s.includes('silver')) return 'tier-standard';
    return 'tier-basic';
  }

  sessionIcon(slug: string): string {
    switch (slug) {
      case 'breakfast': return 'pi-sun';
      case 'lunch': return 'pi-cloud-sun';
      case 'dinner': return 'pi-moon';
      case 'snack': return 'pi-star';
      default: return 'pi-clock';
    }
  }
}
