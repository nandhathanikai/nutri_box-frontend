import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-credits',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './credits.component.html',
  styleUrls: ['./credits.component.scss']
})
export class CreditsComponent implements OnInit {
  balance: any = null;
  credits: any[] = [];
  loading: boolean = true;
  loadError: string | null = null;

  private sessionLabels: Record<string, string> = {
    BF: 'Breakfast',
    LUNCH: 'Lunch',
    DINNER: 'Dinner',
    SNACK: 'Snack',
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchCredits();
  }

  fetchCredits() {
    this.loading = true;
    this.loadError = null;
    this.http.get<any>(`${environment.apiBaseUrl}/api/credits/me`).subscribe({
      next: (res) => {
        this.balance = res.balance;
        this.credits = res.credits;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = 'We couldn\'t load your credits right now.';
      }
    });
  }

  sessionLabel(session: string): string {
    return this.sessionLabels[session?.toUpperCase()] || session || 'Unknown';
  }
}
