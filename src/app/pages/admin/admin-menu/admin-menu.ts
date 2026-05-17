import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AdminService, Menu } from '../../../services/admin.service';
import { AddDishFormComponent } from './add-dish-form/add-dish-form.component';

@Component({
  selector: 'app-admin-menu',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    TableModule, 
    ButtonModule, 
    DialogModule, 
    InputTextModule, 
    InputNumberModule, 
    SelectModule, 
    TextareaModule,
    FileUploadModule,
    ToastModule,
    ConfirmDialogModule,
    AddDishFormComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-menu.html',
  styleUrls: ['./admin-menu.scss']})
export class AdminMenuComponent implements OnInit {
  menus: Menu[] = [];
  menuDialog: boolean = false;
  menu: Menu = this.createEmptyMenu();
  isEditMode: boolean = false;
  isLoading: boolean = true;

  constructor(
    private adminService: AdminService,
    private messageService: MessageService,
    private confirm: ConfirmationService,
  ) {}

  ngOnInit() {
    this.loadMenus();
  }

  loadMenus() {
    this.isLoading = true;
    this.adminService.getMenus().subscribe({
      next: (data) => {
        this.menus = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Could not load menus',
          detail: 'Please refresh the page or try again shortly.',
        });
      }
    });
  }

  createEmptyMenu(): Menu {
    return {
      menu_name: ''
    };
  }

  openNew() {
    this.menuDialog = true;
  }

  editMenu(menu: Menu) {
    this.menu = { ...menu };
    this.isEditMode = true;
    this.menuDialog = true;
  }

  deleteMenu(menu: Menu) {
    if (!menu.id) return;
    this.confirm.confirm({
      header: 'Delete menu?',
      message: `"${menu.menu_name}" will be permanently removed.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      acceptButtonStyleClass: 'p-button-danger',
      rejectLabel: 'Cancel',
      accept: () => {
        this.adminService.deleteMenu(menu.id!).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `${menu.menu_name} removed.` });
            this.loadMenus();
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Delete failed', detail: 'Please try again.' }),
        });
      }
    });
  }

  hideDialog() {
    this.menuDialog = false;
  }

  onDishSaved() {
    this.menuDialog = false;
    this.loadMenus(); // reload dishes/menus
  }


}
