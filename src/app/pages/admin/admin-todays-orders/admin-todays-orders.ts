import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeliveryService, DeliveryOrdersResponse, OrderRow, SessionGroup, DriverProfile } from '../../../services/delivery.service';

@Component({
  selector: 'app-admin-todays-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-todays-orders.html',
  styleUrl: './admin-todays-orders.scss',
})
export class AdminTodaysOrdersComponent implements OnInit, OnDestroy {
  data: DeliveryOrdersResponse | null = null;
  loading = false;
  searchQuery = '';
  activeView: 'orders' | 'skipped' = 'orders';

  // Per-session selection
  sessionSelections: Map<number, Set<number>> = new Map(); // session_id → Set<subscription_id>
  sessionSelectAll: Map<number, boolean> = new Map();

  // Assignment modal
  showAssignModal = false;
  assigningSessionId: number | null = null;
  assigningSessionName = '';
  drivers: DriverProfile[] = [];
  driversLoading = false;
  selectedDriverId: number | null = null;
  assignLoading = false;
  assignError = '';
  assignSuccess = '';

  private refreshTimer: any = null;

  constructor(private deliveryService: DeliveryService) {}

  ngOnInit() {
    this.load();
    this.refreshTimer = setInterval(() => this.load(true), 60_000);
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  load(silent = false) {
    if (!silent) this.loading = true;
    this.deliveryService.getDeliveryOrders().subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        // Initialize selection maps
        res.sessions.forEach(s => {
          if (!this.sessionSelections.has(s.session_id)) {
            this.sessionSelections.set(s.session_id, new Set());
          }
        });
      },
      error: () => { this.loading = false; },
    });
  }

  get displayDate(): string {
    if (!this.data?.date) return '';
    return new Date(this.data.date).toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  filteredOrders(session: SessionGroup): OrderRow[] {
    const list = this.activeView === 'orders' ? session.orders : session.skipped;
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(r =>
      r.customer_name.toLowerCase().includes(q) ||
      (r.customer_email || '').toLowerCase().includes(q) ||
      (r.customer_phone || '').toLowerCase().includes(q) ||
      (r.tier_name || '').toLowerCase().includes(q)
    );
  }

  totalOrders(): number {
    return this.data?.sessions.reduce((sum, s) => sum + s.orders.length, 0) ?? 0;
  }

  totalSkipped(): number {
    return this.data?.sessions.reduce((sum, s) => sum + s.skipped.length, 0) ?? 0;
  }

  // ── Selection logic ────────────────────────────────────────────────────────
  isSelected(sessionId: number, subscriptionId: number): boolean {
    return this.sessionSelections.get(sessionId)?.has(subscriptionId) ?? false;
  }

  toggleRow(sessionId: number, subscriptionId: number) {
    const sel = this.sessionSelections.get(sessionId) ?? new Set<number>();
    if (sel.has(subscriptionId)) sel.delete(subscriptionId);
    else sel.add(subscriptionId);
    this.sessionSelections.set(sessionId, sel);
    this.updateSelectAll(sessionId);
  }

  toggleSelectAll(session: SessionGroup) {
    const orders = this.filteredOrders(session).filter(o => o.assignment_status === 'unassigned');
    const sel = this.sessionSelections.get(session.session_id) ?? new Set<number>();
    const allSelected = orders.every(o => sel.has(o.subscription_id));
    if (allSelected) {
      orders.forEach(o => sel.delete(o.subscription_id));
    } else {
      orders.forEach(o => sel.add(o.subscription_id));
    }
    this.sessionSelections.set(session.session_id, sel);
    this.sessionSelectAll.set(session.session_id, !allSelected);
  }

  updateSelectAll(sessionId: number) {
    const session = this.data?.sessions.find(s => s.session_id === sessionId);
    if (!session) return;
    const orders = session.orders.filter(o => o.assignment_status === 'unassigned');
    const sel = this.sessionSelections.get(sessionId) ?? new Set<number>();
    this.sessionSelectAll.set(sessionId, orders.length > 0 && orders.every(o => sel.has(o.subscription_id)));
  }

  selectedCount(sessionId: number): number {
    return this.sessionSelections.get(sessionId)?.size ?? 0;
  }

  // ── Assignment modal ────────────────────────────────────────────────────────
  openAssignModal(session: SessionGroup) {
    if (this.selectedCount(session.session_id) === 0) return;
    this.assigningSessionId = session.session_id;
    this.assigningSessionName = session.session;
    this.selectedDriverId = null;
    this.assignError = '';
    this.assignSuccess = '';
    this.showAssignModal = true;
    this.driversLoading = true;
    this.deliveryService.getDrivers().subscribe({
      next: (d) => { this.drivers = d.filter(dr => dr.is_active); this.driversLoading = false; },
      error: () => { this.driversLoading = false; },
    });
  }

  closeAssignModal() {
    this.showAssignModal = false;
    this.assigningSessionId = null;
  }

  submitAssign() {
    if (!this.selectedDriverId || !this.assigningSessionId || this.assignLoading) return;
    const rawIds = Array.from(this.sessionSelections.get(this.assigningSessionId) ?? []);
    if (rawIds.length === 0) return;

    this.assignLoading = true;
    this.assignError = '';

    // Convert IDs to strings — backend AssignPayload expects str fields
    const selectedDriver = this.drivers.find(d => d.id === this.selectedDriverId);
    this.deliveryService.assignOrders({
      driver_id: String(this.selectedDriverId),
      session_id: String(this.assigningSessionId),
      subscription_ids: rawIds.map(id => String(id)),
    } as any).subscribe({
      next: (res) => {
        this.assignLoading = false;
        this.assignSuccess = `✓ Assigned ${res.assigned} order(s) to ${res.driver_name}.`;

        // Optimistic: mark the rows as assigned right now
        const session = this.data?.sessions.find(s => s.session_id === this.assigningSessionId);
        if (session && selectedDriver) {
          session.orders.forEach(row => {
            if (rawIds.includes(+row.subscription_id) && row.assignment_status === 'unassigned') {
              row.assignment_status = 'assigned';
              row.driver_name = selectedDriver.full_name;
              row.driver_id = selectedDriver.id;
            }
          });
        }
        // Clear selections for this session
        this.sessionSelections.set(this.assigningSessionId!, new Set());
        setTimeout(() => {
          this.showAssignModal = false;
          this.load(true); // silent background refresh
        }, 1200);
      },
      error: (err) => {
        this.assignLoading = false;
        this.assignError = err.error?.detail || 'Failed to assign orders.';
      },
    });
  }

  // ── Badge helpers ───────────────────────────────────────────────────────────
  statusBadgeClass(status: string): string {
    switch (status) {
      case 'assigned': return 'badge-assigned';
      case 'on_the_way': return 'badge-on-way';
      case 'delivered': return 'badge-delivered';
      default: return 'badge-unassigned';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'assigned': return 'Assigned';
      case 'on_the_way': return 'On the Way';
      case 'delivered': return 'Delivered';
      default: return 'Unassigned';
    }
  }

  dietBadgeClass(diet: string): string {
    const d = (diet || '').toLowerCase();
    if (d === 'veg') return 'diet-veg';
    if (d === 'nonveg' || d === 'non-veg') return 'diet-nonveg';
    return 'diet-both';
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
