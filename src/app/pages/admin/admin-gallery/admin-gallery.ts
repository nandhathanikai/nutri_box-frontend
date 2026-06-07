import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { environment } from '../../../../environments/environment';

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

@Component({
  selector: 'app-admin-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, ToastModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-gallery.html',
  styleUrls: ['./admin-gallery.scss']
})
export class AdminGalleryComponent implements OnInit {
  images: GalleryImage[] = [];
  isLoading = false;
  isUploading = false;
  
  newCaption = '';
  selectedFile: File | null = null;
  uploadProgress = 0;

  constructor(
    private http: HttpClient,
    private msg: MessageService,
    private confirm: ConfirmationService
  ) {}

  ngOnInit() {
    this.fetchImages();
  }

  fetchImages() {
    this.isLoading = true;
    this.http.get<GalleryImage[]>(`${environment.apiBaseUrl}/api/gallery`).subscribe({
      next: (data) => {
        this.images = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.msg.add({ severity: 'error', summary: 'Connection issue', detail: 'Could not fetch gallery images.' });
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.msg.add({ severity: 'error', summary: 'File too large', detail: 'Images must be smaller than 5MB.' });
        return;
      }
      // Validate type
      if (!file.type.startsWith('image/')) {
        this.msg.add({ severity: 'error', summary: 'Invalid type', detail: 'Please select a valid image file.' });
        return;
      }
      this.selectedFile = file;
    }
  }

  triggerUpload() {
    if (this.images.length >= 10) {
      this.msg.add({ 
        severity: 'warn', 
        summary: 'Upload Limit Reached', 
        detail: 'Maximum limit of 10 gallery images reached. Please delete an image first.' 
      });
      return;
    }

    if (!this.selectedFile) {
      this.msg.add({ severity: 'warn', summary: 'No File Selected', detail: 'Please choose an image file to upload.' });
      return;
    }

    this.isUploading = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);

    // Step 1: Upload image to menu upload-image endpoint (Supabase/local fallback)
    this.http.post<{ image_url: string }>(`${environment.apiBaseUrl}/api/menu/upload-image`, formData).subscribe({
      next: (res) => {
        // Step 2: Register image inside gallery database
        const payload = {
          image_url: res.image_url,
          caption: this.newCaption.trim() || null,
          sort_order: this.images.length
        };

        this.http.post(`${environment.apiBaseUrl}/api/gallery`, payload).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Success', detail: 'Gallery image uploaded successfully!' });
            this.selectedFile = null;
            this.newCaption = '';
            this.isUploading = false;
            // Clear file input
            const fileInput = document.getElementById('galleryFileInput') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            
            this.fetchImages();
          },
          error: (err) => {
            this.isUploading = false;
            const errMsg = err.error?.detail || 'Failed to save gallery image database record.';
            this.msg.add({ severity: 'error', summary: 'Error', detail: errMsg });
          }
        });
      },
      error: (err) => {
        this.isUploading = false;
        const errMsg = err.error?.detail?.message || 'Image storage upload failed.';
        this.msg.add({ severity: 'error', summary: 'Storage Error', detail: errMsg });
      }
    });
  }

  deleteImage(image: GalleryImage) {
    this.confirm.confirm({
      message: 'Are you sure you want to delete this showcase image from the customer gallery?',
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.http.delete(`${environment.apiBaseUrl}/api/gallery/${image.id}`).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Deleted', detail: 'Showcase image deleted.' });
            this.fetchImages();
          },
          error: () => {
            this.msg.add({ severity: 'error', summary: 'Error', detail: 'Could not delete image.' });
          }
        });
      }
    });
  }
}
