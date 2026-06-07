import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CheckboxModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class SignupComponent {
  currentStep = 1;
  signupForm: FormGroup;
  isLoading = false;
  /** True when backend responds with "Email already registered" */
  emailExistsError = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService
  ) {
    this.signupForm = this.fb.group({
      fullName:        ['', [Validators.required]],
      email:           ['', [Validators.required, Validators.email]],
      phone:           ['', [Validators.required, Validators.pattern(/^[+\d][\d\s\-()]{6,}$/)]],
      // Matches backend: >=8 chars, uppercase, lowercase, digit.
      password:        ['', [Validators.required, Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/)]],
      confirmPassword: ['', [Validators.required]],
      addressLine1:    ['', [Validators.required]],
      addressLine2:    [''],
      landmark:        [''],
      locationLink:    [''],
    });

    // Clear the duplicate-email banner whenever the user edits the email field
    this.signupForm.get('email')!.valueChanges.subscribe(() => {
      this.emailExistsError = false;
    });
  }

  fetchCurrentLocation() {
    if (!navigator.geolocation) {
      this.messageService.add({ severity: 'error', summary: 'Not Supported', detail: 'Geolocation is not supported by your browser.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.signupForm.patchValue({
          locationLink: `https://maps.google.com/?q=${lat},${lng}`
        });
        this.messageService.add({ severity: 'success', summary: 'Location Fetched', detail: 'Google Maps link populated with your GPS coordinates.' });
      },
      (error) => {
        console.error('Error fetching location:', error);
        this.messageService.add({ severity: 'error', summary: 'Permission Denied', detail: 'Could not fetch your location. Please check browser permissions.' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  isCheckingEmail = false;

  get step1Valid(): boolean {
    const { fullName, email, phone, password, confirmPassword } = this.signupForm.controls;
    return fullName.valid && email.valid && phone.valid && password.valid && confirmPassword.valid
      && password.value === confirmPassword.value;
  }

  get step2Valid(): boolean {
    return this.signupForm.get('addressLine1')!.valid;
  }

  get passwordsMatch(): boolean {
    const pw = this.signupForm.get('password')!.value;
    const cpw = this.signupForm.get('confirmPassword')!.value;
    return !cpw || pw === cpw;
  }

  // Per-rule signals for inline UI hints. Kept verbose for clarity over cleverness.
  pwdHas(rule: 'len' | 'upper' | 'lower' | 'digit'): boolean {
    const v: string = this.signupForm.get('password')!.value || '';
    switch (rule) {
      case 'len':   return v.length >= 8;
      case 'upper': return /[A-Z]/.test(v);
      case 'lower': return /[a-z]/.test(v);
      case 'digit': return /\d/.test(v);
    }
  }

  goNext() {
    if (!this.step1Valid || this.isCheckingEmail) return;

    this.isCheckingEmail = true;
    this.emailExistsError = false;

    this.authService.checkEmail(this.signupForm.value.email).subscribe({
      next: () => {
        this.isCheckingEmail = false;
        this.currentStep = 2;
      },
      error: (err) => {
        this.isCheckingEmail = false;
        const detail: string = err.error?.detail ?? '';

        if (detail.toLowerCase().includes('already registered') || err.status === 400 || err.status === 409) {
          this.emailExistsError = true;
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Could not verify email. Please try again.'
          });
        }
      }
    });
  }

  goBack() {
    this.currentStep = 1;
  }

  onSubmit() {
    if (this.signupForm.invalid || !this.step1Valid || !this.step2Valid || this.isLoading) return;

    this.isLoading = true;
    this.emailExistsError = false;
    const formVals = this.signupForm.value;

    const signupPayload = {
      full_name:      formVals.fullName,
      email:          formVals.email,
      phone:          formVals.phone,
      password:       formVals.password,
      address_line_1: formVals.addressLine1,
      address_line_2: formVals.addressLine2,
      landmark:       formVals.landmark,
      location_link:  formVals.locationLink
    };

    this.authService.signup(signupPayload).subscribe({
      next: () => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Account created successfully!'
        });
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading = false;
        const detail: string = err.error?.detail ?? '';

        if (detail.toLowerCase().includes('already registered') || err.status === 409) {
          // Duplicate email — jump back to step 1 and show the inline banner
          this.currentStep = 1;
          this.emailExistsError = true;
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: detail || 'Registration failed. Please try again.'
          });
        }
      }
    });
  }
}
