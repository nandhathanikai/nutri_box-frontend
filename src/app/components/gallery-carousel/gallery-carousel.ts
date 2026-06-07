import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

@Component({
  selector: 'app-gallery-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery-carousel.html',
  styleUrl: './gallery-carousel.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class GalleryCarouselComponent implements OnInit, OnDestroy {
  galleryImages: GalleryImage[] = [];
  virtualCenterIndex = 0;
  private autoPlayTimer: any = null;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadGalleryImages();
  }

  ngOnDestroy() {
    this.stopAutoPlay();
  }

  loadGalleryImages() {
    this.http.get<GalleryImage[]>(`${environment.apiBaseUrl}/api/gallery`).subscribe({
      next: (data) => {
        this.galleryImages = (data || []).map(img => ({
          id: img.id,
          image_url: img.image_url,
          caption: img.caption ?? null,
          sort_order: img.sort_order,
          created_at: img.created_at,
        }));
        this.virtualCenterIndex = 0;
        this.cdr.detectChanges();
        if (this.galleryImages.length > 1) {
          this.startAutoPlay();
        }
      },
      error: () => {
        this.galleryImages = [];
        this.cdr.detectChanges();
      }
    });
  }

  /** Real gallery images, or placeholder slots when gallery is empty */
  get baseImages(): any[] {
    if (!this.galleryImages || this.galleryImages.length === 0) {
      return Array.from({ length: 5 }, (_, i) => ({ isPlaceholder: true, _id: i }));
    }
    return this.galleryImages;
  }

  /** Visible cards: at most min(imageCount, 5), no duplicates */
  get covercards(): Array<{ img: any; absIdx: number }> {
    const len = this.baseImages.length;
    const visibleCount = Math.min(len, 5);
    const half = Math.floor(visibleCount / 2);
    const offsets = Array.from({ length: visibleCount }, (_, i) => i - half);
    return offsets.map(offset => {
      const absIdx = this.virtualCenterIndex + offset;
      const imgIdx = ((absIdx % len) + len) % len;
      return { img: this.baseImages[imgIdx], absIdx };
    });
  }

  absFromCenter(absIdx: number): number {
    return Math.abs(absIdx - this.virtualCenterIndex);
  }

  get activeDotIndex(): number {
    const len = this.baseImages.length;
    return ((this.virtualCenterIndex % len) + len) % len;
  }

  next() {
    this.virtualCenterIndex++;
    this.cdr.detectChanges();
  }

  prev() {
    this.virtualCenterIndex--;
    this.cdr.detectChanges();
  }

  goToCard(dotIndex: number) {
    const len = this.baseImages.length;
    const current = ((this.virtualCenterIndex % len) + len) % len;
    let diff = dotIndex - current;
    if (diff > len / 2) diff -= len;
    if (diff < -len / 2) diff += len;
    this.virtualCenterIndex += diff;
    this.resetAutoPlay();
    this.cdr.detectChanges();
  }

  startAutoPlay() {
    this.stopAutoPlay();
    this.autoPlayTimer = setInterval(() => this.next(), 2500);
  }

  stopAutoPlay() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  resetAutoPlay() {
    if (this.galleryImages.length > 1) {
      this.startAutoPlay();
    }
  }
}
