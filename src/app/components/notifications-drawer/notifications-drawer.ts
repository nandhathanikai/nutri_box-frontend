import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DrawerModule } from 'primeng/drawer';
import { environment } from '../../../environments/environment';

interface Announcement {
  id: number;
  title: string;
  body: string;
  icon: string;
  audience: string;
  status: string;
  start_date: string;
  end_date: string;
}

interface Offer {
  id: number;
  code: string;
  description: string;
  type: 'pct' | 'flat' | 'free';
  value: number;
  max_cap: number | null;
  min_order: number;
  used_count: number;
  usage_limit: number | null;
  valid_from: string;
  valid_until: string;
  status: string;
}

type Tab = 'announcements' | 'offers';

@Component({
  selector: 'app-notifications-drawer',
  standalone: true,
  imports: [CommonModule, DrawerModule],
  templateUrl: './notifications-drawer.html',
  styleUrl: './notifications-drawer.scss'
})
export class NotificationsDrawerComponent implements OnChanges {
  @Input()  visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  activeTab: Tab = 'announcements';
  loading = false;
  announcements: Announcement[] = [];
  offers: Offer[] = [];

  constructor(private http: HttpClient) {}

  ngOnChanges(c: SimpleChanges) {
    // Refetch every time the drawer is opened so the customer always sees current state
    if (c['visible'] && c['visible'].currentValue === true) {
      this.refresh();
    }
  }

  setTab(t: Tab) { this.activeTab = t; }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  refresh() {
    this.loading = true;
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading = false; };

    this.http.get<Announcement[]>(`${environment.apiBaseUrl}/api/announcements?status=active`).subscribe({
      next: (data) => { this.announcements = data; done(); },
      error: () => { this.announcements = []; done(); }
    });

    this.http.get<Offer[]>(`${environment.apiBaseUrl}/api/offers?status=active`).subscribe({
      next: (data) => { this.offers = data; done(); },
      error: () => { this.offers = []; done(); }
    });
  }

  offerValueLabel(o: Offer): string {
    if (o.type === 'pct')  return `${o.value}% OFF`;
    if (o.type === 'flat') return `₹${o.value} OFF`;
    return 'FREE DELIVERY';
  }

  daysLeft(dateStr: string): number {
    const end = new Date(dateStr).getTime();
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.max(0, Math.ceil((end - today.getTime()) / 86400000));
  }

  copyCode(code: string) {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(code).catch(() => {});
  }
}
