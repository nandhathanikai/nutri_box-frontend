import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, DialogModule, InputNumberModule, TagModule, ToastModule],
  providers: [MessageService],
  templateUrl: './admin-requests.html',
  styleUrl: './admin-requests.scss'
})
export class AdminRequestsComponent implements OnInit {
  apiUrl = `${environment.apiBaseUrl}/api/custom-requests`;
  requests: any[] = [];
  searchQuery = '';
  isLoading = false;

  get filteredRequests(): any[] {
    if (!this.searchQuery) return this.requests;
    const q = this.searchQuery.trim().toLowerCase();
    return this.requests.filter(r =>
      (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
      (r.customer_email && r.customer_email.toLowerCase().includes(q)) ||
      (r.diet_type && r.diet_type.toLowerCase().includes(q)) ||
      (r.custom_requirements && r.custom_requirements.toLowerCase().includes(q))
    );
  }

  displayPriceDialog = false;
  selectedRequest: any = null;
  pricePerMeal: number = 0;
  deliveryCharge: number = 0;

  constructor(private http: HttpClient, private msg: MessageService) {}

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.isLoading = true;
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.requests = data;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  openPriceDialog(req: any) {
    this.selectedRequest = req;
    this.pricePerMeal = 0;
    this.deliveryCharge = 0;
    this.displayPriceDialog = true;
  }

  submitPrice() {
    if (this.pricePerMeal <= 0) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Price per meal must be > 0' });
      return;
    }

    const payload = {
      price_per_meal: this.pricePerMeal,
      delivery_charge: this.deliveryCharge
    };

    this.http.patch(`${this.apiUrl}/${this.selectedRequest.id}/price`, payload).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Success', detail: 'Price set successfully!' });
        this.displayPriceDialog = false;
        this.loadRequests();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to set price' });
      }
    });
  }

  updateStatus(req: any, status: string) {
    this.http.patch(`${this.apiUrl}/${req.id}/status`, { status }).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Success', detail: `Request ${status}` });
        this.loadRequests();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to update status' });
      }
    });
  }

  getStatusSeverity(status: string) {
    switch (status) {
      case 'pending': return 'warn';
      case 'priced': return 'info';
      case 'accepted': return 'success';
      case 'rejected': return 'danger';
      case 'paid': return 'success';
      default: return 'info';
    }
  }

  getInitials(name: string): string {
    if (!name) return 'N/A';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'badge-pending';
      case 'priced': return 'badge-draft';
      case 'accepted':
      case 'paid': return 'badge-active';
      case 'rejected': return 'badge-expired';
      default: return 'badge-expired';
    }
  }
}
