import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { BrandBarComponent } from '../../components/brand-bar/brand-bar';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, AvatarModule, ToastModule, DialogModule, BrandBarComponent],
  providers: [MessageService],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfileComponent implements OnInit {
  // Typed-confirmation state for the destructive delete flow.
  showDeleteDialog = false;
  deleteConfirmText = '';
  deleting = false;
  readonly DELETE_PHRASE = 'DELETE';
  get canConfirmDelete(): boolean { return this.deleteConfirmText.trim() === this.DELETE_PHRASE; }

  user = {
    name: '',
    phone: '',
    email: '',
    address_line_1: '',
    address_line_2: '',
    landmark: '',
    location_link: '',
  };

  loading = true;
  saving = false;
  error = '';

  constructor(private auth: AuthService, private msg: MessageService) {}

  get initials(): string {
    const parts = (this.user.name || '').trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '?';
    const first = parts[0][0].toUpperCase();
    const last  = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : '';
    return first + last;
  }

  ngOnInit() {
    this.auth.getCurrentUser().subscribe({
      next: (data: any) => {
        this.user.name           = data.full_name  ?? data.name  ?? '';
        this.user.email          = data.email ?? '';
        this.user.phone          = data.phone ?? data.phone_number ?? '';
        this.user.address_line_1 = data.address_line_1 ?? '';
        this.user.address_line_2 = data.address_line_2 ?? '';
        this.user.landmark       = data.landmark ?? '';
        this.user.location_link  = data.location_link ?? '';
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load profile. Please try again.';
        this.loading = false;
      }
    });
  }

  saveProfile() {
    if (this.saving) return;
    this.saving = true;
    this.auth.updateProfile({
      full_name: this.user.name,
      phone: this.user.phone,
      address_line_1: this.user.address_line_1,
      address_line_2: this.user.address_line_2,
      landmark: this.user.landmark,
      location_link: this.user.location_link,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Profile updated.' });
      },
      error: (err) => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to save profile.' });
      }
    });
  }

  fetchCurrentLocation() {
    if (!navigator.geolocation) {
      this.msg.add({ severity: 'error', summary: 'Not Supported', detail: 'Geolocation is not supported by your browser.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.user.location_link = `https://maps.google.com/?q=${lat},${lng}`;
        this.msg.add({ severity: 'success', summary: 'Location Fetched', detail: 'Google Maps link populated with your GPS coordinates.' });
      },
      () => {
        this.msg.add({ severity: 'error', summary: 'Permission Denied', detail: 'Could not fetch your location. Please check browser permissions.' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  openDeleteDialog() {
    this.deleteConfirmText = '';
    this.showDeleteDialog = true;
  }

  cancelDelete() {
    if (this.deleting) return;
    this.showDeleteDialog = false;
    this.deleteConfirmText = '';
  }

  confirmDelete() {
    if (!this.canConfirmDelete || this.deleting) return;
    this.deleting = true;
    this.auth.deleteAccount().subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteDialog = false;
        this.msg.add({ severity: 'success', summary: 'Account Deleted' });
        this.auth.logout();
      },
      error: (err) => {
        this.deleting = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to delete account.' });
      }
    });
  }

  logout() {
    this.auth.logout();
  }
}
