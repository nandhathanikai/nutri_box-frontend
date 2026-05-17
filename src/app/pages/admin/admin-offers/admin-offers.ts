import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { environment } from '../../../../environments/environment';

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
  status: 'active' | 'draft' | 'expired';
}

@Component({
  selector: 'app-admin-offers',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ButtonModule, DialogModule, ToastModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-offers.html',
  styleUrls: ['./admin-offers.scss']
})
export class AdminOffersComponent implements OnInit {
  private API = `${environment.apiBaseUrl}/api/offers`;

  offerFilter: 'all' | 'active' | 'draft' | 'expired' = 'all';
  offerSearch = '';
  showNewOffer = false;
  isLoading = false;
  isSaving = false;

  today = new Date().toISOString().slice(0, 10);

  newForm: any = {
    code: '', description: '', type: 'pct', value: null, max_cap: null,
    min_order: null, usage_limit: null, valid_from: this.today, valid_until: ''
  };

  offers: Offer[] = [];

  constructor(
    private http: HttpClient,
    private msg: MessageService,
    private confirm: ConfirmationService,
  ) {}

  ngOnInit(): void { this.load(); }

  load() {
    this.isLoading = true;
    const params = this.offerFilter !== 'all' ? `?status=${this.offerFilter}` : '';
    this.http.get<Offer[]>(`${this.API}${params}`).subscribe({
      next: (data) => { this.offers = data; this.isLoading = false; },
      error: () => { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to load offers' }); this.isLoading = false; }
    });
  }

  get filtered(): Offer[] {
    if (!this.offerSearch) return this.offers;
    const q = this.offerSearch.toLowerCase();
    return this.offers.filter(o => o.code.toLowerCase().includes(q) || o.description.toLowerCase().includes(q));
  }

  get activeCount(): number { return this.offers.filter(o => o.status === 'active').length; }
  get expiringSoon(): number {
    const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    return this.offers.filter(o => o.status === 'active' && o.valid_until <= soon).length;
  }

  valueLabel(o: Offer): string {
    if (o.type === 'pct') return `${o.value}% OFF`;
    if (o.type === 'flat') return `₹${o.value} OFF`;
    return 'FREE DEL';
  }

  usagePct(o: Offer): number | null {
    if (!o.usage_limit) return null;
    return Math.round((o.used_count / o.usage_limit) * 100);
  }

  setFilter(f: 'all' | 'active' | 'draft' | 'expired') {
    this.offerFilter = f;
    this.load();
  }

  toggle(o: Offer) {
    const newStatus = o.status === 'active' ? 'draft' : 'active';
    this.http.patch(`${this.API}/${o.id}/status?status=${newStatus}`, {}).subscribe({
      next: () => { o.status = newStatus; },
      error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'Status update failed' })
    });
  }

  delete(o: Offer) {
    this.confirm.confirm({
      header: 'Delete offer?',
      message: `Offer "${o.code}" will be permanently removed.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      acceptButtonStyleClass: 'p-button-danger',
      rejectLabel: 'Cancel',
      accept: () => {
        this.http.delete(`${this.API}/${o.id}`).subscribe({
          next: () => {
            this.offers = this.offers.filter(x => x.id !== o.id);
            this.msg.add({ severity: 'success', summary: 'Deleted', detail: `${o.code} removed` });
          },
          error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'Delete failed' })
        });
      }
    });
  }

  create() {
    if (!this.newForm.code || !this.newForm.description || !this.newForm.valid_until) {
      this.msg.add({ severity: 'warn', summary: 'Required', detail: 'Code, description, and valid-until date are required.' });
      return;
    }
    this.isSaving = true;
    this.http.post<Offer>(this.API, this.newForm).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Created', detail: `Offer ${this.newForm.code.toUpperCase()} created!` });
        this.showNewOffer = false;
        this.newForm = { code: '', description: '', type: 'pct', value: null, max_cap: null, min_order: null, usage_limit: null, valid_from: this.today, valid_until: '' };
        this.isSaving = false;
        this.load();
      },
      error: (err) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to create offer' });
        this.isSaving = false;
      }
    });
  }
}
