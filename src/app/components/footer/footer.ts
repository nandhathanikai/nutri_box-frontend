import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.html',
  styleUrls: ['./footer.scss']
})
export class FooterComponent implements OnInit {
  settings: any = null;
  currentYear = new Date().getFullYear();
  openSection: number | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get(`${environment.apiBaseUrl}/api/settings`).subscribe({
      next: (data) => { this.settings = data; },
      error: () => { /* footer renders fine with defaults */ },
    });
  }

  toggleSection(index: number) {
    this.openSection = this.openSection === index ? null : index;
  }

  /** wa.me requires a digits-only phone number, no '+' or spaces. */
  get whatsappLink(): string | null {
    const phone = this.settings?.phone_number;
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  }
}
