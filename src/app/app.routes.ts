import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { LoginComponent } from './pages/login/login';
import { SignupComponent } from './pages/signup/signup';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { PlansComponent } from './pages/plans/plans';
import { ProfileComponent } from './pages/profile/profile';
import { CreditsComponent } from './pages/credits/credits.component';
import { NotFoundComponent } from './pages/not-found/not-found';
import { CustomPlanComponent } from './pages/plans/custom-plan/custom-plan';
import { VerifyEmailComponent } from './pages/verify-email/verify-email';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

// Admin components
import { AdminLayoutComponent } from './pages/admin/admin-layout/admin-layout';
import { AdminDashboardComponent } from './pages/admin/admin-dashboard/admin-dashboard';
import { AdminTodaysOrdersComponent } from './pages/admin/admin-todays-orders/admin-todays-orders';
import { AdminCustomersComponent } from './pages/admin/admin-customers/admin-customers';
import { MenuManagementComponent } from './pages/admin/menu-management/menu-management.component';
import { AdminCreditsComponent } from './pages/admin/admin-credits/admin-credits';
import { AdminAnnouncementsComponent } from './pages/admin/admin-announcements/admin-announcements';
import { AdminOffersComponent } from './pages/admin/admin-offers/admin-offers';
import { AdminReportsComponent } from './pages/admin/admin-reports/admin-reports';
import { AdminSettingsComponent } from './pages/admin/admin-settings/admin-settings';
import { AdminRequestsComponent } from './pages/admin/admin-requests/admin-requests';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'dashboard/credits', component: CreditsComponent, canActivate: [authGuard] },
  { path: 'plans', component: PlansComponent, canActivate: [authGuard] },
  { path: 'plans/custom', component: CustomPlanComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },

  // Admin section
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'todays-orders', component: AdminTodaysOrdersComponent },
      { path: 'customers', component: AdminCustomersComponent },
      { path: 'menu', component: MenuManagementComponent },
      { path: 'credits', component: AdminCreditsComponent },
      { path: 'announcements', component: AdminAnnouncementsComponent },
      { path: 'offers', component: AdminOffersComponent },
      { path: 'reports', component: AdminReportsComponent },
      { path: 'settings', component: AdminSettingsComponent },
      { path: 'custom-requests', component: AdminRequestsComponent },
    ]
  },

  // Email verification (token comes from the backend email link)
  { path: 'verify-email', component: VerifyEmailComponent },

  // 404 catch-all — must be last
  { path: '**', component: NotFoundComponent },
];
