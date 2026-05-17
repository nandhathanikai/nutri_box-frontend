import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AdminService, Customer } from '../../../services/admin.service';
import { PaginatorModule } from 'primeng/paginator';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

type FilterTab = 'All' | 'Active' | 'Expiring Soon' | 'Expired';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    ToastModule, ConfirmDialogModule, DialogModule, ButtonModule,
    InputTextModule, PasswordModule, SelectModule, PaginatorModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-customers.html',
  styleUrl: './admin-customers.scss'
})
export class AdminCustomersComponent implements OnInit {
  searchQuery = '';
  activeTab: FilterTab = 'All';
  tabs: FilterTab[] = ['All', 'Active', 'Expiring Soon', 'Expired'];

  customers: Customer[] = [];
  deletingId: number | null = null;
  isLoading = false;

  // Server-side pagination
  page = 1;
  pageSize = 50;
  total = 0;
  private searchInput$ = new Subject<string>();

  // Add User dialog
  showAddDialog = false;
  isCreating = false;
  addForm!: FormGroup;
  roleOptions = [
    { label: 'Customer', value: 'customer' },
    { label: 'Admin',    value: 'admin' },
  ];

  constructor(
    private adminService: AdminService,
    private msg: MessageService,
    private confirm: ConfirmationService,
    private fb: FormBuilder,
  ) {
    this.addForm = this.fb.group({
      full_name:      ['', [Validators.required]],
      email:          ['', [Validators.required, Validators.email]],
      phone:          ['', [Validators.required]],
      password:       ['', [Validators.required, Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/)]],
      role:           ['customer', [Validators.required]],
      address_line_1: [''],
      address_line_2: [''],
      landmark:       [''],
      location_link:  [''],
    });
  }

  ngOnInit() {
    this.load();
    // Debounce keystrokes so we don't hammer the API on every keypress.
    this.searchInput$.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.load();
    });
  }

  load() {
    this.isLoading = true;
    this.adminService.getCustomers({
      page: this.page,
      limit: this.pageSize,
      search: this.searchQuery,
    }).subscribe({
      next: (res) => {
        this.customers = res.data;
        this.total = res.total;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not load customers.' });
      }
    });
  }

  onSearchChange() { this.searchInput$.next(this.searchQuery); }

  onPageChange(e: { first?: number; rows?: number; page?: number }) {
    this.page = (e.page ?? 0) + 1;
    this.pageSize = e.rows ?? this.pageSize;
    this.load();
  }

  /** Tab filter is applied client-side on the current page. For full-DB tab
   *  filtering we'd add a status param to the API. */
  get filtered(): Customer[] {
    let list = this.customers;
    if (this.activeTab === 'Active') list = list.filter(c => c.status === 'ACTIVE');
    else if (this.activeTab === 'Expiring Soon') list = list.filter(c => c.status === 'EXPIRING');
    else if (this.activeTab === 'Expired') list = list.filter(c => c.status === 'EXPIRED');
    return list;
  }

  setTab(tab: FilterTab) { this.activeTab = tab; }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'badge-active';
      case 'EXPIRING': return 'badge-expiring';
      case 'EXPIRED': return 'badge-expired';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    return status === 'EXPIRING' ? 'EXPIRING SOON' : status;
  }

  // ── Add User ────────────────────────────────────────────────────────────

  openAddDialog() {
    this.addForm.reset({ role: 'customer' });
    this.showAddDialog = true;
  }

  closeAddDialog() {
    this.showAddDialog = false;
  }

  submitAddUser() {
    if (this.addForm.invalid || this.isCreating) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.isCreating = true;
    this.adminService.addCustomer(this.addForm.value).subscribe({
      next: (res) => {
        this.isCreating = false;
        this.msg.add({
          severity: 'success',
          summary: `${res.role === 'admin' ? 'Admin' : 'Customer'} created`,
          detail: `${res.full_name} (${res.email}) added.`,
        });
        this.closeAddDialog();
        this.load();
      },
      error: (err) => {
        this.isCreating = false;
        this.msg.add({
          severity: 'error',
          summary: 'Could not create user',
          detail: err.error?.detail || 'Please try again.',
        });
      }
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  deleteCustomer(c: Customer) {
    this.confirm.confirm({
      message: `Delete ${c.name}? This permanently removes the account, cancellations, and credit history. Subscriptions are kept for revenue records.`,
      header: 'Delete customer',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.deletingId = c.id;
        this.adminService.deleteCustomer(c.id).subscribe({
          next: () => {
            this.deletingId = null;
            this.customers = this.customers.filter(x => x.id !== c.id);
            this.msg.add({ severity: 'success', summary: 'Deleted', detail: `${c.name} removed.` });
          },
          error: (err) => {
            this.deletingId = null;
            this.msg.add({
              severity: 'error',
              summary: 'Could not delete',
              detail: err.error?.detail || 'Please try again.',
            });
          }
        });
      }
    });
  }
}
