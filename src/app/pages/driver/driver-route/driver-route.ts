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

  distance: string = '';
  duration: string = '';
  driverLat: number | null = null;
  driverLng: number | null = null;

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

  ngOnDestroy() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.map) this.map.remove();
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
    if (!this.routeInfo?.latitude || !this.routeInfo?.longitude) {
      this.error = 'Customer location not available. Please update the customer\'s address coordinates.';
      return;
    }

    await this.loadLeaflet();

    const custLat = this.routeInfo.latitude;
    const custLng = this.routeInfo.longitude;

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

    // Start driver location watch
    if (navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.updateDriverPosition(pos.coords.latitude, pos.coords.longitude, custLat, custLng),
        (err) => console.warn('GPS error:', err),
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

  goBack() {
    this.router.navigate(['/driver/dashboard']);
  }
}
