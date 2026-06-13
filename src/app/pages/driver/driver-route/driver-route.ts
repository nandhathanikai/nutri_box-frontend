import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DeliveryService } from '../../../services/delivery.service';

declare const L: any; // Leaflet.js loaded via CDN

@Component({
  selector: 'app-driver-route',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver-route.html',
  styleUrl: './driver-route.scss',
})
export class DriverRouteComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  assignmentId: string = '';
  routeInfo: any = null;
  loading = true;
  error = '';

  private map: any = null;
  private driverMarker: any = null;
  private customerMarker: any = null;
  private routeLine: any = null;
  private watchId: number | null = null;
  private wsLocationSub: any = null;

  distance: string = '';
  duration: string = '';
  driverLat: number | null = null;
  driverLng: number | null = null;

  routeCoords: [number, number][] = [];
  isSimulating = false;
  actionLoading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private deliveryService: DeliveryService
  ) {}

  ngOnInit() {
    this.assignmentId = this.route.snapshot.paramMap.get('assignmentId') || '';
    this.deliveryService.getRouteInfo(this.assignmentId).subscribe({
      next: (info) => {
        this.routeInfo = info;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load route information.';
      },
    });

    // Subscribe to live/simulated WebSocket location updates
    this.wsLocationSub = this.deliveryService.locationUpdate$.subscribe({
      next: (msg) => {
        if (String(msg.assignment_id) === String(this.assignmentId)) {
          const custLat = this.routeInfo?.latitude;
          const custLng = this.routeInfo?.longitude;
          if (custLat && custLng) {
            this.updateDriverPosition(msg.latitude, msg.longitude, custLat, custLng);
          }
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.wsLocationSub) this.wsLocationSub.unsubscribe();
    if (this.map) this.map.remove();
    this.deliveryService.stopGpsSimulation();
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

  ngAfterViewInit() {
    // Wait for routeInfo then init map
    const checkReady = setInterval(() => {
      if (!this.loading && this.mapContainer?.nativeElement) {
        clearInterval(checkReady);
        this.initMap();
      }
    }, 100);
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
    let custLat = this.routeInfo?.latitude;
    let custLng = this.routeInfo?.longitude;

    if (this.routeInfo?.location_link) {
      const parsed = this.extractCoordsFromLink(this.routeInfo.location_link);
      if (parsed) {
        custLat = parsed.lat;
        custLng = parsed.lng;
        // Update routeInfo coordinates so OSRM fetches from here
        this.routeInfo.latitude = custLat;
        this.routeInfo.longitude = custLng;
      }
    }

    if (!custLat || !custLng) {
      // Try geocoding the landmark or address text via Nominatim
      const landmark = this.routeInfo?.landmark?.trim();
      const address  = this.routeInfo?.address?.trim();
      const query = landmark || address;
      if (query) {
        this.error = '';
        const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        fetch(geoUrl, { headers: { 'Accept-Language': 'en' } })
          .then(r => r.json())
          .then((results: any[]) => {
            if (results && results.length > 0) {
              this.routeInfo.latitude = parseFloat(results[0].lat);
              this.routeInfo.longitude = parseFloat(results[0].lon);
              this.initMap(); // retry now that coords are populated
            } else {
              this.error = 'Customer coordinates not found. Ask the customer to update their profile.';
            }
          })
          .catch(() => {
            this.error = 'Could not resolve customer location. Please use Google Maps manually.';
          });
        return; // wait for geocode response
      }
      this.error = 'Customer location not available. Please update the customer\'s address coordinates.';
      return;
    }

    await this.loadLeaflet();

    this.map = L.map(this.mapContainer.nativeElement).setView([custLat, custLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    // Customer marker
    const custIcon = L.divIcon({
      className: '',
      html: `<div class="map-pin customer-pin"><i class="pi pi-home"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });
    this.customerMarker = L.marker([custLat, custLng], { icon: custIcon })
      .addTo(this.map)
      .bindPopup(`<strong>${this.routeInfo.customer_name}</strong><br>${this.routeInfo.address}`);

    // Start REAL driver location watch (feeds both map + WebSocket to customers)
    if (navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          // Update driver's own map view
          this.updateDriverPosition(lat, lng, custLat, custLng);
          // Broadcast real GPS to customers via WebSocket
          if (this.deliveryService.isGpsTrackingActive) {
            this.deliveryService.sendGpsPoint(lat, lng);
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }

  private updateDriverPosition(lat: number, lng: number, custLat: number, custLng: number) {
    this.driverLat = lat;
    this.driverLng = lng;

    const driverIcon = L.divIcon({
      className: '',
      html: `<div class="map-pin driver-pin"><i class="pi pi-truck"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    if (!this.driverMarker) {
      this.driverMarker = L.marker([lat, lng], { icon: driverIcon }).addTo(this.map).bindPopup('Your Location');
      this.map.fitBounds([[lat, lng], [custLat, custLng]], { padding: [40, 40] });
    } else {
      this.driverMarker.setLatLng([lat, lng]);
    }

    this.fetchOSRMRoute(lat, lng, custLat, custLng);
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

          if (route.geometry && route.geometry.coordinates) {
            this.routeCoords = route.geometry.coordinates;
          }

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
        
        this.routeCoords = [[dLng, dLat], [cLng, cLat]];

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

  openGoogleMaps() {
    if (!this.routeInfo) return;

    let url = '';
    if (this.routeInfo.location_link) {
      url = this.routeInfo.location_link;
    } else if (this.routeInfo.latitude && this.routeInfo.longitude) {
      const origin = this.driverLat ? `${this.driverLat},${this.driverLng}` : '';
      const dest = `${this.routeInfo.latitude},${this.routeInfo.longitude}`;
      url = origin
        ? `https://www.google.com/maps/dir/${origin}/${dest}`
        : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    } else if (this.routeInfo.address) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.routeInfo.address)}`;
    } else {
      return;
    }
    window.open(url, '_blank');
  }

  startDelivery() {
    if (!this.assignmentId || this.actionLoading) return;
    this.actionLoading = true;
    this.deliveryService.startDelivery(this.assignmentId).subscribe({
      next: () => {
        this.actionLoading = false;
        if (this.routeInfo) {
          this.routeInfo.status = 'on_the_way';
        }
        // Open the driver WebSocket and start real GPS broadcasting to customers
        this.deliveryService.startGpsTracking(this.assignmentId);
      },
      error: () => {
        this.actionLoading = false;
      }
    });
  }

  markDelivered() {
    if (!this.assignmentId || this.actionLoading) return;

    const confirmDelivered = window.confirm(`Are you sure you have delivered this order?`);
    if (!confirmDelivered) return;

    this.actionLoading = true;
    this.deliveryService.markDelivered(this.assignmentId).subscribe({
      next: () => {
        this.actionLoading = false;
        if (this.routeInfo) {
          this.routeInfo.status = 'delivered';
        }
        this.isSimulating = false;
        this.deliveryService.stopGpsSimulation();
      },
      error: () => {
        this.actionLoading = false;
      }
    });
  }

  startSimulation() {
    if (this.routeCoords && this.routeCoords.length > 0) {
      this.isSimulating = true;
      this.deliveryService.startGpsSimulation(this.assignmentId, this.routeCoords);
    }
  }

  goBack() {
    this.router.navigate(['/driver/dashboard']);
  }
}
