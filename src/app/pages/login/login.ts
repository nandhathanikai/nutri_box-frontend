import { Component, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    DividerModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  loginForm: FormGroup;
  resetForm: FormGroup;
  isLoading = false;

  mode: 'login' | 'reset' = 'login';
  resetStep: 'otp' | 'password' = 'otp';
  otpRequested = false;
  otpVerified = false;
  resetEmail = '';
  otpDigits: string[] = ['', '', '', '', '', ''];

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.resetForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  get isEmailValid(): boolean {
    const c = this.loginForm.get('email');
    return !!c && c.valid;
  }

  get isOtpComplete(): boolean {
    return this.otpDigits.every(d => d && d.trim() !== '');
  }

  trackByIndex(index: number): number {
    return index;
  }

  onForgotPassword() {
    if (!this.isEmailValid || this.otpRequested || this.isLoading) return;

    this.otpRequested = true;
    this.isLoading = true;
    const email = this.loginForm.value.email;

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.isLoading = false;
        this.resetEmail = email;
        this.mode = 'reset';
        this.resetStep = 'otp';
        this.otpVerified = false;
        this.messageService.add({
          severity: 'success',
          summary: 'OTP Sent',
          detail: `An OTP has been sent to ${email}. Please check your spam folder if you don't see it.`
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.otpRequested = false;
        const errorMsg = err.error?.detail || 'Could not send OTP. Please try again.';
        this.messageService.add({ severity: 'error', summary: 'Request Failed', detail: errorMsg });
      }
    });
  }

  verifyOtp() {
    if (!this.isOtpComplete || this.isLoading) return;

    this.isLoading = true;
    const otp = this.otpDigits.join('');

    this.authService.verifyOtp(this.resetEmail, otp).subscribe({
      next: () => {
        this.isLoading = false;
        this.otpVerified = true;
        this.resetStep = 'password';
        this.messageService.add({
          severity: 'success',
          summary: 'OTP Verified',
          detail: 'Please choose a new password.'
        });
      },
      error: (err) => {
        this.isLoading = false;
        const errorMsg = err.error?.detail || 'Invalid OTP. Please try again.';
        this.messageService.add({ severity: 'error', summary: 'Verification Failed', detail: errorMsg });
      }
    });
  }

  onOtpInput(index: number, event: any) {
    const value = event.target.value;
    if (value && index < 5) {
      this.otpInputs.toArray()[index + 1].nativeElement.focus();
    }
  }

  onOtpKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      this.otpInputs.toArray()[index - 1].nativeElement.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text');
    if (!pastedData) return;
    const digits = pastedData.replace(/\D/g, '').substring(0, 6).split('');
    for (let i = 0; i < digits.length; i++) {
      this.otpDigits[i] = digits[i];
    }
    const focusIndex = Math.min(digits.length, 5);
    setTimeout(() => this.otpInputs.toArray()[focusIndex].nativeElement.focus());
  }

  resetPassword() {
    if (this.resetForm.invalid || !this.otpVerified || this.isLoading) return;

    this.isLoading = true;
    const otp = this.otpDigits.join('');
    const newPassword = this.resetForm.value.newPassword;

    this.authService.resetPassword(this.resetEmail, otp, newPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Password Reset',
          detail: 'Your password has been reset. Please log in.'
        });
        this.resetToLoginView();
      },
      error: (err) => {
        this.isLoading = false;
        const errorMsg = err.error?.detail || 'Invalid OTP. Please try again.';
        this.messageService.add({ severity: 'error', summary: 'Reset Failed', detail: errorMsg });
      }
    });
  }

  private resetToLoginView() {
    this.mode = 'login';
    this.resetStep = 'otp';
    this.otpRequested = false;
    this.otpVerified = false;
    this.resetEmail = '';
    this.otpDigits = ['', '', '', '', '', ''];
    this.resetForm.reset();
    this.loginForm.reset();
  }

  onSubmit() {
    if (this.loginForm.invalid || this.isLoading) return;

    this.isLoading = true;
    const credentials = this.loginForm.value;

    this.authService.login(credentials).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.messageService.add({ severity: 'success', summary: 'Welcome back', detail: 'Successfully logged in!' });

        this.authService.getCurrentUser().subscribe({
          next: (user) => {
            const dest = (user.role && user.role.toLowerCase() === 'admin') ? '/admin' : '/dashboard';
            this.router.navigate([dest]);
          },
          error: () => this.router.navigate(['/dashboard'])
        });
      },
      error: (err) => {
        this.isLoading = false;
        const errorMsg = err.error?.detail || 'Incorrect email or password.';
        this.messageService.add({ severity: 'error', summary: 'Sign In Failed', detail: errorMsg });
      }
    });
  }
}

