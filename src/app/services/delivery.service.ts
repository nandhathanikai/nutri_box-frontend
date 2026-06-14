import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface DeliverySession {
  id: number;
  name: string;
  slug: string;
  display_order: number;
  is_active: boolean;
}

export interface DriverProfile {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  today_assignments: number;
  online_status: 'available' | 'on_delivery' | 'offline';
}

export interface OrderRow {
  subscription_id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  tier_name: string;
  plan_name: string;
  diet_type: string;
  session_slug: string;
  assignment_id: number | null;
  assignment_status: 'unassigned' | 'assigned' | 'on_the_way' | 'delivered';
  driver_id: number | null;
  driver_name: string | null;
  cancelled_at?: string | null;
  customization_details?: string | null;
}

export interface SessionGroup {
  session: string;
  session_id: number;
  slug: string;
  orders: OrderRow[];
  skipped: OrderRow[];
}

export interface DeliveryOrdersResponse {
  date: string;
  is_weekend: boolean;
  sessions: SessionGroup[];
}

export interface DeliveryItem {
  assignment_id: number;
  subscription_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  location_link?: string | null;
  tier_name: string;
  tier_slug: string;
  plan_name: string;
  diet_type: string;
  status: 'assigned' | 'on_the_way' | 'delivered';
  assigned_at: string;
  started_at: string | null;
  delivered_at: string | null;
}

export interface DriverSession {
  session_id: number;
  session_name: string;
  slug: string;
  display_order: number;
  deliveries: DeliveryItem[];
}

export interface DriverDeliveriesResponse {
  date: string;
  sessions: DriverSession[];
}

export interface MonitorRow {
  driver_id: number;
  driver_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  online_status: 'available' | 'on_delivery' | 'offline';
  current_session: string | null;
  current_assignment_id: number | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_updated: string | null;
  today_total: number;
}

export interface TrackingStatus {
  assignment_id: string | number;
  status: 'assigned' | 'on_the_way' | 'delivered';
  driver_name: string;
  driver_phone: string;
  driver_latitude: number | null;
  driver_longitude: number | null;
  last_updated: string | null;
  delivered_at: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_latitude?: number | null;
  customer_longitude?: number | null;
  customer_location_link?: string | null;
  customer_landmark?: string | null;
}

// ── WebSocket Message types ──────────────────────────────────────────────────

export interface WsLocationMessage {
  type: 'location_update';
  assignment_id: string | number;
  driver_id: string | number;
  latitude: number;
  longitude: number;
  recorded_at: string;
  status: string;
  server_time: string;
}

export interface WsStatusMessage {
  type: 'status_change';
  assignment_id: string | number;
  status: string;
  server_time: string;
}

export interface WsInitialStatus {
  type: 'initial_status';
  assignment_id: string | number;
  status: string;
  driver_latitude: number | null;
  driver_longitude: number | null;
  last_updated: string | null;
}

