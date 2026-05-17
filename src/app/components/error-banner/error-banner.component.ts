import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ApiError {
  /** Machine-readable slug, e.g. 'supabase_quota_exceeded' */
  error_type: string;
  /** Human-readable message to display in the UI */
  message: string;
  /** Raw backend error string — shown in collapsed details for debugging */
  raw?: string;
}

export type ErrorSeverity = 'danger' | 'warning' | 'info';

/** Map error_type slugs to a severity level */
const SEVERITY_MAP: Record<string, ErrorSeverity> = {
  supabase_quota_exceeded:  'danger',
  supabase_unauthorized:    'danger',
  supabase_forbidden:       'danger',
  supabase_bucket_not_found:'danger',
  supabase_file_too_large:  'warning',
  supabase_network_error:   'warning',
  supabase_duplicate:       'info',
  supabase_error:           'danger',
  storage_not_configured:   'danger',
  invalid_file_type:        'warning',
  empty_file:               'warning',
};

const ICON_MAP: Record<ErrorSeverity, string> = {
  danger:  'pi pi-times-circle',
  warning: 'pi pi-exclamation-triangle',
  info:    'pi pi-info-circle',
};

@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible && error" class="error-banner" [class]="'banner-' + severity" role="alert">
      <div class="banner-icon-wrap">
        <i [class]="iconClass"></i>
      </div>
      <div class="banner-body">
        <div class="banner-message">{{ error.message }}</div>
        <details *ngIf="error.raw" class="banner-details">
          <summary>Technical details</summary>
          <code>{{ error.raw }}</code>
        </details>
      </div>
      <button class="banner-dismiss" (click)="dismiss()" aria-label="Dismiss error">
        <i class="pi pi-times"></i>
      </button>
    </div>
  `,
  styles: [`
    .error-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      padding: 0.9rem 1.1rem;
      border-radius: 10px;
      border: 1px solid transparent;
      margin-bottom: 1.25rem;
      animation: bannerIn 0.22s ease;
    }

    @keyframes bannerIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Severity colours ── */
    .banner-danger {
      background: #fff5f5;
      border-color: #fca5a5;
      color: #b91c1c;
    }
    .banner-warning {
      background: #fffbeb;
      border-color: #fcd34d;
      color: #92400e;
    }
    .banner-info {
      background: #eff6ff;
      border-color: #93c5fd;
      color: #1e40af;
    }

    .banner-icon-wrap {
      flex-shrink: 0;
      font-size: 1.2rem;
      margin-top: 1px;
    }

    .banner-body {
      flex: 1;
      min-width: 0;
    }

    .banner-message {
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.5;
    }

    .banner-details {
      margin-top: 0.5rem;
      font-size: 0.78rem;
    }

    .banner-details summary {
      cursor: pointer;
      opacity: 0.7;
      font-weight: 500;
      margin-bottom: 0.25rem;
    }

    .banner-details code {
      display: block;
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      background: rgba(0,0,0,0.06);
      padding: 0.35rem 0.6rem;
      border-radius: 4px;
      word-break: break-all;
      white-space: pre-wrap;
    }

    .banner-dismiss {
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.15rem 0.25rem;
      border-radius: 4px;
      opacity: 0.55;
      transition: opacity 0.15s;
      font-size: 0.85rem;
      color: inherit;
    }
    .banner-dismiss:hover { opacity: 1; }
  `]
})
export class ErrorBannerComponent implements OnChanges {
  @Input() error: ApiError | null = null;
  @Output() dismissed = new EventEmitter<void>();

  visible = true;
  severity: ErrorSeverity = 'danger';
  iconClass = ICON_MAP['danger'];

  ngOnChanges() {
    if (this.error) {
      this.visible = true;
      this.severity = SEVERITY_MAP[this.error.error_type] ?? 'danger';
      this.iconClass = ICON_MAP[this.severity];
    }
  }

  dismiss() {
    this.visible = false;
    this.dismissed.emit();
  }
}
