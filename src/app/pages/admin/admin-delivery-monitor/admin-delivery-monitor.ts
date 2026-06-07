import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeliveryService, MonitorRow } from '../../../services/delivery.service';

@Component({
  selector: 'app-admin-delivery-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-delivery-monitor.html',
  styleUrl: './admin-delivery-monitor.scss',
})
export class AdminDeliveryMonitorComponent implements OnInit, OnDestroy {
  rows: MonitorRow[] = [];
  searchQuery = '';
  loading = false;
  lastRefreshed: Date | null = null;
  private refreshTimer: any = null;

  constructor(private deliveryService: DeliveryService) {}

  ngOnInit() {
    this.load();
    this.refreshTimer = setInterval(() => this.load(true), 10_000);
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  load(silent = false) {
    if (!silent) this.loading = true;
    this.deliveryService.getMonitor().subscribe({
      next: (data) => {
        this.rows = data;
        this.loading = false;
        this.lastRefreshed = new Date();
      },
      error: () => { this.loading = false; },
    });
  }

  get activeDrivers(): number {
    return this.rows.filter(r => r.online_status === 'on_delivery').length;
  }

  get availableDrivers(): number {
    return this.rows.filter(r => r.online_status === 'available').length;
  }

  get filteredRows(): MonitorRow[] {
    if (!this.searchQuery) return this.rows;
    const q = this.searchQuery.trim().toLowerCase();
    return this.rows.filter(r =>
      r.driver_name.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q)
    );
  }

  statusClass(row: MonitorRow): string {
    if (!row.is_active) return 'status-inactive';
    switch (row.online_status) {
      case 'on_delivery': return 'status-on-delivery';
      case 'available': return 'status-available';
      default: return 'status-offline';
    }
  }

  statusLabel(row: MonitorRow): string {
    if (!row.is_active) return 'Inactive';
    switch (row.online_status) {
      case 'on_delivery': return 'On Delivery';
      case 'available': return 'Available';
      default: return 'Offline';
    }
  }

  timeSince(iso: string | null): string {
    if (!iso) return 'Never';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  openMapLink(row: MonitorRow): string | null {
    if (!row.last_latitude || !row.last_longitude) return null;
    return `https://www.google.com/maps/search/?api=1&query=${row.last_latitude},${row.last_longitude}`;
  }
}
