# Nutribox Project Overview
**For AI Context & Developer Handoff**

## 1. Project Goal & Identity
**Nutribox** is a premium, full-stack web application for a modern meal subscription service. It focuses on a cinematic, high-end user experience reminiscent of editorial platforms, offering organic sourcing, chef-curated menus, and seamless delivery management.

## 2. Tech Stack Overview
### **Frontend (Angular)**
- **Framework:** Angular 17+ (using Standalone Components, no NgModules).
- **Styling:** SCSS, integrated with PrimeNG (Aura theme) for robust UI components (buttons, inputs, toggles, toast notifications, badges). Custom CSS is heavy on modern aesthetics, glassmorphism, and responsive grid layouts.
- **Routing:** Angular Router (configured in `app.routes.ts`) handles page transitions.

### **Backend (Python / FastAPI)**
- **Framework:** FastAPI.
- **Database Engine & ORM:** PostgreSQL managed via SQLAlchemy.
- **Authentication:** JWT-based stateless authentication (`passlib`, `python-jose`), utilizing OAuth2PasswordBearer flows.

---

## 3. Design Aesthetics & UI System
Nutribox employs a highly premium, cinematic aesthetic designed to wow users upon entry and keep them engaged through subtle interactions.

- **Color Palette:** A rich monochrome, deep-green and charcoal thematic approach.
  - Generous usage of `$black (#0a0a0a)` and deep hunter greens (`#081510`, `#1b3a2d`) for primary branding and backgrounds.
  - Soft accents: `$silver (#ababab)`, `$muted (#6b6b6b)`, `$offwhite (#f4f4f4)` to prevent high-contrast eye strain.
- **Typography:** **Plus Jakarta Sans** and **Inter** are used for all typography, featuring tight tracking on large headers (letter spacing: `-0.6px`) to mimic editorial layouts.
- **Layout & Interaction:**
  - Glassmorphism features (backdrop blur, low-opacity white borders) on overlay cards.
  - Micro-animations: Buttons elevate `translateY(-1px)` and cast soft shadows on hover. Avatars scale `scale(1.07)` smoothly.
  - Form Layouts: Forms utilize heavily rounded (`border-radius: 6px to 10px`) clean inputs that highlight on focus, combined with floating icons.
  - Parallax & Video Integration: The home/landing elements seamlessly blend video and parallax foreground layers (dynamic scroll-triggered elements) to pull users in.

---

## 4. Comprehensive Page Functionality

### A. Public Pages
- **Home / Landing Page (`/home`):**
  - **Function:** Serves as the public entry point and primary marketing vehicle.
  - **Design/Features:** Cinematic video backgrounds, transparent parallax layers that move relative to scroll, and dynamic "falling" UI elements.
  - **Logic:** Unauthenticated users trying to reach protected routes automatically fall back to here.

- **Login Page (`/login`):**
  - **Function:** JWT authentication gateway.
  - **Design/Features:** Split-screen or card-based layout featuring a stylized background image overlay.
  - **Logic:** Calls `POST /api/auth/login/json`, sets `auth_token` in `localStorage`, initializes the 20-minute session timer, and fires router navigation to `/dashboard`. Contains links to Signup and Forgot Password.

- **Signup Wizard (`/signup`):**
  - **Function:** 2-Step Registration Process.
  - **Step 1 (Primary Details):** Captures Name, Email, Phone, and Password. Includes live password validation (minimum char length, special chars).
    - **Smart Validation:** Triggers a `GET /api/auth/check-email` before proceeding. If the email exists, an inline amber warning banner appears dynamically underneath the input box asking them to login.
  - **Step 2 (Address Details):** Captures detailed location data (Address 1 & 2, Landmark, Google Maps Link). A progress indicator tracks the steps. Posts to `POST /api/auth/signup` and routes to login on success.

- **Forgot Password (`/forgot-password`):**
  - **Function:** Recovery mechanism.
  - **Design/Features:** 3-Step animated slide-through wizard.
  - **Logic:**
    1. Send email (triggers Node/backend emailer, saves OTP).
    2. Input 6-digit OTP (verified strictly).
    3. Input new password (hashed and saved).

### B. Authenticated Features (Protected by AuthGuard)
- **Dashboard (`/dashboard`):**
  - **Function:** Central user control pane.
  - **Design/Features:** Features dynamic, time-based greetings ("Good Evening, Nandha"). Shows quick-view cards for current meal plan, upcoming delivery day, and macro-nutritional goals.

