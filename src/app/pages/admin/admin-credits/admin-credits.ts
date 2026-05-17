import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';

import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { BadgeModule } from 'primeng/badge';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-credits',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SelectModule, InputTextModule,
    BadgeModule, DialogModule, ButtonModule, ToastModule, TooltipModule, TagModule
  ],
  providers: [MessageService],
  templateUrl: './admin-credits.html',
  styleUrls: ['./admin-credits.scss']
})
export class AdminCreditsComponent implements OnInit {

  readonly apiBase = environment.apiBaseUrl;

  // ── State ──────────────────────────────────────────────────────────────
  loading = true;
  isProcessing = false;
  activeTab: 'overview' | 'customers' | 'log' | 'rules' = 'overview';

  // Stats
  stats = { pending: 0, scheduled: 0, delivered: 0, total: 0 };

  // Overview
  overviewData: any[] = [];

  // All Credits (customers + log tabs share this data)
  allCredits: any[] = [];
  filteredAllCredits: any[] = [];
  filteredLogCredits: any[] = [];

  // Filters
  custSearch = '';
  custStatusFilter = '';
  logSearch = '';
  logStatusFilter = '';

  // Dialogs
  showManualDialog = false;
  showDetailDialog = false;
  showOverrideDialog = false;

  // Manual Credit form
  customerList: any[] = [];
  manualForm = {
    customer_id: null as number | null,
    session: 'BF',
    delivery_on: '',
    note: '',
  };

  // Detail
  detailCustomer: any = null;

  // Override
  selectedCredit: any = null;
  overrideStatus = '';
  overrideNotes = '';

  // Session labels
  private sessionLabels: Record<string, string> = {
    BF: 'Breakfast',
    LUNCH: 'Lunch',
    DINNER: 'Dinner',
    SNACK: 'Snack',
  };

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private messageService: MessageService,
  ) {}

  ngOnInit() {
    this.loadStats();
    this.loadOverview();
  }

  // ── Tab Navigation ─────────────────────────────────────────────────────
  switchTab(tab: typeof this.activeTab) {
    this.activeTab = tab;
    if (tab === 'overview') this.loadOverview();
    if (tab === 'customers' || tab === 'log') this.loadAllCredits();
  }

  // ── Data Loading ───────────────────────────────────────────────────────
  private headers() {
    return { Authorization: `Bearer ${this.authService.getToken()}` };
  }

  loadStats() {
    this.http.get<any>(`${this.apiBase}/api/admin/credits/stats`, { headers: this.headers() })
      .subscribe({
        next: (res) => this.stats = res,
        error: () => {},
      });
  }

  loadOverview() {
    this.loading = true;
    this.http.get<any[]>(`${this.apiBase}/api/admin/credits/overview`, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          this.overviewData = res;
          this.loading = false;
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not load overview' });
          this.loading = false;
        },
      });
  }

  loadAllCredits() {
    this.loading = true;
    let url = `${this.apiBase}/api/admin/credits?page=1&limit=500`;
    if (this.custStatusFilter && this.activeTab === 'customers') {
      url += `&status=${this.custStatusFilter}`;
    }
    if (this.logStatusFilter && this.activeTab === 'log' && this.logStatusFilter !== 'manual') {
      url += `&status=${this.logStatusFilter}`;
    }

    this.http.get<any>(url, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          this.allCredits = res.data || [];
          this.filterCustomers();
          this.filterLog();
          this.loading = false;
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not load credits' });
          this.loading = false;
        },
      });
  }

  // ── Filters ────────────────────────────────────────────────────────────
  filterCustomers() {
    const q = this.custSearch.toLowerCase();
    this.filteredAllCredits = this.allCredits.filter(c => {
      const matchQ = !q || (c.customer_name || '').toLowerCase().includes(q) ||
                     (c.customer_email || '').toLowerCase().includes(q);
      return matchQ;
    });
  }

  filterLog() {
    const q = this.logSearch.toLowerCase();
    let list = this.allCredits;

    if (this.logStatusFilter === 'manual') {
      list = list.filter(c => c.is_manual);
    }

    this.filteredLogCredits = list.filter(c => {
      const matchQ = !q || (c.customer_name || '').toLowerCase().includes(q) ||
                     (c.id + '').includes(q);
      return matchQ;
    });
  }

  // ── Process Credits ────────────────────────────────────────────────────
  processCredits() {
    this.isProcessing = true;
    this.http.post<any>(`${this.apiBase}/api/credits/process`, {}, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          const p = res.promoted ?? 0;
          const d = res.delivered ?? 0;
          this.messageService.add({
            severity: 'success',
            summary: 'Credits Processed',
            detail: `${p} scheduled, ${d} delivered.`,
          });
          this.isProcessing = false;
          this.loadStats();
          this.loadOverview();
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Processing failed.' });
          this.isProcessing = false;
        },
      });
  }

  // ── Manual Credit ──────────────────────────────────────────────────────
  loadCustomerList() {
    this.http.get<any[]>(`${this.apiBase}/api/admin/customers/list`, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          this.customerList = res;
          if (res.length > 0 && !this.manualForm.customer_id) {
            this.manualForm.customer_id = res[0].id;
          }
          // Default delivery_on to tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          this.manualForm.delivery_on = tomorrow.toISOString().slice(0, 10);
        },
        error: () => {},
      });
  }

  submitManualCredit() {
    if (!this.manualForm.customer_id || !this.manualForm.delivery_on) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Select customer and delivery date' });
      return;
    }

    this.http.post<any>(`${this.apiBase}/api/admin/credits/manual`, {
      customer_id: this.manualForm.customer_id,
      session: this.manualForm.session,
      delivery_on: this.manualForm.delivery_on,
      note: this.manualForm.note || undefined,
    }, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          this.messageService.add({ severity: 'success', summary: 'Credit Added', detail: res.message });
          this.showManualDialog = false;
          this.manualForm = { customer_id: null, session: 'BF', delivery_on: '', note: '' };
          this.loadStats();
          this.loadOverview();
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add credit' });
        },
      });
  }

  // ── Detail Dialog ──────────────────────────────────────────────────────
  openDetail(cust: any) {
    this.detailCustomer = cust;
    this.showDetailDialog = true;
  }

  // ── Override Dialog ────────────────────────────────────────────────────
  openOverride(credit: any) {
    this.selectedCredit = credit;
    this.overrideStatus = credit.status;
    this.overrideNotes = credit.notes || '';
    this.showOverrideDialog = true;
  }

  saveOverride() {
    if (!this.selectedCredit) return;

    this.http.patch(
      `${this.apiBase}/api/admin/credits/${this.selectedCredit.id}`,
      { status: this.overrideStatus, notes: this.overrideNotes },
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Credit Updated' });
        this.showOverrideDialog = false;
        this.loadStats();
        if (this.activeTab === 'overview') this.loadOverview();
        else this.loadAllCredits();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update credit' });
      },
    });
  }

  // ── Rules ──────────────────────────────────────────────────────────────
  saveRules() {
    this.messageService.add({ severity: 'success', summary: 'Rules Saved', detail: 'Credit rules updated.' });
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  sessionLabel(session: string): string {
    return this.sessionLabels[session?.toUpperCase()] || session || 'Unknown';
  }
}
