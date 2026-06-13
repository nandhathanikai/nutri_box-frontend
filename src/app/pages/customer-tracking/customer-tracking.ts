import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DeliveryService, TrackingStatus } from '../../services/delivery.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

declare const L: any; // Leaflet.js loaded via CDN

@Component({
  selector: 'app-customer-tracking',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastModule],
  providers: [MessageService],
  templateUrl: './customer-tracking.html',
  styleUrl: './customer-tracking.scss'
})
export class CustomerTrackingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  assignmentId: string = '';
  trackingInfo: TrackingStatus | null = null;
  loading = true;
  error = '';

  private map: any = null;
  private driverMarker: any = null;
  private customerMarker: any = null;
  private routeLine: any = null;

  distance: string = '';
  duration: string = '';

  driverLat: number | null = null;
  driverLng: number | null = null;
  custLat: number | null = null;
  custLng: number | null = null;

  /** Address text shown when coords are unavailable */
  customerAddressText: string = '';
  /** True while geocoding the landmark/address */
  geocoding = false;

  private locationSub: any = null;
  private statusSub: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private deliveryService: DeliveryService,
    private cdr: ChangeDetectorRef,
    private msg: MessageService
  ) {}

  ngOnInit() {
    this.assignmentId = this.route.snapshot.paramMap.get('assignmentId') || '';
    this.loadTrackingData();

    // Subscribe to live WebSocket tracking updates
    this.deliveryService.connectCustomerTracking(this.assignmentId);

    this.locationSub = this.deliveryService.locationUpdate$.subscribe({
      next: (msg: any) => {
        if (String(msg.assignment_id) === String(this.assignmentId)) {
          this.driverLat = msg.latitude;
          this.driverLng = msg.longitude;
          if (this.trackingInfo) {
            this.trackingInfo.driver_latitude = msg.latitude;
            this.trackingInfo.driver_longitude = msg.longitude;
            this.trackingInfo.status = msg.status as any;
          }
          this.updateMapPositions();
          this.cdr.detectChanges();
        }
      }
    });

    this.statusSub = this.deliveryService.statusChange$.subscribe({
      next: (msg: any) => {
        if (String(msg.assignment_id) === String(this.assignmentId)) {
          if (this.trackingInfo) {
            this.trackingInfo.status = msg.status as any;
            if (msg.status === 'delivered') {
              this.trackingInfo.delivered_at = msg.server_time;
              this.msg.add({
                severity: 'success',
                summary: 'Delivered!',
                detail: 'Your meal has been delivered. Enjoy!',
                life: 10000
              });
            } else if (msg.status === 'on_the_way') {
              this.msg.add({
                severity: 'info',
                summary: 'On the Way',
                detail: 'Your delivery partner has started moving!',
                life: 5000
              });
            }
          }
          this.cdr.detectChanges();
        }
      }
    });
  }

  ngAfterViewInit() {
    // Wait for mapping container and leaflet availability
    const checkReady = setInterval(() => {
      if (!this.loading && this.mapContainer?.nativeElement && this.custLat && this.custLng) {
        clearInterval(checkReady);
        this.initMap();
      }
    }, 100);
  }

  ngOnDestroy() {
    if (this.locationSub) this.locationSub.unsubscribe();
    if (this.statusSub) this.statusSub.unsubscribe();
    this.deliveryService.disconnectCustomerTracking();
    if (this.map) this.map.remove();
  }

  extractCoordsFromLink(url: string): { lat: number; lng: number } | null {
    if (!url) return null;

    // 1. Google Maps ?q=lat,lng or &query=lat,lng
    let match = url.match(/[?&](q|query)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return { lat: parseFloat(match[2]), lng: parseFloat(match[3]) };
    }

    // 2. Google Maps /@lat,lng,zoom or /place/.../@lat,lng
    match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // 3. OpenStreetMap ?mlat=lat&mlon=lng
    match = url.match(/mlat=(-?\d+\.?\d*).*mlon=(-?\d+\.?\d*)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // 4. Generic lat,lng in URL path/query (fallback)
    match = url.match(/(-?\d{1,3}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    return null;
  }

  loadTrackingData() {
    this.loading = true;
    this.error = '';
    this.deliveryService.getTrackingStatus(this.assignmentId).subscribe({
      next: (info: any) => {
        this.trackingInfo = info;
        this.driverLat = info.driver_latitude;
        this.driverLng = info.driver_longitude;

        // ── Customer coords resolution — priority chain ─────────────────
        // 1. Direct lat/lng from backend
        let cLat: number | null = info.customer_latitude ?? null;
        let cLng: number | null = info.customer_longitude ?? null;

        // 2. Parse from location_link (Google Maps URL saved in profile)
        if ((!cLat || !cLng) && info.customer_location_link) {
          const parsed = this.extractCoordsFromLink(info.customer_location_link);
          if (parsed) {
            cLat = parsed.lat;
            cLng = parsed.lng;
          }
        }

        this.custLat = cLat;
        this.custLng = cLng;

        // 3. Geocode landmark or full address using Nominatim (free, no API key)
        if (!this.custLat || !this.custLng) {
          const landmark  = info.customer_landmark?.trim();
          const address   = info.customer_address?.trim();
          // Prefer landmark (more specific), fall back to full address text
          const query = landmark || address;
          if (query) {
            this.customerAddressText = address || landmark || '';
            this.geocoding = true;
            this.geocodeAddress(query);
          }
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err.error?.detail || 'Could not load tracking information.';
        this.cdr.detectChanges();
      }
    });
  }

  /** Geocode a text string via Nominatim. Falls back silently if unavailable. */
  private geocodeAddress(query: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(r => r.json())
      .then((results: any[]) => {
        this.geocoding = false;
        if (results && results.length > 0) {
          this.custLat = parseFloat(results[0].lat);
          this.custLng = parseFloat(results[0].lon);
          this.cdr.detectChanges();
          // Map may now be ready — trigger init
          this.initMap();
        } else {
          // No results — show address text card as last resort
          this.cdr.detectChanges();
        }
      })
      .catch(() => {
        this.geocoding = false;
        this.cdr.detectChanges();
      });
  }

  private loadLeaflet(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).L) { resolve(); return; }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private async initMap() {
    if (!this.custLat || !this.custLng) return;
    // Don't re-init if already created
    if (this.map) {
      this.updateMapPositions();
      return;
    }
    // Wait for the view child to be ready (geocoding path may arrive late)
    if (!this.mapContainer?.nativeElement) return;

    await this.loadLeaflet();

    this.map = L.map(this.mapContainer.nativeElement).setView([this.custLat, this.custLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    // Customer Home Marker
    const custIcon = L.divIcon({
      className: '',
      html: `<div class="map-pin customer-pin"><i class="pi pi-home"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });
    this.customerMarker = L.marker([this.custLat, this.custLng], { icon: custIcon })
      .addTo(this.map)
      .bindPopup(`<strong>Your Home</strong><br>${this.trackingInfo?.customer_address || ''}`);

    this.updateMapPositions();
  }

  private updateMapPositions() {
    if (!this.map) return;

    // Driver Marker
    if (this.driverLat && this.driverLng) {
      const driverIcon = L.divIcon({
        className: '',
        html: `<div class="map-pin driver-pin"><i class="pi pi-truck"></i></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      if (!this.driverMarker) {
        this.driverMarker = L.marker([this.driverLat, this.driverLng], { icon: driverIcon })
          .addTo(this.map)
          .bindPopup(`<strong>Delivery Partner</strong><br>${this.trackingInfo?.driver_name || 'Driver'}`);

        // Auto fit bounds to include both driver and customer
        if (this.custLat && this.custLng) {
          this.map.fitBounds([[this.driverLat, this.driverLng], [this.custLat, this.custLng]], { padding: [50, 50] });
        }
      } else {
        this.driverMarker.setLatLng([this.driverLat, this.driverLng]);
      }

      // Fetch OSRM route line if customer coords are present
      if (this.custLat && this.custLng) {
        this.fetchOSRMRoute(this.driverLat, this.driverLng, this.custLat, this.custLng);
      }
    }
  }

  private fetchOSRMRoute(dLat: number, dLng: number, cLat: number, cLng: number) {
    const url = `https://router.project-osrm.org/route/v1/driving/${dLng},${dLat};${cLng},${cLat}?overview=full&geometries=geojson`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const dist = route.distance; // meters
          const dur = route.duration; // seconds
          this.distance = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
          this.duration = dur >= 60 ? `${Math.round(dur / 60)} min` : `${Math.round(dur)} sec`;

          // Draw route line
          if (this.routeLine) this.routeLine.remove();
          this.routeLine = L.geoJSON(route.geometry, {
            style: { color: '#2e7d32', weight: 5, opacity: 0.8 }
          }).addTo(this.map);
        }
      })
      .catch(() => {
        // Fallback: straight line
        if (this.routeLine) this.routeLine.remove();
        this.routeLine = L.polyline([[dLat, dLng], [cLat, cLng]], { color: '#2e7d32', weight: 3, dashArray: '8 6' }).addTo(this.map);
        const dist = this.haversine(dLat, dLng, cLat, cLng);
        this.distance = dist >= 1 ? `~${dist.toFixed(1)} km` : `~${Math.round(dist * 1000)} m`;
        this.duration = `~${Math.round((dist / 30) * 60)} min`;
      });
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Exposed to template for address URL encoding */
  encodeURIComponent = encodeURIComponent;

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