- **Plans (`/plans`):**
  - **Function:** Subscription catalog.
  - **Design/Features:** Grid-based presentation of meal plans (e.g. Keto, Balanced, Vegan) utilizing primeNG cards, rich imagery, and distinct accent colors to differentiate plan tiers safely.

- **User Profile (`/profile`):**
  - **Function:** Account preferences and irreversible actions.
  - **Design:** Clean Settings-style pane with left-hand sidebar navigation.
  - **Logic & Features:**
    - Sidebar Avatar dynamically computes and displays the user's initials (e.g. "Nandha Gopal" -> "NG" in a bold green circle).
    - Features a skeleton-loading spinner while `GET /api/auth/me` is resolving.
    - Editable text inputs for Name and Phone. Displays Email as locked/disabled.
    - Segmented interface containing toggle switches (`p-toggleswitch`) for Delivery Updates, Subscription Alerts, and Promos.
    - "Danger Zone" block distinctly styled in light red/pink (`#FEF2F2`) with an outlined primeNG `<p-button>` to delete the account.
    - Contains the master **Logout** text-link at the bottom of the sidebar, highlighted in a subtle hover-red.

### C. Shared Components & Guards
- **Header (`<app-header>`):** Sticky top navigation block globally available. Left side features Logo + Links. Right side contains a notification badge `<p-badge>` and the dynamic initials Avatar (scaling interaction on hover) acting as the profile quick-link.
- **Footer (`<app-footer>`):** Corporate links, TOS, Social icons.
- **Global Session Guard:** `app.ts` is bound to `@HostListener` events for (`mousemove`, `keydown`, `touchstart`, `click`). Interacting with the application extends the 20-minute idle-timeout logic managed by `auth.service.ts`.

### D. Admin Features (Protected by Role/AdminGuard)
- **Admin Dashboard (`/admin/dashboard`):**
  - **Function:** Main overview panel for administrators.
  - **Features:** Key metrics, operational statistics, and system status at a glance.
- **Admin Customers (`/admin/customers`):**
  - **Function:** List and search through registered users/customers.
- **Menu Management (`/admin/menu-management`):**
  - **Function:** Centralized, dynamic control for meal offerings, heavily redesigned for efficiency.
  - **Tab 1: Tier Settings & Pricing:** Manages base tiers (Protein Rich, Classic, etc.). Administrators can set specific active states, dietary support boundaries, delivery charges, and schedule future-dated "Pricing Rules" that compute customer costs dynamically. No backdating allowed.
  - **Tab 2: Weekly Images:** Visual menu tracking. Features a 4x2 "Coverage Grid" showing missing vs uploaded images for all Tier + Diet combinations. Images uploaded mapping to week-start Mondays, supporting auto-copy from the previous week.
  - **Tab 3: Plan Matrix:** Grid view toggling specific tier+diet+slot+duration combinations. Displays live calculated prices for sanity-verifying what is currently active and shoppable for customers.

## 4. Architecture & Directory Structure

### **Backend (`/backend`)**
- `app/main.py`: Entry point for the FastAPI application.
- `app/routers/auth.py`: Contains endpoints for login, signup, check-email, /me, and password reset.
- `app/models/user.py`: SQLAlchemy definition of the `User` table.
- `app/schemas/user.py`: Pydantic input/output validation models matching the DB architecture.
- `app/utils/`: Contains security utils (hashing/JWT) and email utils (OTP dispatch).
- `app/database.py`: SQLAlchemy session and connection lifecycle management.

### **Frontend (`/frontend/app/src/app`)**
- `app.ts` & `app.html`: The root Shell. Contains the global session timer listeners and structural router outlet padding.
- `app.routes.ts`: Defines routes and hooks up Auth Guards.
- `/pages`: Contains standalone page components (`/home`, `/login`, `/signup`, `/dashboard`, `/plans`, `/profile`, `/forgot-password`).
- `/components`: Shared cross-page components like the `Header` and `Footer`.
- `/services/auth.service.ts`: Central hub for API communication. Handles HTTP requests to the backend, stores token headers, and manages local storage lifecycle and session expiry math.

## 5. Implementation Notes for AI Agents
- Keep visual updates strictly premium. The aesthetic leans heavily on `.charcoal`, `.silver`, and rich deep greens. Avoid using generic primeNG default styles without overriding them to match the Nutribox brand language.
- When creating new features that fetch sensitive data, ensure you pass the JWT bearer token (usually automatically handled if you inject `AuthService` or use an HttpInterceptor).
- If modifying database models in `backend/app/models`, remember that the project currently relies on manual `ALTER TABLE` scripts for migrations—ensure you account for schema modifications manually if adding columns.
