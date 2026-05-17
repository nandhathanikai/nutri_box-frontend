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

interface Announcement {
  id: number;
  title: string;
  body: string;
  icon: string;
  audience: string;
  status: 'active' | 'draft' | 'expired';
  start_date: string;
  end_date: string;
  opens: number;
}

@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ButtonModule, DialogModule, ToastModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-announcements.html',
  styleUrls: ['./admin-announcements.scss']
})
export class AdminAnnouncementsComponent implements OnInit {
  private API = `${environment.apiBaseUrl}/api/announcements`;

  annFilter: 'all' | 'active' | 'draft' | 'expired' = 'all';
  showNewAnn = false;
  isLoading = false;
  isSaving = false;

  today = new Date().toISOString().slice(0, 10);

  newForm = {
    title: '',
    body: '',
    icon: '📢',
    audience: 'All Customers',
    status: 'active' as 'active' | 'draft',
    start_date: this.today,
    end_date: ''
  };

  announcements: Announcement[] = [];

  constructor(
    private http: HttpClient,
    private msg: MessageService,
    private confirm: ConfirmationService,
  ) {}

  ngOnInit(): void { this.load(); }

  load() {
    this.isLoading = true;
    const params = this.annFilter !== 'all' ? `?status=${this.annFilter}` : '';
    this.http.get<Announcement[]>(`${this.API}${params}`).subscribe({
      next: (data) => { this.announcements = data; this.isLoading = false; },
      error: () => { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to load announcements' }); this.isLoading = false; }
    });
  }

  get totalSent(): number { return this.announcements.filter(a => a.status !== 'draft').length; }
  get activeCount(): number { return this.announcements.filter(a => a.status === 'active').length; }

  setFilter(f: 'all' | 'active' | 'draft' | 'expired') {
    this.annFilter = f;
    this.load();
  }

  publish() {
    if (!this.newForm.title || !this.newForm.body || !this.newForm.end_date) {
      this.msg.add({ severity: 'warn', summary: 'Required', detail: 'Please fill title, message, and end date.' });
      return;
    }
    this.isSaving = true;
    this.http.post<Announcement>(this.API, this.newForm).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Done', detail: 'Announcement published!' });
        this.showNewAnn = false;
        this.newForm = { title: '', body: '', icon: '📢', audience: 'All Customers', status: 'active', start_date: this.today, end_date: '' };
        this.isSaving = false;
        this.load();
      },
      error: (err) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to create' });
        this.isSaving = false;
      }
    });
  }

  setStatus(a: Announcement, status: 'active' | 'draft' | 'expired') {
    this.http.patch(`${this.API}/${a.id}/status?status=${status}`, {}).subscribe({
      next: () => { a.status = status; },
      error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'Status update failed' })
    });
  }

  delete(a: Announcement) {
    this.confirm.confirm({
      header: 'Delete announcement?',
      message: `"${a.title}" will be permanently removed.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      acceptButtonStyleClass: 'p-button-danger',
      rejectLabel: 'Cancel',
      accept: () => {
        this.http.delete(`${this.API}/${a.id}`).subscribe({
          next: () => {
            this.announcements = this.announcements.filter(x => x.id !== a.id);
            this.msg.add({ severity: 'success', summary: 'Deleted', detail: 'Announcement removed' });
          },
          error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'Delete failed' })
        });
      }
    });
  }
}
