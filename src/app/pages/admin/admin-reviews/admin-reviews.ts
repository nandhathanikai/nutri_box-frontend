import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { environment } from '../../../../environments/environment';

interface Review {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_role: string;
  rating: number;
  text: string;
  status: string;
  created_at: string;
}

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ButtonModule, ToastModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-reviews.html',
  styleUrls: ['./admin-reviews.scss']
})
export class AdminReviewsComponent implements OnInit {
  private API = `${environment.apiBaseUrl}/api/reviews`;

  reviews: Review[] = [];
  isLoading = false;
  searchQuery = '';
  statusFilter: 'all' | 'approved' | 'pending' = 'all';

  constructor(
    private http: HttpClient,
    private msg: MessageService,
    private confirm: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.http.get<Review[]>(`${this.API}/admin`).subscribe({
      next: (data) => {
        this.reviews = data || [];
        this.isLoading = false;
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to load reviews' });
        this.isLoading = false;
      }
    });
  }

  get filteredReviews(): Review[] {
    let list = this.reviews;
    if (this.statusFilter === 'approved') {
      list = list.filter(r => r.status === 'approved');
    } else if (this.statusFilter === 'pending') {
      list = list.filter(r => r.status !== 'approved');
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(r => 
        r.customer_name.toLowerCase().includes(q) || 
        r.text.toLowerCase().includes(q)
      );
    }
    return list;
  }

  get totalCount(): number {
    return this.reviews.length;
  }

  get approvedCount(): number {
    return this.reviews.filter(r => r.status === 'approved').length;
  }

  get averageRating(): number {
    if (this.reviews.length === 0) return 0;
    const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / this.reviews.length) * 10) / 10;
  }

  toggleApproved(r: Review) {
    this.http.post<any>(`${this.API}/${r.id}/toggle-approved`, {}).subscribe({
      next: (res) => {
        r.status = res.status;
        this.msg.add({
          severity: 'success',
          summary: 'Status Updated',
          detail: `Review status changed to ${res.status}`
        });
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to toggle status' });
      }
    });
  }

  deleteReview(r: Review) {
    this.confirm.confirm({
      header: 'Delete Review',
      message: `Are you sure you want to permanently delete the review by ${r.customer_name}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      acceptButtonStyleClass: 'p-button-danger',
      rejectLabel: 'Cancel',
      accept: () => {
        this.http.delete(`${this.API}/${r.id}`).subscribe({
          next: () => {
            this.reviews = this.reviews.filter(x => x.id !== r.id);
            this.msg.add({ severity: 'success', summary: 'Deleted', detail: 'Review removed successfully.' });
          },
          error: () => {
            this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete review' });
          }
        });
      }
    });
  }
}
