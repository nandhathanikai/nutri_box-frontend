import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DeliveryService, DriverProfile } from '../../../services/delivery.service';

@Component({
  selector: 'app-admin-delivery-partners',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-delivery-partners.html',
  styleUrl: './admin-delivery-partners.scss',
})
export class AdminDeliveryPartnersComponent implements OnInit {
  drivers: DriverProfile[] = [];
  loading = false;
  searchQuery = '';

  // Create modal
  showCreateModal = false;
  createForm: FormGroup;
  createLoading = false;
  createError = '';
  showPassword = false;

  // Edit modal
  showEditModal = false;
  editForm: FormGroup;
  editLoading = false;
  editError = '';
  editingDriver: DriverProfile | null = null;

  // Delete modal
  showConfirmDeleteModal = false;
  deletingDriver: DriverProfile | null = null;
  deleteError = '';

  constructor(private deliveryService: DeliveryService, private fb: FormBuilder) {
    this.createForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s]{7,15}$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      is_active: [true],
    });

    this.editForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required]],
      is_active: [true],
    });
  }

  ngOnInit() {
    this.load();
  }

  load(silent = false) {
    if (!silent) this.loading = true;
    this.deliveryService.getDrivers(this.searchQuery || undefined).subscribe({
      next: (data) => { this.drivers = data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  onSearch() {
    this.load();
  }

  clearSearch() {
    this.searchQuery = '';
    this.load();
  }

  // ── Create ─────────────────────────────────────────────────
  openCreate() {
    this.createForm.reset({ is_active: true });
    this.createError = '';
    this.showPassword = false;
    this.showCreateModal = true;
  }

  closeCreate() {
    this.showCreateModal = false;
  }

  submitCreate() {
    if (this.createForm.invalid || this.createLoading) return;
    this.createLoading = true;
    this.createError = '';
    const formVal = this.createForm.value;
    this.deliveryService.createDriver(formVal).subscribe({
      next: (newDriver) => {
        this.createLoading = false;
        this.showCreateModal = false;
        // Optimistic: add locally immediately, refresh in background
        const optimistic: DriverProfile = {
          id: newDriver.id,
          full_name: formVal.full_name,
          email: formVal.email,
          phone: formVal.phone,
          is_active: formVal.is_active ?? true,
          created_at: new Date().toISOString(),
          today_assignments: 0,
          online_status: 'offline',
        };
        this.drivers = [optimistic, ...this.drivers];
        this.load(true); // silent background refresh
      },
      error: (err) => {
        this.createLoading = false;
        this.createError = err.error?.detail || 'Failed to create driver. Please try again.';
      },
    });
  }

  // ── Edit ───────────────────────────────────────────────────
  openEdit(driver: DriverProfile) {
    this.editingDriver = driver;
    this.editForm.patchValue({
      full_name: driver.full_name,
      phone: driver.phone,
      is_active: driver.is_active,
    });
    this.editError = '';
    this.showEditModal = true;
  }

  closeEdit() {
    this.showEditModal = false;
    this.editingDriver = null;
  }

  submitEdit() {
    if (this.editForm.invalid || this.editLoading || !this.editingDriver) return;
    this.editLoading = true;
    this.editError = '';
    const formVal = this.editForm.value;
    const targetId = this.editingDriver.id;
    this.deliveryService.updateDriver(targetId, formVal).subscribe({
      next: () => {
        this.editLoading = false;
        this.showEditModal = false;
        // Optimistic: update in-place immediately
        const idx = this.drivers.findIndex(d => d.id === targetId);
        if (idx !== -1) {
          this.drivers[idx] = { ...this.drivers[idx], ...formVal };
        }
        this.editingDriver = null;
        this.load(true); // silent background refresh
      },
      error: (err) => {
        this.editLoading = false;
        this.editError = err.error?.detail || 'Failed to update driver.';
      },
    });
  }

  // ── Toggle Active ──────────────────────────────────────────
  toggleActive(driver: DriverProfile) {
    const prev = driver.is_active;
    driver.is_active = !prev; // optimistic flip immediately
    this.deliveryService.toggleDriverActive(driver.id).subscribe({
      next: (res) => { driver.is_active = res.is_active; },
      error: () => { driver.is_active = prev; }, // revert on error
    });
  }

  statusClass(driver: DriverProfile): string {
    return driver.is_active ? 'status-active' : 'status-inactive';
  }

  statusLabel(driver: DriverProfile): string {
    return driver.is_active ? 'Active' : 'Inactive';
  }

  deleteDriver(driver: DriverProfile) {
    this.deletingDriver = driver;
    this.deleteError = '';
    this.showConfirmDeleteModal = true;
  }

  closeConfirmDelete() {
    this.showConfirmDeleteModal = false;
    this.deletingDriver = null;
    this.deleteError = '';
  }

  submitDelete() {
    if (!this.deletingDriver || this.loading) return;
    const targetId = this.deletingDriver.id;
    this.loading = true;
    this.deleteError = '';
    this.deliveryService.deleteDriver(targetId).subscribe({
      next: () => {
        this.loading = false;
        this.drivers = this.drivers.filter(d => d.id !== targetId);
        this.closeConfirmDelete();
      },
      error: (err) => {
        this.loading = false;
        this.deleteError = err.error?.detail || 'Failed to delete driver partner.';
      }
    });
  }
}
