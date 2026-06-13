import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DatePickerModule } from 'primeng/datepicker';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { FileUploadModule } from 'primeng/fileupload';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { PaginatorModule } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { ErrorBannerComponent, ApiError } from '../../../components/error-banner/error-banner.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, CommonModule, TableModule, TabsModule, ButtonModule,
    DialogModule, InputTextModule, SelectModule, SelectButtonModule, DatePickerModule,
    InputGroupModule, InputGroupAddonModule, FileUploadModule, ToggleSwitchModule,
    ToastModule, ConfirmDialogModule, SkeletonModule, PaginatorModule, TooltipModule, TagModule,
    ErrorBannerComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './menu-management.component.html',
  styleUrls: ['./menu-management.component.scss']
})
export class MenuManagementComponent implements OnInit {
  apiUrl = `${environment.apiBaseUrl}/api/menu`;

  // ── Data ─────────────────────────────────────────────────────────────
  tiers: any[] = [];
  planCombinations: any[] = [];
  groupedPlansMap: Record<string, any[]> = {};
  isLoadingTiers = false;
  isLoadingPlans = false;
  isLoadingWeek = false;

  // ── Tab 0: Tier Settings ─────────────────────────────────────────────
  expandedTiers: Set<string> = new Set();
  pricingHistoryMap: Record<string, any[]> = {};
  pricingDialogTier: any = null;
  newPriceForm!: FormGroup;

  combinationDialog = false;
  isEditCombination = false;
  combinationForm!: FormGroup;
  selectedCombinationId: string | null = null;

  tierDialog = false;
  tierForm!: FormGroup;
  isEditMode = false;
  selectedTierId: string | null = null;
  today = new Date();

  dietSupportOptions = [
    { label: 'Veg & Non-Veg', value: 'both' },
    { label: 'Veg Only', value: 'veg_only' },
    { label: 'Non-Veg Only', value: 'nonveg_only' },
  ];

  // ── Tab 1: Weekly Images ─────────────────────────────────────────────
  selectedWeekDate: Date = this.getMondayOfCurrentWeek();
  showDatePicker = false;
  weeklyImages: any[] = [];
  coverageGrid: any[] = [];          // flat list [{tier_id, tier_name, tier_slug, diet_type, has_image, image_url?}]

  uploadForm!: FormGroup;
  uploadPreview: string | null = null;
  uploadingImage = false;
  activeCoverageCell: any = null;   // cell currently selected in coverage grid

  /** Structured error from backend (Supabase / storage errors) */
  uploadError: ApiError | null = null;

  // ── Tab 2: Plan Matrix ───────────────────────────────────────────────
  readonly slotCombos = ['breakfast_only', 'dinner_only', 'both'];
  readonly durations = ['weekly', 'monthly'];
  readonly slotLabels: Record<string, string> = {
    breakfast_only: 'Breakfast\nOnly',
    dinner_only: 'Dinner\nOnly',
    both: 'Breakfast\n+ Dinner',
  };

