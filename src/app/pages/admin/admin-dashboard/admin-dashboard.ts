import { Component, AfterViewInit, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, DashboardStats } from '../../../services/admin.service';

declare const Chart: any;

interface StatCard {
  icon: string;
  value: string | number;
  label: string;
  change: string;
  positive: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('revenueChart') revenueChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cancellationsChart') cancellationsChartRef!: ElementRef<HTMLCanvasElement>;

  stats: StatCard[] = [];
  chartData: DashboardStats | null = null;
  loadError = false;
  isLoading = true;
  dbStatusData: any = null;
  showDbPopover = false;
  private revenueChartInstance: any = null;
  private cancellationsChartInstance: any = null;

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.isLoading = true;
    this.loadError = false;
    this.adminService.getDashboardStats().subscribe({
      next: (data) => {
        this.chartData = data;
        this.dbStatusData = data.dbStatus || null;
        this.stats = [
          { icon: 'pi pi-users', value: data.activeCustomers, label: 'Active Customers', change: '+0%', positive: true },
          { icon: 'pi pi-indian-rupee', value: data.monthlyRevenue, label: 'Monthly Revenue', change: '+0%', positive: true },
          { icon: 'pi pi-times-circle', value: data.cancellations, label: 'Cancellations', change: '-0%', positive: true },
          { icon: 'pi pi-tag', value: data.activeOffers, label: 'Active Offers', change: '0', positive: true },
        ];
        this.isLoading = false;
        this.updateCharts();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = true;
      },
    });
  }

  ngAfterViewInit() {
    this.loadChartJs().then(() => this.updateCharts());
  }

  private updateCharts() {
    if (!this.chartData || typeof Chart === 'undefined') return;
    
    if (this.revenueChartRef) {
      if (this.revenueChartInstance) this.revenueChartInstance.destroy();
      this.revenueChartInstance = this.renderRevenueChart(this.chartData);
    }
    
    if (this.cancellationsChartRef) {
      if (this.cancellationsChartInstance) this.cancellationsChartInstance.destroy();
      this.cancellationsChartInstance = this.renderCancellationsChart(this.chartData);
    }
  }

  private loadChartJs(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof Chart !== 'undefined') { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private renderRevenueChart(data: DashboardStats) {
    const ctx = this.revenueChartRef.nativeElement.getContext('2d')!;
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.revenueTrend.labels,
        datasets: [{
          label: 'Revenue (₹)',
          data: data.revenueTrend.data,
          borderColor: '#2E7D32',
          backgroundColor: 'rgba(46,125,50,0.08)',
          pointBackgroundColor: '#2E7D32',
          pointRadius: 5,
          tension: 0.35,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: '#e5e7eb' }, ticks: { color: '#6b7280' } },
          x: { grid: { display: false }, ticks: { color: '#6b7280' } }
        }
      }
    });
  }

  private renderCancellationsChart(data: DashboardStats) {
    const ctx = this.cancellationsChartRef.nativeElement.getContext('2d')!;
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.cancellationsBySession.labels,
        datasets: [{
          label: 'Cancellations',
          data: data.cancellationsBySession.data,
          backgroundColor: '#E65100',
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: '#e5e7eb' }, ticks: { color: '#6b7280' }, beginAtZero: true },
          x: { grid: { display: false }, ticks: { color: '#6b7280' } }
        }
      }
    });
  }
}
