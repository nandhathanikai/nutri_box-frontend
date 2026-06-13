import { Component, HostListener, ElementRef, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { RatingModule } from 'primeng/rating';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { GalleryCarouselComponent } from '../../components/gallery-carousel/gallery-carousel';

interface FeaturedPlan {
  name: string;
  slug?: string | null;
  price: number;
  subtitle: string;
  features: string[];
  popular: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, CardModule, RatingModule, AvatarModule, SkeletonModule, FormsModule, GalleryCarouselComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent implements OnInit {
  @ViewChild('parallaxHero') parallaxHero!: ElementRef;
  scrollY = 0;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  @HostListener('window:scroll', [])
  onScroll() {
    this.scrollY = window.scrollY;
    this.checkScrollForMoreReviews();
  }

  get heroParallax() { return this.scrollY * 0.4; }
  get heroTextY() { return this.scrollY * 0.6; }
  get heroOpacity() { return Math.max(0, 1 - this.scrollY / 600); }

  howItWorks = [
    { step: '01', title: 'Pick Your Plan', description: 'Choose from our curated daily, weekly, or monthly meal plans tailored by nutritionists.', icon: 'pi pi-list-check' },
    { step: '02', title: 'We Curate & Cook', description: 'Our chefs source the freshest local ingredients and prepare every meal with care.', icon: 'pi pi-box' },
    { step: '03', title: 'Delivered Fresh', description: 'Your meals arrive chilled and ready to enjoy. Zero hassle, maximum nutrition.', icon: 'pi pi-truck' }
  ];

  featuredPlans: FeaturedPlan[] = [];
  plansLoading = true;
  plansLoadFailed = false;

  reviews: { id: number; name: string; role: string; text: string; rating: number; avatar: string; dateStr: string }[] = [];
  reviewsSkip = 0;
  reviewsLimit = 10;
  hasMoreReviews = true;
  loadingReviews = false;
  reviewStats = { total_reviews: 0, happy_customers: 0 };

  ngOnInit() {
    this.loadFeaturedPlans();
    this.loadReviews(false);
    this.loadReviewStats();
  }

  loadReviews(append = false) {
    if (this.loadingReviews) return;
    if (append && !this.hasMoreReviews) return;

    if (!append) {
      this.reviewsSkip = 0;
      this.hasMoreReviews = true;
    }

    this.loadingReviews = true;
    const url = `${environment.apiBaseUrl}/api/reviews?skip=${this.reviewsSkip}&limit=${this.reviewsLimit}`;
    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        const mapped = (data || []).map(r => {
          const name = r.customer_name || 'Valued Customer';
          const parts = name.trim().split(/\s+/);
          let initials = '';
          if (parts.length > 1) {
            initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
          } else if (parts.length > 0 && parts[0].length > 0) {
            initials = parts[0][0].toUpperCase();
          } else {
            initials = 'C';
          }

          const date = r.created_at ? new Date(r.created_at) : new Date();
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const dateStr = `${months[date.getMonth()]} ${date.getFullYear()}`;

          return {
            id: r.id,
            name: name,
            role: r.customer_role || 'Customer',
            text: r.text,
            rating: r.rating,
            avatar: initials,
            dateStr: dateStr
          };
        });

        if (append) {
          this.reviews = [...this.reviews, ...mapped];
        } else {
          this.reviews = mapped;
        }

        if (mapped.length < this.reviewsLimit) {
          this.hasMoreReviews = false;
        }

        this.reviewsSkip += mapped.length;
        this.loadingReviews = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingReviews = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadReviewStats() {
    this.http.get<any>(`${environment.apiBaseUrl}/api/reviews/stats`).subscribe({
      next: (data) => {
        this.reviewStats = data || { total_reviews: 0, happy_customers: 0 };
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  private checkScrollForMoreReviews() {
    if (this.loadingReviews || !this.hasMoreReviews) return;

    const threshold = 300;
    const position = window.scrollY + window.innerHeight;
    const height = document.documentElement.scrollHeight;

    if (position >= height - threshold) {
      this.loadReviews(true);
    }
  }

  private loadFeaturedPlans() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/api/menu/tiers`).subscribe({
      next: (data) => {
        const active = (data || [])
          .filter(t => t.is_active && (t.pricing?.length || 0) > 0)
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

        // Showcase up to 3 tiers on the home page; full catalogue lives at /plans.
        const top = active.slice(0, 3);

        // Admin-controlled "Most Popular" flag. Fall back to middle index if no tier is flagged.
        const featuredIdx = top.findIndex(t => t.is_featured);
        const popularIdx = featuredIdx >= 0 ? featuredIdx : (top.length >= 3 ? 1 : 0);

        this.featuredPlans = top.map((t, i) => this.toFeaturedPlan(t, i === popularIdx));
        this.plansLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        // Marketing page must still render even if the catalogue API is down —
        // just show a retry affordance instead of empty cards.
        this.featuredPlans = [];
        this.plansLoading = false;
        this.plansLoadFailed = true;
        this.cdr.markForCheck();
      },
    });
  }

  retryLoadPlans() {
    this.plansLoadFailed = false;
    this.plansLoading = true;
    this.loadFeaturedPlans();
  }

  private toFeaturedPlan(t: any, popular: boolean): FeaturedPlan {
    const prices: number[] = (t.pricing ?? []).map((p: any) => +p.price_per_meal).filter((n: number) => n > 0);
    const ppm = prices.length ? Math.min(...prices) : 0;
    const deliveryMonthly = +t.delivery_charge_monthly || 0;
    // Single-slot monthly plan = 24 meals; matches the "from ₹X /mo" framing on the card.
    const monthlyStart = Math.round((ppm + deliveryMonthly) * 24);

    const dietLabel =
      t.diet_support === 'veg_only' ? 'Veg only' :
      t.diet_support === 'nonveg_only' ? 'Non-veg only' :
      'Veg & Non-veg available';

    return {
      name: t.name,
      slug: t.slug,
      price: monthlyStart,
      subtitle: `${dietLabel} · 24 meals/month`,
      features: [
        'Breakfast or Dinner slot',
        'Mon–Sat delivery',
        'Weekly menu rotation',
        'Skip any day before 6 PM',
      ],
      popular,
    };
  }
}
