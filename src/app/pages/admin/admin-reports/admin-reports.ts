import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AdminService, ReportStats } from '../../../services/admin.service';

type Period = 'week' | 'month' | 'quarter';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ButtonModule],
  templateUrl: './admin-reports.html',
  styleUrls: ['./admin-reports.scss']
})
export class AdminReportsComponent implements OnInit {
  period: Period = 'week';
  isLoading = false;

  stats: ReportStats = {
    revenue: '₹0',
    totalOrders: 0,
    newCustomers: 0,
    aov: '₹0',
    chartData: { labels: [], values: [] },
    topItems: [],
    segments: []
  };

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadData();
  }

  setPeriod(p: Period) {
    this.period = p;
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.adminService.getReports(this.period).subscribe({
      next: (data) => {
        this.stats = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  get data() { return this.stats.chartData; }

  get maxVal(): number { 
    if (!this.data.values || this.data.values.length === 0) return 1;
    return Math.max(...this.data.values); 
  }

  barHeight(v: number): number { 
    if (this.maxVal === 0) return 16;
    return Math.round((v / this.maxVal) * 120) + 16; 
  }

  fmtK(v: number): string { 
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return v.toString();
  }
}

