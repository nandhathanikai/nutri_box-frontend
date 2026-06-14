import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DashboardStats {
  activeCustomers: number;
  monthlyRevenue: string;
  cancellations: number;
  activeOffers: number;
  revenueTrend: {
    labels: string[];
    data: number[];
  };
  cancellationsBySession: {
    labels: string[];
    data: number[];
  };
  dbStatus?: {
    database_type: string;
    size_mb: number;
    size_limit_mb: number;
    size_percentage: number;
    size_limit_reached: boolean;
    size_error: string | null;
    connections: number;
    connection_limit: number;
    connection_percentage: number;
    connection_limit_reached: boolean;
    connection_error: string | null;
    any_limit_reached: boolean;
  };
}

export interface Customer {
  id: any;
  email: string;
  name: string;
  phone: string;
  plan: string;
  sessions: string;
  startDate: string;
  endDate: string;
  credits: number;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
  role: 'customer' | 'admin';
}

export interface Menu {
  id?: number;
  menu_name: string;
  weekly_price?: number;
  monthly_price?: number;
  weekly_delivery_charge?: number;
  monthly_delivery_charge?: number;
  description?: string;
  menu_image?: string;
}

export interface Tier {
  id: string;
  name: string;
  price_per_meal: number;
}

export interface AdminUserPayload {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  address_line_1?: string;
  address_line_2?: string;
  landmark?: string;
  location_link?: string;
  role: 'customer' | 'admin';
  plan_id?: string;
  subscription_start_date?: string;
  customization_details?: string;
}

export interface DishPayload {
  name: string;
  tier_id: string;
  meal_slot: string;
  diet_type: string;
  description?: string;
  calories?: number;
  image_url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiBaseUrl}/api/admin`;
  private menuApiUrl = `${environment.apiBaseUrl}/api/menu`;

  constructor(private http: HttpClient) {}

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/dashboard-stats`);
  }

  getCustomers(params: { page?: number; limit?: number; search?: string } = {}): Observable<{
    total: number;
    page: number;
    limit: number;
    data: Customer[];
  }> {
    const q = new URLSearchParams();
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 50));
    if (params.search?.trim()) q.set('search', params.search.trim());
    return this.http.get<any>(`${this.apiUrl}/customers?${q.toString()}`);
  }

  deleteCustomer(id: any): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/customers/${id}`);
  }

  changeCustomerRole(id: any, role: 'customer' | 'admin'): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/customers/${id}/role`, { role });
  }

  addCustomer(payload: AdminUserPayload): Observable<{ id: number; email: string; full_name: string; role: string }> {
    return this.http.post<any>(`${this.apiUrl}/customers`, payload);
  }

  getMenus(): Observable<Menu[]> {
    return this.http.get<Menu[]>(`${this.apiUrl}/menus`);
  }

  createMenu(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/menus`, formData);
  }

  updateMenu(id: number, formData: FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/menus/${id}`, formData);
  }

  deleteMenu(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/menus/${id}`);
  }

  getTiers(): Observable<Tier[]> {
    return this.http.get<Tier[]>(`${this.menuApiUrl}/tiers`);
  }

  getPlanCombinations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.menuApiUrl}/plan-combinations`);
  }

  uploadDishImage(formData: FormData): Observable<{image_url: string}> {
    return this.http.post<{image_url: string}>(`${this.menuApiUrl}/upload-image`, formData);
  }

  createDish(payload: DishPayload): Observable<any> {
    return this.http.post(`${this.menuApiUrl}/dishes`, payload);
  }

  getReports(period: string): Observable<ReportStats> {
    return this.http.get<ReportStats>(`${this.apiUrl}/reports?period=${period}`);
  }

  getTodaysOrders(): Observable<TodaysOrdersResponse> {
    return this.http.get<TodaysOrdersResponse>(`${this.apiUrl}/todays-orders`);
  }
}

export interface TodaysOrderRow {
  subscription_id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  tier_name: string;
  plan_name: string;
  diet_type: string;
  session_key: 'BF' | 'DINNER' | string;
  session_label: string;
  cancelled_at?: string | null;
}

export interface TodaysOrdersResponse {
  date: string;
  is_weekend: boolean;
  orders: TodaysOrderRow[];
  skipped: TodaysOrderRow[];
}

export interface ReportStats {
  revenue: string;
  totalOrders: number;
  newCustomers: number;
  aov: string;
  chartData: {
    labels: string[];
    values: number[];
  };
  topItems: {
    name: string;
    orders: number;
    revenue: string;
  }[];
  segments: {
    label: string;
    count: number;
    pct: number;
    color: string;
  }[];
}
