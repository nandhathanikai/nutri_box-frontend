import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, TodaysOrderRow, TodaysOrdersResponse } from '../../../services/admin.service';

type OrdersTab = 'Orders' | 'Skipped';

@Component({
  selector: 'app-admin-todays-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-todays-orders.html',
  styleUrl: './admin-todays-orders.scss',
})
export class AdminTodaysOrdersComponent implements OnInit, OnDestroy {
  activeTab: OrdersTab = 'Orders';
  tabs: OrdersTab[] = ['Orders', 'Skipped'];

  searchQuery = '';
  loading = false;
  data: TodaysOrdersResponse | null = null;

  private refreshTimer: any = null;

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.load();
    // Refresh every 60 seconds so the admin sees skip changes without reloading.
    this.refreshTimer = setInterval(() => this.load(true), 60_000);
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  load(silent = false) {
    if (!silent) this.loading = true;
    this.adminService.getTodaysOrders().subscribe({
      next: (res) => { this.data = res; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  setTab(t: OrdersTab) { this.activeTab = t; }

  get displayDate(): string {
    if (!this.data?.date) return '';
    const d = new Date(this.data.date);
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  get rows(): TodaysOrderRow[] {
    if (!this.data) return [];
    const list = this.activeTab === 'Orders' ? this.data.orders : this.data.skipped;
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(r =>
      r.customer_name.toLowerCase().includes(q) ||
      (r.customer_email || '').toLowerCase().includes(q) ||
      (r.customer_phone || '').toLowerCase().includes(q) ||
      (r.tier_name || '').toLowerCase().includes(q) ||
      (r.session_label || '').toLowerCase().includes(q)
    );
  }

  get ordersCount(): number { return this.data?.orders.length ?? 0; }
  get skippedCount(): number { return this.data?.skipped.length ?? 0; }

  sessionBadgeClass(key: string): string {
    if (key === 'BF') return 'sess-bf';
    if (key === 'DINNER') return 'sess-dinner';
    return '';
  }

  dietBadgeClass(diet: string): string {
    const d = (diet || '').toLowerCase();
    if (d === 'veg') return 'diet-veg';
    if (d === 'nonveg' || d === 'non-veg') return 'diet-nonveg';
    return 'diet-both';
  }
}