export type WsMessage = WsLocationMessage | WsStatusMessage | WsInitialStatus;

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private deliveryUrl = `${environment.apiBaseUrl}/api/delivery`;
  private driverUrl = `${environment.apiBaseUrl}/api/driver`;
  private trackingUrl = `${environment.apiBaseUrl}/api/tracking`;
  private wsBase: string;

  /** Emits GPS location updates from the tracking WebSocket. */
  readonly locationUpdate$ = new Subject<WsLocationMessage>();
  /** Emits status changes (delivered, on_the_way) from any WS. */
  readonly statusChange$ = new Subject<WsStatusMessage>();

  private _trackWs: WebSocket | null = null;
  private _driverWs: WebSocket | null = null;
  private _reconnectTimer: any = null;
  private _gpsTimer: any = null;
  private _offlineQueue: { lat: number; lng: number; recorded_at: string }[] = [];
  private _currentAssignmentId: string | number | null = null;

  private _simulatedCoords: [number, number][] = [];
  private _simIndex = 0;
  private _isSimulating = false;

  constructor(private http: HttpClient, private auth: AuthService) {
    // Build WebSocket base URL from HTTP base (replace http(s) with ws(s))
    this.wsBase = environment.apiBaseUrl.replace(/^http/, 'ws');
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN — Sessions
  // ═══════════════════════════════════════════════════════════

  getSessions(): Observable<DeliverySession[]> {
    return this.http.get<DeliverySession[]>(`${this.deliveryUrl}/sessions`);
  }

  createSession(payload: { name: string; display_order: number; is_active: boolean }): Observable<DeliverySession> {
    return this.http.post<DeliverySession>(`${this.deliveryUrl}/sessions`, payload);
  }

  updateSession(id: number, payload: Partial<DeliverySession>): Observable<DeliverySession> {
    return this.http.put<DeliverySession>(`${this.deliveryUrl}/sessions/${id}`, payload);
  }

  deleteSession(id: number): Observable<void> {
    return this.http.delete<void>(`${this.deliveryUrl}/sessions/${id}`);
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN — Drivers
  // ═══════════════════════════════════════════════════════════

  getDrivers(search?: string): Observable<DriverProfile[]> {
    const params: any = {};
    if (search) params['search'] = search;
    return this.http.get<DriverProfile[]>(`${this.deliveryUrl}/drivers`, { params });
  }

  createDriver(payload: {
    full_name: string; email: string; phone: string; password: string; is_active: boolean;
  }): Observable<any> {
    return this.http.post(`${this.deliveryUrl}/drivers`, payload);
  }

  updateDriver(id: number, payload: { full_name?: string; phone?: string; is_active?: boolean }): Observable<any> {
    return this.http.put(`${this.deliveryUrl}/drivers/${id}`, payload);
  }

  toggleDriverActive(id: number): Observable<{ id: number; is_active: boolean }> {
    return this.http.patch<{ id: number; is_active: boolean }>(`${this.deliveryUrl}/drivers/${id}/toggle-active`, {});
  }

  deleteDriver(id: number): Observable<void> {
    return this.http.delete<void>(`${this.deliveryUrl}/drivers/${id}`);
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN — Orders + Assignment
  // ═══════════════════════════════════════════════════════════

  getDeliveryOrders(): Observable<DeliveryOrdersResponse> {
    return this.http.get<DeliveryOrdersResponse>(`${this.deliveryUrl}/todays-orders`);
  }

  assignOrders(payload: {
    driver_id: number;
    session_id: number;
    subscription_ids: number[];
    delivery_date?: string;
  }): Observable<any> {
    return this.http.post(`${this.deliveryUrl}/assign`, payload);
  }

  getMonitor(): Observable<MonitorRow[]> {
    return this.http.get<MonitorRow[]>(`${this.deliveryUrl}/monitor`);
  }

  updateCustomerLocation(customerId: number, payload: {
    address?: string; latitude?: number; longitude?: number; location_link?: string;
  }): Observable<any> {
    return this.http.put(`${this.deliveryUrl}/customers/${customerId}/location`, payload);
  }

  // ═══════════════════════════════════════════════════════════
  // DRIVER — My deliveries
  // ═══════════════════════════════════════════════════════════

  getMyDeliveries(): Observable<DriverDeliveriesResponse> {
    return this.http.get<DriverDeliveriesResponse>(`${this.driverUrl}/deliveries`);
  }

  startDelivery(assignmentId: string | number): Observable<any> {
    return this.http.post(`${this.driverUrl}/delivery/${assignmentId}/start`, {});
  }

  markDelivered(assignmentId: string | number): Observable<any> {
    return this.http.post(`${this.driverUrl}/delivery/${assignmentId}/delivered`, {});
  }

  updateMyStatus(status: 'available' | 'on_delivery' | 'offline'): Observable<any> {
    return this.http.put(`${this.driverUrl}/status`, { status });
  }

  getRouteInfo(assignmentId: string | number): Observable<any> {
    return this.http.get(`${this.driverUrl}/delivery/${assignmentId}/route`);
  }

  // ═══════════════════════════════════════════════════════════
  // CUSTOMER — Tracking status poll
  // ═══════════════════════════════════════════════════════════

  getTrackingStatus(assignmentId: string | number): Observable<TrackingStatus> {
    return this.http.get<TrackingStatus>(`${this.trackingUrl}/${assignmentId}`);
  }

  getActiveDeliveries(): Observable<any[]> {
    return this.http.get<any[]>(`${this.trackingUrl}/active`);
  }

  // ═══════════════════════════════════════════════════════════
  // DRIVER GPS TRACKING — WebSocket + offline buffer
  // ═══════════════════════════════════════════════════════════

  /** Open the driver's GPS WebSocket and begin location tracking every 5s. */
  startGpsTracking(assignmentId: string | number): void {
    this._currentAssignmentId = assignmentId;
    this._openDriverWs(assignmentId);
    this._startGpsLoop(assignmentId);
  }

  stopGpsTracking(): void {
    if (this._gpsTimer) { clearInterval(this._gpsTimer); this._gpsTimer = null; }
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this._driverWs) { this._driverWs.close(); this._driverWs = null; }
    this._currentAssignmentId = null;
  }

  /** True when the driver WebSocket connection is open and ready to send GPS. */
  get isGpsTrackingActive(): boolean {
    return this._driverWs?.readyState === WebSocket.OPEN;
  }

  /** Send a single real GPS point through the driver WebSocket immediately. */
  sendGpsPoint(lat: number, lng: number): void {
    const point = { lat, lng, recorded_at: new Date().toISOString() };
    if (this._driverWs?.readyState === WebSocket.OPEN) {
      this._driverWs.send(JSON.stringify(point));
    } else {
      this._offlineQueue.push(point);
      if (this._offlineQueue.length > 200) this._offlineQueue.shift();
    }
  }

  startGpsSimulation(assignmentId: string | number, routeCoords: [number, number][]): void {
    this._currentAssignmentId = assignmentId;
    this._simulatedCoords = routeCoords;
    this._simIndex = 0;
    this._isSimulating = true;

    // Connect WebSocket
    this._openDriverWs(assignmentId);

    // Stop real GPS tracking loop if running
    if (this._gpsTimer) {
      clearInterval(this._gpsTimer);
      this._gpsTimer = null;
    }

    // Run simulation loop
    this._gpsTimer = setInterval(() => {
      if (!this._isSimulating || this._simIndex >= this._simulatedCoords.length) {
        this.stopGpsSimulation();
        return;
      }

      const coord = this._simulatedCoords[this._simIndex];
      // OSRM coordinates format: [longitude, latitude]
      const lng = coord[0];
      const lat = coord[1];

      const point = {
        lat: lat,
        lng: lng,
        recorded_at: new Date().toISOString(),
      };

      // Send to WebSocket
      if (this._driverWs?.readyState === WebSocket.OPEN) {
        this._driverWs.send(JSON.stringify(point));
      } else {
        this._offlineQueue.push(point);
        if (this._offlineQueue.length > 200) this._offlineQueue.shift();
      }

      // Also publish locally via locationUpdate$ so the driver route map updates too
      this.locationUpdate$.next({
        type: 'location_update',
        assignment_id: assignmentId,
        driver_id: 0,
        latitude: lat,
        longitude: lng,
        recorded_at: point.recorded_at,
        status: 'on_the_way',
        server_time: point.recorded_at
      });

      this._simIndex++;
    }, 2000); // Step every 2 seconds
  }

  stopGpsSimulation(): void {
    this._isSimulating = false;
    this.stopGpsTracking();
  }

  private _openDriverWs(assignmentId: string | number): void {
    const token = this.auth.getToken();
    if (!token) return;
    const url = `${this.wsBase}/ws/driver/${assignmentId}?token=${token}`;
    this._driverWs = new WebSocket(url);

    this._driverWs.onopen = () => {
      // Flush offline queue
      if (this._offlineQueue.length > 0) {
        this._syncOfflineQueue(assignmentId);
      }
    };

    this._driverWs.onerror = () => { /* handled in onclose */ };

    this._driverWs.onclose = () => {
      // Auto-reconnect after 5 seconds
      if (this._currentAssignmentId === assignmentId) {
        this._reconnectTimer = setTimeout(() => this._openDriverWs(assignmentId), 5000);
      }
    };
  }

  private _startGpsLoop(assignmentId: string | number): void {
    if (!navigator.geolocation) return;
    this._gpsTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const point = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            recorded_at: new Date().toISOString(),
          };
          if (this._driverWs?.readyState === WebSocket.OPEN) {
            this._driverWs.send(JSON.stringify(point));
          } else {
            // Store in offline buffer (max 200 points)
            this._offlineQueue.push(point);
            if (this._offlineQueue.length > 200) this._offlineQueue.shift();
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }, 5000);
  }

  private _syncOfflineQueue(assignmentId: string | number): void {
    const points = [...this._offlineQueue];
    this._offlineQueue = [];
    this.http.post(`${this.trackingUrl}/${assignmentId}/location`, { points }).subscribe({
      error: () => {
        // Re-queue if sync fails
        this._offlineQueue = [...points, ...this._offlineQueue].slice(0, 200);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CUSTOMER TRACKING — WebSocket listener
  // ═══════════════════════════════════════════════════════════

  connectCustomerTracking(assignmentId: string | number): void {
    const token = this.auth.getToken();
    if (!token) return;
    const url = `${this.wsBase}/ws/track/${assignmentId}?token=${token}`;
    this._trackWs = new WebSocket(url);

    this._trackWs.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type === 'location_update') {
          this.locationUpdate$.next(msg as WsLocationMessage);
        } else if (msg.type === 'status_change') {
          this.statusChange$.next(msg as WsStatusMessage);
        }
      } catch { /* ignore bad JSON */ }
    };

    this._trackWs.onclose = () => {
      // Reconnect after 3 seconds if not deliberately closed
      setTimeout(() => {
        if (this._trackWs?.readyState === WebSocket.CLOSED) {
          this.connectCustomerTracking(assignmentId);
        }
      }, 3000);
    };
  }

  disconnectCustomerTracking(): void {
    if (this._trackWs) {
      const ws = this._trackWs;
      this._trackWs = null; // Prevent reconnect loop
      ws.close();
    }
  }

  get offlineQueueSize(): number {
    return this._offlineQueue.length;
  }
}