  mobileFilters = {
    tier_id: '',
    diet_type: '',
    duration: '',
    slot_combo: ''
  };

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
  ) {
    this.initForms();
  }

  ngOnInit() {
    this.loadTiers();
    this.loadPlans();
  }

  // ── Forms ─────────────────────────────────────────────────────────────

  initForms() {
    this.newPriceForm = this.fb.group({
      diet_type: ['veg', Validators.required],
      price_per_meal: [0, [Validators.required, Validators.min(1)]],
      effective_from: [new Date(), Validators.required],
    });

    this.tierForm = this.fb.group({
      name: ['', Validators.required],
      diet_support: ['both', Validators.required],
      delivery_charge_weekly: [10, Validators.min(0)],
      delivery_charge_monthly: [0, Validators.min(0)],
      is_active: [true],
      is_featured: [false],
    });

    this.uploadForm = this.fb.group({
      tier_id: ['', Validators.required],
      diet_type: ['both', Validators.required],
      week_start_date: [this.selectedWeekDate, Validators.required],
    });

    this.combinationForm = this.fb.group({
      tier_id: ['', Validators.required],
      diet_type: ['veg', Validators.required],
      duration: ['weekly', Validators.required],
      slot_combo: ['breakfast_only', Validators.required],
      meal_count: [null],
      price: [null],
      delivery_charge: [null],
    });
  }

  // ── DATA LOADERS ──────────────────────────────────────────────────────

  loadTiers() {
    this.isLoadingTiers = true;
    this.http.get<any[]>(`${this.apiUrl}/tiers`).subscribe({
      next: (data) => {
        this.tiers = data;
        for (let t of this.tiers) {
          const vegPrice = t.pricing.find((p: any) => p.diet_type === 'veg')?.price_per_meal;
          const nonvegPrice = t.pricing.find((p: any) => p.diet_type === 'nonveg')?.price_per_meal;
          t.veg_price_input = vegPrice || 0;
          t.nonveg_price_input = nonvegPrice || 0;
        }
        this.isLoadingTiers = false;
        this.buildCoverageGrid();
        this.groupAllPlans();
      },
      error: () => this.isLoadingTiers = false,
    });
  }

  loadPlans() {
    this.isLoadingPlans = true;
    this.http.get<any[]>(`${this.apiUrl}/plan-combinations`).subscribe({
      next: (data) => {
        this.planCombinations = data;
        this.isLoadingPlans = false;
        this.groupAllPlans();
      },
      error: () => this.isLoadingPlans = false,
    });
  }

  loadPricingHistory(tierId: string) {
    this.http.get<any[]>(`${this.apiUrl}/tiers/${tierId}/pricing`).subscribe({
      next: (data) => this.pricingHistoryMap[tierId] = data,
    });
  }

  loadWeeklyImages() {
    const dateStr = this.formatDate(this.selectedWeekDate);
    this.http.get<any>(`${this.apiUrl}/weekly-menu-images?week_start_date=${dateStr}`).subscribe({
      next: (data) => {
        this.weeklyImages = data.images || [];
        this.mergeCoverage(data.coverage_status || []);
      },
    });
  }

  // ── TIER ACTIONS ──────────────────────────────────────────────────────

  toggleExpand(tier: any) {
    const id = tier.id;
    if (this.expandedTiers.has(id)) {
      this.expandedTiers.delete(id);
    } else {
      this.expandedTiers.add(id);
      if (!this.pricingHistoryMap[id]) {
        this.loadPricingHistory(id);
      }
    }
  }

  isExpanded(tier: any): boolean {
    return this.expandedTiers.has(tier.id);
  }

  getPricingHistory(tierId: string): any[] {
    return this.pricingHistoryMap[tierId] || [];
  }

  getPricingOptions(tier: any) {
    if (tier.diet_support === 'veg_only') return [{ label: 'Veg', value: 'veg' }];
    if (tier.diet_support === 'nonveg_only') return [{ label: 'Non-Veg', value: 'nonveg' }];
    return [{ label: 'Veg', value: 'veg' }, { label: 'Non-Veg', value: 'nonveg' }];
  }

  openPricingForm(tier: any) {
    this.pricingDialogTier = tier;
    this.newPriceForm.reset({
      diet_type: 'veg',
      price_per_meal: 0,
      effective_from: new Date(),
    });
    this.loadPricingHistory(tier.id);
  }

  closePricingForm() {
    this.pricingDialogTier = null;
  }

  saveNewPrice() {
    if (this.newPriceForm.invalid || !this.pricingDialogTier) return;
    const val = this.newPriceForm.value;
    const payload = {
      diet_type: val.diet_type,
      price_per_meal: val.price_per_meal,
      effective_from: this.formatDate(val.effective_from),
    };

    this.http.post(`${this.apiUrl}/tiers/${this.pricingDialogTier.id}/pricing`, payload).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Price Rule Added' });
        this.loadPricingHistory(this.pricingDialogTier.id);
        // Update the in-memory expanded list too
        if (this.expandedTiers.has(this.pricingDialogTier.id)) {
          this.loadPricingHistory(this.pricingDialogTier.id);
        }
        this.loadTiers(); // Refresh pricing badges on tier rows
      },
      error: (err) => {
        const msg = err.error?.detail || 'Failed to add price rule';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      },
    });
  }

  togglePricingActive(row: any) {
    this.http.patch(`${this.apiUrl}/tier-pricing/${row.id}`, { is_active: row.is_active }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Pricing Updated' });
        this.loadTiers();
        this.loadPlans();
      },
      error: () => row.is_active = !row.is_active,
    });
  }

  deletePricingRule(rule: any, tierId: string) {
    this.confirmationService.confirm({
      message: `Delete this pricing rule (₹${rule.price_per_meal} for ${rule.diet_type === 'veg' ? 'Veg' : 'Non-Veg'})?`,
      header: 'Delete Price Rule',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.http.delete(`${this.apiUrl}/tier-pricing/${rule.id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Price Rule Deleted' });
            this.loadPricingHistory(tierId);
            this.loadTiers();
            this.loadPlans();
          },
          error: (err) => {
            const msg = err.error?.detail || 'Failed to delete price rule';
            this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
          }
        });
      }
    });
  }

  toggleTierActive(tier: any) {
    this.http.put(`${this.apiUrl}/tiers/${tier.id}`, { is_active: tier.is_active }).subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Tier status updated' }),
      error: () => tier.is_active = !tier.is_active,
    });
  }

  updateTierDelivery(tier: any) {
    this.http.put(`${this.apiUrl}/tiers/${tier.id}`, {
      delivery_charge_weekly: tier.delivery_charge_weekly,
      delivery_charge_monthly: tier.delivery_charge_monthly,
    }).subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Delivery charges updated' }),
    });
  }

  reorderTiers(event: any) {
    const reorderPayload = this.tiers.map((t, idx) => ({ id: t.id, display_order: idx }));
    this.http.patch(`${this.apiUrl}/tiers/reorder`, reorderPayload).subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Order saved' }),
    });
  }

  openNewTier() {
    this.isEditMode = false;
    this.selectedTierId = null;
    this.tierForm.reset({ diet_support: 'both', is_active: true, is_featured: false, delivery_charge_weekly: 10, delivery_charge_monthly: 0 });
    this.tierDialog = true;
  }

  editTier(tier: any) {
    this.isEditMode = true;
    this.selectedTierId = tier.id;
    this.tierForm.patchValue({
      name: tier.name,
      diet_support: tier.diet_support,
      delivery_charge_weekly: tier.delivery_charge_weekly,
      delivery_charge_monthly: tier.delivery_charge_monthly,
      is_active: tier.is_active,
      is_featured: !!tier.is_featured,
    });
    this.tierDialog = true;
  }

  confirmDeleteTier(tier: any) {
    this.confirmationService.confirm({
      message: `Delete the "${tier.name}" tier? This permanently removes its pricing rows, weekly menu images, and plan combinations. This cannot be undone.`,
      header: 'Delete tier',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.http.delete(`${this.apiUrl}/tiers/${tier.id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Tier deleted', detail: `${tier.name} removed.` });
            this.loadTiers();
            this.loadPlans();
          },
          error: (err) => {
            const detail = err.error?.detail || 'Could not delete tier.';
            this.messageService.add({ severity: 'error', summary: 'Delete failed', detail });
          }
        });
      }
    });
  }

  saveTier() {
    if (this.tierForm.invalid) return;
    const val = this.tierForm.value;
    // Never send slug — backend auto-generates it
    const payload = {
      name: val.name,
      diet_support: val.diet_support,
      delivery_charge_weekly: val.delivery_charge_weekly,
      delivery_charge_monthly: val.delivery_charge_monthly,
      is_active: val.is_active,
      is_featured: val.is_featured,
    };

    const req = this.isEditMode && this.selectedTierId
      ? this.http.put(`${this.apiUrl}/tiers/${this.selectedTierId}`, payload)
      : this.http.post(`${this.apiUrl}/tiers`, payload);

    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: this.isEditMode ? 'Tier Updated' : 'Tier Created' });
        this.tierDialog = false;
        this.loadTiers();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Failed to save tier';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      },
    });
  }

  updateBasePrice(tier: any, dietType: 'veg' | 'nonveg') {
    const price = dietType === 'veg' ? tier.veg_price_input : tier.nonveg_price_input;
    if (price === undefined || price === null || price <= 0) {
      this.messageService.add({ severity: 'error', summary: 'Invalid Price', detail: 'Price must be greater than 0' });
      return;
    }
    const payload = {
      diet_type: dietType,
      price_per_meal: price,
      effective_from: this.formatDate(new Date())
    };
    this.http.post(`${this.apiUrl}/tiers/${tier.id}/pricing`, payload).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Price Updated', detail: `Successfully updated ${dietType === 'veg' ? 'Veg' : 'Non-Veg'} price to ₹${price}` });
        this.loadTiers();
        this.loadPlans();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Failed to update price';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  groupAllPlans() {
    if (!this.tiers.length || !this.planCombinations.length) return;
    this.groupedPlansMap = {};
    for (let tier of this.tiers) {
      this.groupedPlansMap[tier.id] = this.calculateGroupedPlansForTier(tier.id);
    }
  }

  calculateGroupedPlansForTier(tierId: string) {
    const plans = this.planCombinations.filter(p => p.tier_id === tierId);
    const grouped: any[] = [];
    const diets = ['veg', 'nonveg'];
    const durations = ['weekly', 'monthly'];

    for (let diet of diets) {
      for (let duration of durations) {
        // 1. Single Meal (Breakfast Only / Dinner Only)
        const singlePlans = plans.filter(
          p => p.tier_id === tierId && p.diet_type === diet && p.duration === duration &&
            (p.slot_combo === 'breakfast_only' || p.slot_combo === 'dinner_only')
        );
        if (singlePlans.length > 0) {
          const rep = singlePlans[0];
          grouped.push({
            id: rep.id,
            diet_type: diet,
            duration: duration,
            meal_type: 'Single Meal',
            meal_count: rep.meal_count || (duration === 'weekly' ? 6 : 24),
            delivery_charge: rep.delivery_charge,
            total_price: rep.total_price,
            is_active: singlePlans.every(p => p.is_active),
            linked_plans: singlePlans,
            tier_id: rep.tier_id,
            slot_combo: rep.slot_combo,
            override_price: rep.override_price,
            override_delivery_charge: rep.override_delivery_charge
          });
        }

        // 2. Double Meal (Both)
        const doublePlans = plans.filter(
          p => p.tier_id === tierId && p.diet_type === diet && p.duration === duration &&
            p.slot_combo === 'both'
        );
        if (doublePlans.length > 0) {
          const rep = doublePlans[0];
          grouped.push({
            id: rep.id,
            diet_type: diet,
            duration: duration,
            meal_type: 'Double Meal',
            meal_count: rep.meal_count || (duration === 'weekly' ? 12 : 48),
            delivery_charge: rep.delivery_charge,
            total_price: rep.total_price,
            is_active: rep.is_active,
            linked_plans: doublePlans,
            tier_id: rep.tier_id,
            slot_combo: rep.slot_combo,
            override_price: rep.override_price,
            override_delivery_charge: rep.override_delivery_charge
          });
        }
      }
    }
    return grouped;
  }

  toggleGroupedPlanActive(group: any) {
    let successCount = 0;
    const total = group.linked_plans.length;
    group.linked_plans.forEach((plan: any) => {
      plan.is_active = group.is_active;
      this.http.patch(`${this.apiUrl}/plan-combinations/${plan.id}`, { is_active: plan.is_active }).subscribe({
        next: () => {
          successCount++;
          if (successCount === total) {
            this.messageService.add({
              severity: 'success',
              summary: 'Plan Status Updated',
              detail: `Updated availability status for ${group.diet_type === 'veg' ? 'Veg' : 'Non-Veg'} ${group.duration} ${group.meal_type}`
            });
          }
        },
        error: () => plan.is_active = !plan.is_active
      });
    });
  }

  openNewCombination(tierId: string) {
    this.isEditCombination = false;
    this.selectedCombinationId = null;
    this.combinationForm.reset({
      tier_id: tierId,
      diet_type: 'veg',
      duration: 'weekly',
      slot_combo: 'breakfast_only',
      meal_count: null,
      price: null,
      delivery_charge: null,
    });
    this.combinationDialog = true;
  }

  editCombination(group: any) {
    this.isEditCombination = true;
    this.selectedCombinationId = group.id;

    const rep = group.linked_plans[0];
    this.combinationForm.patchValue({
      tier_id: rep.tier_id,
      diet_type: rep.diet_type,
      duration: rep.duration,
      slot_combo: rep.slot_combo,
      meal_count: rep.meal_count,
      price: rep.override_price !== undefined ? rep.override_price : null,
      delivery_charge: rep.override_delivery_charge !== undefined ? rep.override_delivery_charge : null,
    });

    this.combinationDialog = true;
  }

  saveCombination() {
    if (this.combinationForm.invalid) return;
    const formVals = this.combinationForm.value;

    if (this.isEditCombination && this.selectedCombinationId) {
      // Find the group we are editing
      const groupedPlans = this.groupedPlansMap[formVals.tier_id] || [];
      const group = groupedPlans.find((g: any) => g.id === this.selectedCombinationId);
      if (group) {
        let successCount = 0;
        const total = group.linked_plans.length;
        group.linked_plans.forEach((plan: any) => {
          const payload = {
            price: formVals.price === null || formVals.price === '' ? -1 : formVals.price,
            delivery_charge: formVals.delivery_charge === null || formVals.delivery_charge === '' ? -1 : formVals.delivery_charge,
            meal_count: formVals.meal_count
          };
          this.http.patch(`${this.apiUrl}/plan-combinations/${plan.id}`, payload).subscribe({
            next: () => {
              successCount++;
              if (successCount === total) {
                this.messageService.add({ severity: 'success', summary: 'Combination Updated', detail: 'Successfully updated combination settings' });
                this.combinationDialog = false;
                this.loadPlans();
              }
            }
          });
        });
      }
    } else {
      // Creating a new combination
      const payload = {
        tier_id: formVals.tier_id,
        diet_type: formVals.diet_type,
        duration: formVals.duration,
        slot_combo: formVals.slot_combo,
        meal_count: formVals.meal_count || (formVals.slot_combo === 'both' ? (formVals.duration === 'weekly' ? 12 : 48) : (formVals.duration === 'weekly' ? 6 : 24)),
        price: formVals.price === '' ? null : formVals.price,
        delivery_charge: formVals.delivery_charge === '' ? null : formVals.delivery_charge
      };

      this.http.post(`${this.apiUrl}/plan-combinations`, payload).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Combination Created', detail: 'Successfully created plan combination' });
          this.combinationDialog = false;
          this.loadPlans();
        },
        error: (err) => {
          const msg = err.error?.detail || 'Failed to create plan combination';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
        }
      });
    }
  }

  getPlansForTierDiet(tierId: string, diet: string, duration: string) {
    return this.planCombinations.filter(
      p => p.tier_id === tierId && p.diet_type === diet && p.duration === duration
    );
  }

  getPlan(tierId: string, diet: string, slotCombo: string, duration: string): any | null {
    return this.planCombinations.find(
      p => p.tier_id === tierId && p.diet_type === diet && p.slot_combo === slotCombo && p.duration === duration
    ) ?? null;
  }

  togglePlanActive(plan: any) {
    this.http.patch(`${this.apiUrl}/plan-combinations/${plan.id}`, { is_active: plan.is_active }).subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Plan Updated' }),
      error: () => plan.is_active = !plan.is_active,
    });
  }

  enableAllForTier(tier: any) {
    const plans = this.planCombinations.filter(p => p.tier_id === tier.id && !p.is_active);
    plans.forEach(p => {
      p.is_active = true;
      this.togglePlanActive(p);
    });
  }

  disableAllForTier(tier: any) {
    const plans = this.planCombinations.filter(p => p.tier_id === tier.id && p.is_active);
    plans.forEach(p => {
      p.is_active = false;
      this.togglePlanActive(p);
    });
  }

  getPlanTooltip(plan: any): string {
    if (!plan) return '';
    return `₹${plan.price_per_meal} × ${plan.meal_count} meals + ₹${plan.delivery_charge} delivery`;
  }

  getPlanPrice(plan: any): string {
    if (!plan) return '—';
    return `₹${plan.total_price}`;
  }

  getFilteredPlans() {
    return this.planCombinations.filter(p => {
      if (this.mobileFilters.tier_id && p.tier_id !== this.mobileFilters.tier_id) return false;
      if (this.mobileFilters.diet_type && p.diet_type !== this.mobileFilters.diet_type) return false;
      if (this.mobileFilters.duration && p.duration !== this.mobileFilters.duration) return false;
      if (this.mobileFilters.slot_combo && p.slot_combo !== this.mobileFilters.slot_combo) return false;
      return true;
    });
  }

  getFilteredPlansGroupedByTier() {
    const filtered = this.getFilteredPlans();
    const groups = [];
    for (const tier of this.tiers) {
      const plansForTier = filtered.filter(p => p.tier_id === tier.id);
      if (plansForTier.length > 0) {
        groups.push({
          tier: tier,
          plans: plansForTier
        });
      }
    }
    return groups;
  }

  getTierName(tierId: string): string {
    const t = this.tiers.find(x => x.id === tierId);
    return t ? t.name : 'Unknown';
  }

  getComboTitle(plan: any): string {
    const slot = plan.slot_combo === 'breakfast_only' ? 'Breakfast'
      : plan.slot_combo === 'dinner_only' ? 'Dinner'
        : 'Breakfast + Dinner';
    const dur = plan.duration === 'weekly' ? 'Weekly' : 'Monthly';
    return `${slot} • ${dur}`;
  }

  // ── WEEKLY IMAGES ─────────────────────────────────────────────────────

  buildCoverageGrid() {
    this.coverageGrid = [];
    for (const tier of this.tiers) {
      const diets = tier.diet_support === 'veg_only' ? ['veg']
        : tier.diet_support === 'nonveg_only' ? ['nonveg']
          : ['veg', 'nonveg'];
      for (const dt of diets) {
        this.coverageGrid.push({
          tier_id: tier.id,
          tier_name: tier.name,
          tier_slug: tier.slug,
          diet_type: dt,
          has_image: false,
          image_url: null,
        });
      }
    }
    this.loadWeeklyImages();
  }

  mergeCoverage(coverageStatus: any[]) {
    // Reset
    for (const cell of this.coverageGrid) {
      cell.has_image = false;
      cell.image_url = null;
    }
    // Fill from API response
    for (const status of coverageStatus) {
      const cell = this.coverageGrid.find(
        c => c.tier_id === status.tier_id && c.diet_type === status.diet_type
      );
      if (cell) {
        cell.has_image = status.has_image;
        // Find actual image_url from the images array
        const img = this.weeklyImages.find(
          i => i.tier_id === status.tier_id && i.diet_type === status.diet_type
        );
        cell.image_url = img?.image_url || null;
      }
    }
  }

  onDateSelect(d: Date) {
    this.showDatePicker = false;
    const monday = this.normalizeToMonday(d);
    this.selectedWeekDate = monday;
    this.uploadForm.patchValue({ week_start_date: monday });
    this.loadWeeklyImages();
  }

  selectCoverageCell(cell: any) {
    this.activeCoverageCell = cell;
    this.uploadForm.patchValue({
      tier_id: cell.tier_id,
      diet_type: cell.diet_type,
    });
    this.uploadPreview = cell.image_url || null;
  }

  onFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.uploadForm.invalid) {
      this.messageService.add({ severity: 'warn', summary: 'Select tier and diet type first' });
      return;
    }

    // Clear any previous error before retrying
    this.uploadError = null;

    const fd = new FormData();
    fd.append('file', file);
    this.uploadingImage = true;

    this.http.post<{ image_url: string }>(`${this.apiUrl}/upload-image`, fd).subscribe({
      next: (res) => {
        this.uploadPreview = res.image_url;
        this.uploadingImage = false;
        this.uploadError = null;
      },
      error: (err) => {
        this.uploadingImage = false;
        // Try to extract a structured error detail from the backend response
        const detail = err.error?.detail;
        if (detail && typeof detail === 'object' && detail.error_type) {
          // Structured Supabase / storage error
          this.uploadError = detail as ApiError;
        } else if (typeof detail === 'string') {
          // Plain string error (older endpoints)
          this.uploadError = {
            error_type: 'upload_failed',
            message: detail,
            raw: JSON.stringify(err.error),
          };
        } else {
          // Totally unknown error
          this.uploadError = {
            error_type: 'upload_failed',
            message: 'Image upload failed. Please check your connection and try again.',
            raw: JSON.stringify(err.error ?? err.message),
          };
        }
        // Also show a toast for quick feedback
        this.messageService.add({
          severity: 'error',
          summary: 'Upload failed',
          detail: this.uploadError.message,
          life: 6000,
        });
      },
    });
  }

  clearUploadError() {
    this.uploadError = null;
  }

  publishMenuImage() {
    if (!this.uploadPreview) {
      this.messageService.add({ severity: 'warn', summary: 'No image to publish' });
      return;
    }
    const val = this.uploadForm.value;
    const payload = {
      tier_id: val.tier_id,
      diet_type: val.diet_type,
      week_start_date: this.formatDate(val.week_start_date || this.selectedWeekDate),
      image_url: this.uploadPreview,
    };

    this.http.post(`${this.apiUrl}/weekly-menu-images`, payload).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Published!' });
        this.uploadPreview = null;
        this.activeCoverageCell = null;
        this.loadWeeklyImages();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Failed to publish';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      },
    });
  }

  deleteImage(cell: any) {
    // Find the image record id by querying — for simplicity, we reload and find the id
    const dateStr = this.formatDate(this.selectedWeekDate);
    this.http.get<any>(`${this.apiUrl}/weekly-menu-images?week_start_date=${dateStr}&tier_id=${cell.tier_id}&diet_type=${cell.diet_type}`).subscribe({
      next: (data) => {
        const found = data.images?.[0];
        if (!found) return;
        this.http.delete(`${this.apiUrl}/weekly-menu-images/${found.id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Image removed' });
            this.loadWeeklyImages();
            if (this.activeCoverageCell?.tier_id === cell.tier_id && this.activeCoverageCell?.diet_type === cell.diet_type) {
              this.uploadPreview = null;
            }
          },
        });
      },
    });
  }

  copyPreviousWeek() {
    const current = new Date(this.selectedWeekDate);
    const lastWeek = new Date(current);
    lastWeek.setDate(current.getDate() - 7);

    const payload = {
      source_week: this.formatDate(lastWeek),
      target_week: this.formatDate(current),
    };

    this.http.post<any>(`${this.apiUrl}/weekly-menu-images/copy-week`, payload).subscribe({
      next: (res) => {
        this.messageService.add({
          severity: 'success',
          summary: `Copied ${res.copied}, skipped ${res.skipped}`,
        });
        this.loadWeeklyImages();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Copy failed' }),
    });
  }

  clearUploadPreview() {
    this.uploadPreview = null;
  }

  getDietOptions(tier: any) {
    if (!tier) return [{ label: 'Veg', value: 'veg' }, { label: 'Non-Veg', value: 'nonveg' }, { label: 'Both', value: 'both' }];
    if (tier.diet_support === 'veg_only') return [{ label: 'Veg', value: 'veg' }];
    if (tier.diet_support === 'nonveg_only') return [{ label: 'Non-Veg', value: 'nonveg' }];
    return [{ label: 'Veg', value: 'veg' }, { label: 'Non-Veg', value: 'nonveg' }, { label: 'Both (same image)', value: 'both' }];
  }

  getSelectedTierForUpload(): any {
    const tid = this.uploadForm.value.tier_id;
    return this.tiers.find(t => t.id === tid) || null;
  }

  // ── HELPERS ───────────────────────────────────────────────────────────

  getMondayOfCurrentWeek(): Date {
    const d = new Date();
    const day = d.getDay(); // 0=Sun, 1=Mon...
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  normalizeToMonday(d: Date): Date {
    const result = new Date(d);
    const day = result.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  formatDate(d: Date | string): string {
    if (typeof d === 'string') return d;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getTierBadgeClass(slug: string): string {
    const map: Record<string, string> = {
      protein_rich: 'tier-protein_rich',
      classic: 'tier-classic',
      premium: 'tier-premium',
      fruits_bowl: 'tier-fruits_bowl',
    };
    return map[slug] ?? 'tier-classic';
  }

  getTierIcon(slug: string): string {
    const map: Record<string, string> = {
      protein_rich: 'pi pi-bolt',
      classic: 'pi pi-star',
      premium: 'pi pi-crown',
      fruits_bowl: 'pi pi-apple',
    };
    return map[slug] ?? 'pi pi-circle';
  }

  getStartingPrice(tier: any): number {
    if (!tier.pricing?.length) return 0;
    return Math.min(...tier.pricing.map((p: any) => p.price_per_meal));
  }

  generateDisplayName(tierName: string, dietType: string, slotCombo: string, duration: string): string {
    const diet = dietType === 'veg' ? 'Veg' : 'Non-Veg';
    const slot = slotCombo === 'breakfast_only' ? 'Breakfast Only'
      : slotCombo === 'dinner_only' ? 'Dinner Only'
        : 'Breakfast + Dinner';
    const dur = duration === 'weekly' ? 'Weekly' : 'Monthly';
    return `${tierName} · ${diet} · ${slot} · ${dur}`;
  }
}
