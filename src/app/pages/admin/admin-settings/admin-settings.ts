import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

type SettingsTab = 'general' | 'notifications' | 'payment' | 'account';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, ReactiveFormsModule,
    ButtonModule, InputTextModule, InputGroupModule, InputGroupAddonModule, ToastModule
  ],
  providers: [MessageService],
  templateUrl: './admin-settings.html',
  styleUrls: ['./admin-settings.scss']
})
export class AdminSettingsComponent {
  activeTab: SettingsTab = 'general';
  isSaving = false;
  isLoading = false;

  // Contact info (synced with backend)
  contactForm: FormGroup;

  // Notification toggles
  notifs = {
    newOrder: true, creditEarned: true, paymentFail: true, newCustomer: false,
    custCreditEarned: true, deliveryReminder: true, orderSms: true, deliveryUpdates: true
  };

  // Payment
  payment = { gateway: 'Razorpay', apiKey: '', apiSecret: '', cod: true, upi: true, gstRate: 5, gstin: '' };
  paymentSecretSet = false;

  // Account
  pwdForm = { current: '', newPwd: '', confirm: '' };
  twoFa = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private msg: MessageService,
    private auth: AuthService,
  ) {
    this.contactForm = this.fb.group({
      business_name: ['Nutribox Kitchen'],
      email: ['support@nutribox.in', [Validators.email]],
      phone_number: ['+91 98765 43210'],
      city: ['Chennai'],
      address: ['123, Velachery Main Road, Chennai - 600042'],
      instagram_link: ['https://instagram.com/nutribox'],
      opens_at: ['08:00'],
      closes_at: ['22:00'],
    });
    this.loadSettings();
  }

  loadSettings() {
    this.http.get<any>(`${environment.apiBaseUrl}/api/settings/admin`).subscribe({
      next: (d) => {
        if (d) {
          this.contactForm.patchValue({
            business_name: d.business_name || '',
            phone_number: d.phone_number || '',
            email: d.email || '',
            address: d.address || '',
            city: d.city || '',
            instagram_link: d.instagram_link || '',
            opens_at: d.opens_at || '08:00',
            closes_at: d.closes_at || '22:00',
          });
          this.notifs = {
            newOrder: d.notif_new_order ?? true,
            creditEarned: d.notif_credit_earned ?? true,
            paymentFail: d.notif_payment_fail ?? true,
            newCustomer: d.notif_new_customer ?? false,
            custCreditEarned: d.notif_cust_credit ?? true,
            deliveryReminder: d.notif_cust_reminder ?? true,
            orderSms: d.notif_cust_order_sms ?? true,
            deliveryUpdates: d.notif_cust_delivery ?? true
          };
          this.payment = {
            gateway: d.payment_gateway || 'Razorpay',
            apiKey: d.payment_api_key || '',
            apiSecret: '', // Never round-tripped from server. Leave blank to keep existing.
            cod: d.payment_cod_enabled ?? true,
            upi: d.payment_upi_enabled ?? true,
            gstRate: d.gst_rate ?? 5,
            gstin: d.gstin || ''
          };
          this.paymentSecretSet = !!d.payment_api_secret_set;
        }
      },
      error: () => {}
    });
  }

  saveGeneral() {
    this.isSaving = true;
    const v = this.contactForm.value;
    this.http.put(`${environment.apiBaseUrl}/api/settings`, {
      business_name: v.business_name,
      address: v.address,
      phone_number: v.phone_number,
      email: v.email,
      city: v.city,
      instagram_link: v.instagram_link,
      opens_at: v.opens_at,
      closes_at: v.closes_at,
    }).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Settings updated successfully.' });
        this.isSaving = false;
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to save settings.' });
        this.isSaving = false;
      }
    });
  }

  saveNotifs() {
    this.http.put(`${environment.apiBaseUrl}/api/settings`, {
      notif_new_order: this.notifs.newOrder,
      notif_credit_earned: this.notifs.creditEarned,
      notif_payment_fail: this.notifs.paymentFail,
      notif_new_customer: this.notifs.newCustomer,
      notif_cust_credit: this.notifs.custCreditEarned,
      notif_cust_reminder: this.notifs.deliveryReminder,
      notif_cust_order_sms: this.notifs.orderSms,
      notif_cust_delivery: this.notifs.deliveryUpdates,
    }).subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Notification preferences saved.' }),
      error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to save notifications.' })
    });
  }

  savePayment() {
    const payload: any = {
      payment_gateway: this.payment.gateway,
      payment_api_key: this.payment.apiKey,
      payment_cod_enabled: this.payment.cod,
      payment_upi_enabled: this.payment.upi,
      gst_rate: this.payment.gstRate,
      gstin: this.payment.gstin,
    };
    // Only send the secret if the admin actually typed one — otherwise the
    // backend keeps the existing value. Blank input == "leave unchanged".
    if (this.payment.apiSecret) {
      payload.payment_api_secret = this.payment.apiSecret;
    }
    this.http.put(`${environment.apiBaseUrl}/api/settings`, payload).subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Payment settings saved.' }),
      error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to save payment settings.' })
    });
  }

  savePassword() {
    if (!this.pwdForm.current) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Enter your current password.' }); return; }
    if (this.pwdForm.newPwd !== this.pwdForm.confirm) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Passwords do not match.' }); return; }
    // Mirror backend: ≥8 chars, uppercase, lowercase, digit
    const pwd = this.pwdForm.newPwd;
    const strongPwd = pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);
    if (!strongPwd) {
      this.msg.add({ severity: 'error', summary: 'Weak Password', detail: 'Password must be at least 8 characters with an uppercase letter, lowercase letter, and a number.' });
      return;
    }

    this.auth.changePassword(this.pwdForm.current, this.pwdForm.newPwd).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Updated', detail: 'Password changed successfully.' });
        this.pwdForm = { current: '', newPwd: '', confirm: '' };
      },
      error: (err) => {
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.detail || 'Could not change password.',
        });
      }
    });
  }

  logout() {
    this.auth.logout();
  }

  confirmClearDashboard() {
    if (confirm("⚠️ WARNING: This will permanently delete all customer subscriptions, active orders, custom requests, delivery cancellations, and credits. This action is irreversible. Are you sure you want to reset the dashboard statistics?")) {
      this.clearDashboard();
    }
  }

  clearDashboard() {
    this.isLoading = true;
    this.http.post<any>(`${environment.apiBaseUrl}/api/settings/clear-dashboard`, {}).subscribe({
      next: (resp) => {
        this.msg.add({ severity: 'success', summary: 'Reset Complete', detail: resp.message || 'Dashboard statistics have been successfully reset.' });
        this.isLoading = false;
      },
      error: (err) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to reset dashboard statistics.' });
        this.isLoading = false;
      }
    });
  }
}
