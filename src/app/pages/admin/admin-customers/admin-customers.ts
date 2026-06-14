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
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
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
    CheckboxModule, DatePickerModule,
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
  deletingId: any = null;
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
  planOptions: any[] = [];

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
      add_subscription:        [false],
      plan_id:                 [''],
      subscription_start_date: [new Date()],
      customization_details:   [''],
    }, { validators: this.customerLocationValidator });

    this.addForm.get('add_subscription')?.valueChanges.subscribe(val => {
      const planControl = this.addForm.get('plan_id');
      const startControl = this.addForm.get('subscription_start_date');
      const customControl = this.addForm.get('customization_details');
      if (val) {
        planControl?.setValidators([Validators.required]);
        startControl?.setValidators([Validators.required]);
        if (planControl?.value === 'customize') {
          customControl?.setValidators([Validators.required]);
        } else {
          customControl?.clearValidators();
        }
      } else {
        planControl?.clearValidators();
        startControl?.clearValidators();
        customControl?.clearValidators();
      }
      planControl?.updateValueAndValidity();
      startControl?.updateValueAndValidity();
      customControl?.updateValueAndValidity();
    });

    this.addForm.get('plan_id')?.valueChanges.subscribe(planId => {
      const customControl = this.addForm.get('customization_details');
      const addSubscription = this.addForm.get('add_subscription')?.value;
      if (addSubscription && planId === 'customize') {
        customControl?.setValidators([Validators.required]);
      } else {
        customControl?.clearValidators();
      }
      customControl?.updateValueAndValidity();
    });
  }

  customerLocationValidator = (group: any) => {
    const role = group.get('role')?.value;
    if (role === 'customer') {
      const landmark = group.get('landmark')?.value || '';
      const locationLink = group.get('location_link')?.value || '';
      if (!landmark.toString().trim() && !locationLink.toString().trim()) {
        return { locationRequired: true };
      }
    }
    return null;
  };

  ngOnInit() {
    this.load();
    this.loadPlans();
    // Debounce keystrokes so we don't hammer the API on every keypress.
    this.searchInput$.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.load();
    });
  }

  loadPlans() {
    this.adminService.getPlanCombinations().subscribe({
      next: (plans) => {
        const formattedPlans = plans.filter(p => p.is_active).map(p => ({
          id: p.id,
          display_name: `${p.display_name} (₹${p.total_price})`
        }));
        this.planOptions = [
          ...formattedPlans,
          { id: 'customize', display_name: 'Customize Plan / Order' }
        ];
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not load plan combinations.' });
      }
    });
  }

  formatDate(d: Date | string | null | undefined): string | null {
    if (!d) return null;
    if (typeof d === 'string') return d;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
    this.addForm.reset({ role: 'customer', add_subscription: false, subscription_start_date: new Date() });
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
    const formVal = this.addForm.value;
    const payload: any = {
      full_name: formVal.full_name,
      email: formVal.email,
      phone: formVal.phone,
      password: formVal.password,
      role: formVal.role,
      address_line_1: formVal.address_line_1,
      address_line_2: formVal.address_line_2,
      landmark: formVal.landmark,
      location_link: formVal.location_link,
    };
    if (formVal.add_subscription) {
      payload.plan_id = formVal.plan_id;
      payload.subscription_start_date = this.formatDate(formVal.subscription_start_date);
      if (formVal.plan_id === 'customize') {
        payload.customization_details = formVal.customization_details;
      }
    }
    this.adminService.addCustomer(payload).subscribe({
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

  changeRole(c: Customer, event: Event) {
    const selectEl = event.target as HTMLSelectElement;
    const newRole = selectEl.value as 'customer' | 'admin';

    this.adminService.changeCustomerRole(c.id, newRole).subscribe({
      next: () => {
        c.role = newRole;
        this.msg.add({
          severity: 'success',
          summary: 'Role Updated',
          detail: `${c.name}'s role changed to ${newRole.toUpperCase()}.`
        });
      },
      error: (err) => {
        // Revert select input value on error
        selectEl.value = c.role;
        this.msg.add({
          severity: 'error',
          summary: 'Could not change role',
          detail: err.error?.detail || 'An error occurred.'
        });
      }
    });
  }
}
