import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-brand-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './brand-bar.html',
  styleUrls: ['./brand-bar.scss']
})
export class BrandBarComponent implements OnInit {
  businessName = 'Nutribox';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/api/settings`).subscribe({
      next: (s) => { if (s?.business_name) this.businessName = s.business_name; },
      error: () => {}
    });
  }
}
