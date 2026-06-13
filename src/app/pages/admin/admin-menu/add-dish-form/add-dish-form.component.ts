import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { FileUploadModule } from 'primeng/fileupload';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AdminService, Tier } from '../../../../services/admin.service';

@Component({
  selector: 'app-add-dish-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DialogModule,
    InputTextModule,
    InputGroupModule,
    InputGroupAddonModule,
    SelectModule,
    SelectButtonModule,
    TextareaModule,
    ButtonModule,
    ProgressSpinnerModule,
    SkeletonModule,
    FileUploadModule,
    IconFieldModule,
    InputIconModule,
    ToggleSwitchModule,
    CheckboxModule,
    ToastModule
  ],
  templateUrl: './add-dish-form.component.html',
  styleUrls: ['./add-dish-form.component.scss']
})
export class AddDishFormComponent implements OnInit {
  @Output() dishSaved = new EventEmitter<void>();
  @Output() closeDialog = new EventEmitter<void>();

  dishForm: FormGroup;
  tiers: any[] = [];
  isLoadingTiers = true;
  tiersLoadError = false;

  mealSlots = [
    { label: 'Breakfast', value: 'breakfast' },
    { label: 'Lunch', value: 'lunch' },
    { label: 'Dinner', value: 'dinner' }
  ];

  dietTypes = [
    { label: 'Veg', value: 'veg' },
    { label: 'Non-Veg', value: 'nonveg' }
  ];

  isSaving = false;
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileSizeStr: string | null = null;
  isDragging = false;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private messageService: MessageService
  ) {
    this.dishForm = this.fb.group({
      name: ['', Validators.required],
      tier_id: ['', Validators.required],
      meal_slot: [[], Validators.required],
      diet_type: ['', Validators.required],
      description: [''],
      calories: [null],
      is_active: [true],
      image_url: ['']
    });
  }

  ngOnInit() {
    this.loadTiers();
  }

  loadTiers() {
    this.isLoadingTiers = true;
    this.tiersLoadError = false;
    
    this.adminService.getTiers().subscribe({
      next: (data) => {
        this.tiers = data.map((t: Tier) => ({
          label: t.name,
          sub: `₹${t.price_per_meal} / meal`,
          value: t.id
        }));
        this.isLoadingTiers = false;
      },
      error: () => {
        this.isLoadingTiers = false;
        this.tiersLoadError = true;
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: any) {
    // Handling PrimeNG fileupload (basic mode emits event.files) or generic input
    const file = event.files ? event.files[0] : event.target?.files[0];
    if (file) {
      if (file.size > 5000000) {
        this.messageService.add({severity:'error', summary:'Error', detail:'File is larger than 5MB'});
        return;
      }
      this.handleFile(file);
    }
  }

  handleFile(file: File) {
    this.selectedFile = file;
    this.fileSizeStr = (file.size / 1024 / 1024).toFixed(2) + ' MB';
    const reader = new FileReader();
    reader.onload = e => this.imagePreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  removePreview() {
    this.selectedFile = null;
    this.imagePreview = null;
  }

  toggleMealSlot(slot: string) {
    const currentSlots = this.dishForm.get('meal_slot')?.value || [];
    if (currentSlots.includes(slot)) {
      this.dishForm.patchValue({
        meal_slot: currentSlots.filter((v: string) => v !== slot)
      });
    } else {
      this.dishForm.patchValue({
        meal_slot: [...currentSlots, slot]
      });
    }
    this.dishForm.get('meal_slot')?.markAsTouched();
  }

  onCancel() {
    this.closeDialog.emit();
  }

  saveDish() {
    if (this.dishForm.invalid || this.isLoadingTiers) return;
    this.isSaving = true;

    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('file', this.selectedFile);

      this.adminService.uploadDishImage(formData).subscribe({
        next: (res) => {
          this.dishForm.patchValue({ image_url: res.image_url });
          this.submitDish();
        },
        error: (err) => {
          const msg = err.error?.detail || 'Failed to upload image';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
          this.isSaving = false;
        }
      });
    } else {
      this.submitDish();
    }
  }

  private submitDish() {
    this.adminService.createDish(this.dishForm.value).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Dish added successfully' });
        this.dishSaved.emit();
        this.isSaving = false;
      },
      error: (err) => {
        const msg = err.error?.detail || 'Failed to save dish';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
        this.isSaving = false;
      }
    });
  }
}
