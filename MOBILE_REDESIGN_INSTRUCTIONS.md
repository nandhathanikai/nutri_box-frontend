# Nutribox — Mobile-First Redesign Instructions

**Audience:** Gemini (or any AI coding agent executing this redesign)
**Repo:** Angular 17+ (standalone components) frontend at `frontend/app/`
**Target outcome:** Every screen of the Nutribox app must be **delightful to use on a phone**. The current app is desktop-first with retrofit media queries. We are flipping the default: mobile is the primary canvas; desktop is the wider variant of the same design.

> **The single most important rule:** Most Nutribox users browse and manage their subscription on a phone. If a layout, interaction, or text size works on desktop but feels cramped, slow, or hostile on a 360 px phone in one-handed use, it is **broken** and must be redesigned — not patched.

---

## 0. How to use this document

1. Read **Section 1 (Constraints)** and **Section 2 (Design System)** in full before touching code. These are non-negotiable.
2. Read **Section 3 (Global Patterns)**. Every page rebuild must follow these patterns.
3. Pick a page from **Section 4 (Per-Page Instructions)**. Each page section has:
   - **Current state** — what's there now (verified by audit, do not re-investigate)
   - **Target behaviour** — what it should do on mobile / tablet / desktop
   - **Concrete changes** — what to edit (file paths included)
   - **Acceptance criteria** — what "done" looks like
4. Always run the **Acceptance Checklist (Section 7)** before claiming a page is done.

**Do not** change unrelated files. **Do not** invent new colors, fonts, or component libraries. **Do** preserve every existing feature (form fields, links, business logic). This is a UI redesign, not a feature change.

---

## 1. Hard Constraints

These are inviolable. If a request from the user appears to conflict with these, stop and ask.

1. **Visual language is preserved.** Color palette, fonts (Plus Jakarta Sans / Inter), corner radii (6–18 px), and glassmorphism remain. Only **layout, spacing, density, and touch behaviour** change.
2. **No new dependencies.** Use existing PrimeNG (Aura theme), existing Angular standalone components, existing SCSS variables in `frontend/app/src/styles.scss`. Do not add Tailwind, Material, Bootstrap, or new icon sets.
3. **No business-logic changes.** Forms keep their fields. Routes keep their paths. API calls keep their shapes. If you remove a field or button, you have introduced a bug.
4. **Mobile-first SCSS.** Default styles target the smallest viewport (360 px). Use `@media (min-width: ...)` to grow up. No more `@media (max-width: ...)` patterns for new code. Existing `max-width` queries should be rewritten when you touch a file, not in a separate pass.
5. **Touch targets ≥ 44 × 44 px** for any interactive element. Always. Icon-only buttons get padding to reach 44 px; they do not stay 24 px just because they "look balanced."
6. **No horizontal scroll on any customer page** at any width ≥ 320 px. (Tables on admin pages may scroll horizontally **only** as a fallback under "Plan Matrix"-style data grids — see Section 3.4.)
7. **One-handed thumb reach is sacred.** Primary actions (submit, confirm, primary CTA) sit in the bottom 40% of the viewport on mobile, or in a sticky bottom bar.
8. **Preserve session-timer listeners** in `app.ts` (mousemove, keydown, touchstart, click). Do not strip them.
9. **No emoji** in code, comments, or UI text unless they were already there. The brand voice is editorial.
10. **Bundle size discipline.** Do not introduce per-component SVG illustrations larger than 20 KB. Reuse existing assets.

---

## 2. Design System (Mobile-First Extension)

### 2.1 Breakpoints — use only these

```scss
// frontend/app/src/styles.scss — add to top
$bp-sm: 480px;   // small phone landscape / phablet
$bp-md: 768px;   // tablet portrait — the bottom of "desktop-ish"
$bp-lg: 1024px;  // tablet landscape / small laptop
$bp-xl: 1280px;  // standard desktop

@mixin sm-up { @media (min-width: #{$bp-sm}) { @content; } }
@mixin md-up { @media (min-width: #{$bp-md}) { @content; } }
@mixin lg-up { @media (min-width: #{$bp-lg}) { @content; } }
@mixin xl-up { @media (min-width: #{$bp-xl}) { @content; } }
```

Default (no media query) = **360 px phone in portrait**. Everything else scales up.

The pre-existing breakpoints (`900px`, `720px`, `640px`, `600px`, `540px`, `500px`, `400px`) are inconsistent and must be migrated to these four when you touch a file.

### 2.2 Spacing scale

Use a **4 px** base. Allowed values only:

```
4, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

Convert to rem if the existing file uses rem (1 rem = 16 px). Never use 5 px, 6 px, 14 px, 18 px, etc. Whitespace consistency is what makes the app feel premium.

### 2.3 Typography scale (mobile-first)

| Token | Mobile (default) | Tablet ≥ 768 | Desktop ≥ 1024 | Use for |
|---|---|---|---|---|
| `--fs-display` | 28 px / 1.15 | 36 px | 44 px | Hero h1 only |
| `--fs-h1` | 22 px / 1.2 | 26 px | 30 px | Page titles |
| `--fs-h2` | 18 px / 1.25 | 20 px | 22 px | Section titles |
| `--fs-h3` | 16 px / 1.3 | 17 px | 18 px | Card titles |
| `--fs-body` | 15 px / 1.5 | 15 px | 15 px | Default text |
| `--fs-small` | 13 px / 1.45 | 13 px | 13 px | Captions / meta |
| `--fs-micro` | 12 px / 1.4 | 12 px | 12 px | Badges only |

**Floor: 12 px.** Nothing smaller. The current code has 0.65 rem (≈ 10.4 px) and 0.6 rem (≈ 9.6 px) — these are eliminated entirely.

Implement as CSS custom properties in `:root` inside `styles.scss`, and scale via media queries.

### 2.4 Touch target tokens

```scss
$tap-min: 44px;       // absolute minimum tap target
$tap-comfort: 48px;   // preferred for primary actions
$tap-large: 56px;     // bottom-bar nav items
```

Every `<button>`, `<a class="btn">`, icon button, toggle, checkbox, link in a list must satisfy `min-height: $tap-min` and have at least 8 px of breathing room between adjacent targets.

### 2.5 Safe-area and viewport

Add to `index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#081510">
```

Use `env(safe-area-inset-*)` for any fixed bottom bar or sticky bottom CTA so it doesn't sit under the iPhone home indicator.

### 2.6 Color usage stays the same

Do not touch:
- `$black: #0a0a0a`
- Hunter greens `#081510`, `#1b3a2d`, `#2d6a4f`
- `$silver`, `$muted`, `$offwhite`, `$light`
- Semantic colours (amber, blue, red, purple)

Only add **opacity stops** if you need surfaces (e.g. `rgba(13, 17, 23, 0.6)` for bottom-sheet scrim).

---

## 3. Global Patterns

These patterns are reused across pages. Implement them once, well, then apply.

### 3.1 Header / Top Navigation

**Current problem:** On `<768px`, nav links are `display: none` with **no replacement**. There is no way to navigate.

**Target behaviour:**

- **Mobile (< 768 px):**
  - Sticky header collapses to 56 px height.
  - Left: logo only (icon + "Nutribox" wordmark, 16 px).
  - Right: notifications icon button (44 × 44) + avatar (40 × 40, tap → opens drawer-menu).
  - **No hamburger.** Instead, use a **bottom tab bar** for primary navigation (see 3.2) on logged-in customer pages.
  - On public pages (home/login/signup), show a single "Sign in" outlined button on the right instead of avatar.
- **Tablet+ (≥ 768 px):** current layout, but trim header to 64 px.

**Files:** `frontend/app/src/app/components/header/{header.html, header.scss, header.ts}`

### 3.2 Bottom Tab Bar (NEW, mobile only, authenticated users)

A 64 px-tall (excluding safe-area) fixed bottom navigation. Visible only on `< 768 px` and only when the user is authenticated. Items:

| Icon | Label | Route |
|---|---|---|
| `pi-home` | Home | `/dashboard` |
| `pi-th-large` | Plans | `/plans` |
| `pi-wallet` | Credits | `/dashboard/credits` |
| `pi-user` | Profile | `/profile` |

Behaviour:
- Background: `rgba(8, 21, 16, 0.92)` with `backdrop-filter: blur(20px)`, top border `1px solid rgba(255,255,255,0.06)`.
- Active item: hunter-green pill behind the icon, icon + label go full-white.
- Inactive: icon `$silver`, label `$muted`.
- Tap target: each item ≥ 56 × 56 px.
- Use `RouterLinkActive` to set the active state.
- Hide on `/login`, `/signup`, `/home`, `/admin/**` routes via a route data flag or by checking the URL in `app.ts`.

**Add a new shared component:** `components/bottom-nav/bottom-nav.{ts,html,scss}`. Include it in `app.html` after `<router-outlet>`.

Add `padding-bottom: calc(64px + env(safe-area-inset-bottom))` to the main content wrapper when bottom-nav is visible (use a body/class signal or a service).

### 3.3 Admin Side Drawer (replaces admin sidebar on mobile)

**Current:** Admin sidebar transforms off-canvas at `< 900 px`, mobile header shows hamburger.

**Target:**
- Migrate breakpoint to `< 1024 px` (anything narrower than a small laptop becomes drawer mode).
- Mobile header: 56 px, hamburger (44 × 44), brand center, optional context action right.
- Drawer:
  - Width: 84 vw, max 320 px.
  - Slides in from left with 220 ms ease-out.
  - Scrim: `rgba(0,0,0,0.55)` with backdrop blur 8 px.
  - Tap scrim → close. Swipe-left on drawer → close (use Hammer.js? **No — too heavy**. Use a simple `pointerdown` / `pointermove` handler).
  - Each nav item: 48 px tall, 16 px horizontal padding, icon left + label, active state is a hunter-green left-bar (3 px wide) and slightly elevated background.

**Files:** `frontend/app/src/app/pages/admin/admin-layout/`.

### 3.4 Tables → Card Lists (the big change)

**Rule:** On `< 768 px`, **every** `<p-table>` / `<table>` in the app **becomes a stacked card list**. Tables remain only on tablet+ (≥ 768 px). No horizontal scroll on phones.

#### 3.4.1 The "Record Card" pattern

Each row becomes a card with this structure:

```
┌──────────────────────────────────────────┐
│ <Primary Identifier>     <Status Pill>   │
│ <Secondary line, muted>                  │
│ ──────────────────────────────────────── │
│ Label 1     Value 1                       │
│ Label 2     Value 2                       │
│ Label 3     Value 3                       │
│ ──────────────────────────────────────── │
│ [▼ More details]      [Edit] [Delete]    │
└──────────────────────────────────────────┘
```

- **Card container:** 12 px corner radius, `1px solid $light`, background `#fff`, padding 16 px, margin-bottom 12 px.
- **Header row:** primary identifier (e.g. customer name, offer title) on the left as `--fs-h3`; status pill on the right as `--fs-micro` rounded badge.
- **Secondary line:** email, phone, or short description as `--fs-small` `$muted`.
- **Key/value grid:** two-column grid, label on left (`$muted`, `--fs-small`), value on right (right-aligned, `--fs-body`).
- **Action row:** secondary actions as icon-buttons in the bottom-right; primary action as a full-width button when applicable. Each ≥ 44 px tap.
- **"More details" toggle:** if a row has more than 4 secondary fields, hide the rest behind a collapsible chevron toggle. Default collapsed.

#### 3.4.2 Tablet+ table layout (≥ 768 px)

- Reuse `<p-table>` as-is but with **mandatory** styling:
  - Cell padding `12px 16px`.
  - Header row `--fs-small`, weight 600, uppercase, letter-spacing `0.04em`, background `$offwhite`.
  - Body rows: `--fs-body`, hover row gets `rgba(45, 106, 79, 0.04)`.
  - Action icon buttons inside cells get `min-width: 36px; min-height: 36px` (tablet allows slightly smaller than 44 — mouse precision).
  - **Sticky first column** on horizontal-scroll edge cases (only the admin **plan matrix** retains a horizontal scroll on tablet, never on mobile).
- Implement a **shared component** `components/record-card/record-card.{ts,html,scss}` that takes inputs `{title, subtitle, status, fields: {label, value}[], primaryAction, secondaryActions}` so each admin page can render the same card consistently.

#### 3.4.3 Specific tables to convert

| Page | Table → Card title | Status pill from | Key/value fields | Actions |
|---|---|---|---|---|
| `admin-customers` | Customer name | `status` column | Phone, Plan, Sessions, Start, End, Credits | Delete (icon, confirms) |
| `admin-credits` (customers tab) | Customer name | Plan tier | Balance, Bonus, Used, Last activity | View detail, Manual credit |
| `admin-credits` (log tab) | Action label + customer | Action type | Date, Amount, Reason | View detail |
| `admin-menu` | Dish name | — | Weekly price, Monthly price, W-Del, M-Del | Edit, Delete |
| `admin-reports` top-items | Item name | Rank badge | Orders, Revenue | — |
| `menu-management` plan matrix | (special, see 4.18) | — | — | — |

### 3.5 Forms (mobile-first)

**Rules:**

1. **One field per row.** No 2-column or 3-column form grids on `< 768 px`. Grids may appear at `≥ 768 px` only.
2. **Inputs:** full-width, `min-height: 48px`, border-radius 10 px, `font-size: 16px` (critical — prevents iOS auto-zoom on focus).
3. **Labels:** always above the input (not floating, not inline). `--fs-small`, weight 600, `$charcoal`, `margin-bottom: 6px`.
4. **Error messages:** below the input, `--fs-small`, red, with 8 px top margin. Never inline beside the input.
5. **Helper text:** `--fs-small` `$muted`, below the input, above any error.
6. **Submit button:** full-width on mobile, `min-height: 48px`, primary green. On tablet+ it may be auto-width and right-aligned.
7. **Multi-step forms:** the step indicator stacks above the form on mobile, sits inline only at `≥ 768 px`. The Back / Next buttons sit in a **sticky bottom bar** at the foot of the form on mobile (`position: sticky; bottom: 0; padding: 16px; background: rgba(255,255,255,0.96); backdrop-filter: blur(12px)`).

**Files affected:** `signup.html`, `profile.html`, `admin-settings.html`, all dialogs.

### 3.6 Modals → Bottom Sheets on mobile

PrimeNG `<p-dialog>` is used in many admin pages. On mobile, modals must become **bottom sheets**, not centered cards.

- Mobile (< 768 px):
  - `[modal]="true"` `[draggable]="false"` `[resizable]="false"`.
  - Apply `styleClass="ntb-sheet"` and add the following in `styles.scss`:

```scss
.p-dialog.ntb-sheet {
  position: fixed !important;
  bottom: 0; left: 0; right: 0;
  margin: 0 !important;
  max-width: 100vw !important;
  width: 100vw !important;
  border-radius: 16px 16px 0 0;
  max-height: 92vh;
  animation: ntb-sheet-up 280ms ease-out;
  .p-dialog-header { padding: 16px 20px 12px; }
  .p-dialog-content { padding: 4px 20px 24px; }
}
@keyframes ntb-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
```

- Tablet+ (≥ 768 px): centered dialog, max-width 560 px, current behaviour.

**Replace** `<p-confirmDialog>` usage on mobile with the same sheet styling.

### 3.7 Drawers

`notifications-drawer` already uses `<p-drawer>`. Standardise:

- Mobile: `[position]="'bottom'"`, sheet style (matches 3.6), max-height 80vh.
- Tablet+: `[position]="'right'"`, width 420 px.
- Header has a drag-handle (a 36 × 4 px pill, `$light`) on top centre when on mobile.

### 3.8 Skeletons & Loading

- Replace any spinners that block whole pages with **skeleton placeholders** matching the eventual content shape.
- `p-skeleton` rectangles must reuse the same border-radius and dimensions as the loaded cards. No "blob"-shaped placeholders.
- Skeleton min-time: 200 ms (avoid flicker on fast responses) — implement with a `delay()` operator.

### 3.9 Toasts

`<p-toast>` exists in places. Standardise globally in `styles.scss`:

- Mobile: `top: env(safe-area-inset-top) + 8px`, full-width minus 24 px gutter, max-width 480 px centered.
- Tablet+: top-right corner, fixed width 360 px.
- Body font: `--fs-body`. Action button: 36 px tap target.

### 3.10 Charts

Currently bar charts on `admin-reports` use raw divs.

- Mobile: stack chart rows vertically; chart width = container width. Hide grid lines, show data labels at end of bars.
- Tablet+: original side-by-side layout.
- Set canvas height: `clamp(180px, 36vw, 280px)` not a fixed pixel value.

---

## 4. Per-Page Instructions

> For every page below: **work in this order** — (1) HTML semantic structure, (2) SCSS mobile-first base, (3) media-query growth to tablet/desktop, (4) component logic only if a new control (sheet, tab bar, swipe) is needed.

> Every page section ends with **Acceptance criteria** — concrete, testable.

### 4.1 `pages/home/home`

**Current state.** Full-bleed hero, parallax video, 7 sections (showcase, how-it-works, parallax banner, plans, testimonials, CTA). Multi-column grids collapse only at 1024 px. Showcase has rigid 500 px height. Falling-food animation is hidden on mobile (good).

**Target behaviour.**

- Hero: full viewport height capped at `min(720px, 100vh)`. Background video uses `object-fit: cover` with a poster image fallback. Headline `--fs-display`, tagline `--fs-body`, CTA stacked **full-width** below the headline, `48px` tall, primary green.
- Showcase: convert from fixed-height to `aspect-ratio: 4/5` on mobile, `16/9` on tablet+. Stacked content above image on mobile.
- How-it-works: 3 numbered step cards stack vertically; each card is full width, 16 px gap between. On `≥ 768 px` switch to 3-column grid.
- Parallax banner: single column on mobile, simplified copy + single CTA. Disable parallax transforms below 768 px (use `prefers-reduced-motion` style guard).
- Plans preview: horizontal scroll-snap carousel on mobile (each tier card = 78 vw wide, scroll-snap-align: center). On `≥ 768 px` revert to 3-column grid.
- Testimonials: same carousel pattern as plans.
- Footer CTA: stacked, full-width buttons; remove side-by-side image+text grid.

**Files.** `pages/home/{home.html, home.scss, home.ts}`.

**Acceptance.**
- [ ] Page is fully usable in portrait at 360 × 740 with zero horizontal scroll.
- [ ] Hero CTA is reachable with thumb without scrolling.
- [ ] All three "how it works" steps visible in a single vertical scroll without overflow.
- [ ] No element below 12 px font.

### 4.2 `pages/login/login`

**Current state.** 50/50 split converts to column at 900 px. OTP boxes are 44 px but wrap on `<480px`. Two-step "verify OTP → reset password" already exists from a prior change.

**Target behaviour.**

- Mobile: visual panel collapses to a 200 px tall hero banner at the top. Form fills the rest.
- Tablet+ (≥ 768 px): retain split layout, 60/40 (form gets 40%, visual 60%).
- OTP boxes:
  - Mobile: 6 boxes at `calc((100vw - 96px) / 6)`, max 48 px, min 36 px. Gap 8 px. Always fit on one line.
  - Tablet+: 44 × 52 px as current.
- "Forgot password?" link: 44 px tap target, slightly larger font on mobile (`--fs-body`).
- Submit button: full-width, 48 px.
- Spam-folder hint already added — keep it.

**Files.** `pages/login/{login.html, login.scss, login.ts}`.

**Acceptance.**
- [ ] OTP row never wraps at ≥ 360 px width.
- [ ] Password reset flow (verify OTP → set password) works identically on mobile.
- [ ] Form is reachable in landscape orientation without overlap.

### 4.3 `pages/signup/signup`

**Current state.** 50/50 split → column at 900 px. Step 1 personal info (4 fields), step 2 address (4 fields). Field rows are 2-col, collapsing only at 500 px. Password hints in 2-col grid.

**Target behaviour.**

- Mobile: drop the visual panel below 768 px entirely. Replace with a top 12 px progress strip (filled green) showing 1/2 → 2/2.
- All fields single-column on mobile. Two-column at `≥ 768 px`.
- Password hints: vertical list of checks (✓ at least 6 chars, ✓ one special char, ✓ one number) — never 2-col on phone.
- Step indicator: a 2-step pill bar above the form (mobile), inline number-dots at `≥ 768 px`.
- Buttons (Back / Next, or Submit): **sticky bottom bar** on mobile. Back is left, Next/Submit right. Both 48 px tall.
- The "email already exists" inline banner: full-width, 12 px corner radius, amber background, `--fs-small`. Always wraps cleanly.

**Files.** `pages/signup/{signup.html, signup.scss, signup.ts}`.

**Acceptance.**
- [ ] Both steps complete in portrait without horizontal scroll.
- [ ] Sticky bottom buttons do not overlap form fields or iOS home indicator.
- [ ] "Email exists" banner wraps cleanly at 360 px.

### 4.4 `pages/dashboard/dashboard`

**Current state.** Centered container with grace banner, welcome hero, benefits 3-col grid (collapses at 720 px). Plan summary 4-col → 2-col at 720 px. Includes meal calendar.

**Target behaviour.**

- Top: welcome strip — `Good morning, Nandha.` (`--fs-h1`) plus one-line subtitle (`--fs-body`, `$muted`). Padding 20 px horizontal on mobile.
- Grace banner (if present): full-width card, icon left (32 × 32), title + body stacked, primary CTA full-width below.
- Plan summary card:
  - Mobile: single column of key/value rows. Plan name as `--fs-h3` at top. Below: 4 rows (Sessions remaining, Next delivery, Plan ends, Credits) each a label/value row.
  - Tablet+: 2-column grid as today, but spaced cleanly.
- Benefits / quick-actions: 2-column grid of small cards on mobile (e.g. "Skip a day", "Add credits", "Switch plan", "Pause"), each 80 px tall with icon + label. 3-column at `≥ 768 px`.
- Meal calendar: see 4.20.
- All `0.68 rem` and `0.7 rem` text → bumped to `--fs-small` (13 px) minimum.

**Files.** `pages/dashboard/{dashboard.html, dashboard.scss}`.

**Acceptance.**
- [ ] Grace banner CTA button is full-width on mobile and tap-target ≥ 48 px.
- [ ] Benefit cards form a clean 2 × 2 grid on 360 px.
- [ ] Plan summary readable without zooming.

### 4.5 `pages/plans/plans`

**Current state.** 4-step wizard. Tier grid `repeat(auto-fill, minmax(220px, 1fr))` squishes at small widths. Price card max-width 520 px not centered. Steps tight below 440 px.

**Target behaviour.**

- Top progress bar with **5 short labels** below: Tier · Diet · Slot · Duration · Price. Active step bolded, others muted. Tap labels to jump back (not forward).
- Each step is a full-width vertical list of choice cards. No 2-column or 3-column at `< 768 px`.
- Choice card:
  - 16 px padding, 12 px corner radius, full-width, min-height 72 px.
  - Left: icon or thumb (40 × 40). Middle: title (`--fs-h3`) + subtitle (`--fs-small`). Right: radio (custom green ring).
  - Selected state: 2 px hunter-green border, very subtle background tint.
- Price breakdown card:
  - Centered on mobile, full-width minus 24 px gutter.
  - Item rows: label left / amount right. Total row bold, larger, with a top border.
- "Continue to Pay" button: sticky bottom, full-width, 48 px.

**Files.** `pages/plans/{plans.html, plans.scss}`.

**Acceptance.**
- [ ] Each step fits on screen without horizontal scroll at 360 px.
- [ ] Sticky CTA visible always; never obscures the last choice.
- [ ] Going back returns to the previous step with state preserved.

### 4.6 `pages/profile/profile`

**Current state.** 280 px sidebar + main grid. Collapses awkwardly to a flex row at 1024 px, then column at 640 px. Form grid 2-col. Danger zone styled in pink.

**Target behaviour.**

- Mobile: drop the sidebar entirely. Show a **horizontal scrollable tab bar** with the sections (Account, Address, Notifications, Security, Danger). Active tab underlined hunter-green.
- Tablet (≥ 768 px): split layout — left column 240 px tab list (vertical), right column form. (Not the older 280 px sidebar; rebuild it.)
- Avatar block at the top of the page (mobile): centered, 80 × 80 circle of initials + below it the name and email. No avatar in the tab bar.
- Form fields: single column on mobile, label above, 48 px input. 2-column on tablet+.
- Toggle list (notifications):
  - Each toggle row: title + 1-line description left, `<p-toggleswitch>` right, 64 px min row height, dividing border-bottom `1px solid $light`.
- Danger zone: full-width card with red `1px` left border, light red background. Delete button is **outlined red, full-width**, 48 px. Tapping it opens a confirm bottom-sheet that requires typing "DELETE" before enabling the destructive button.
- Logout: full-width text-link button at the very bottom of the page on mobile (not in a sidebar).

**Files.** `pages/profile/{profile.html, profile.scss, profile.ts}`.

**Acceptance.**
- [ ] No sidebar on mobile; tab bar horizontally scrollable with snap.
- [ ] Delete-account requires typed confirmation in a bottom sheet on mobile.
- [ ] No form fields side-by-side on mobile.

### 4.7 `pages/credits/credits.component`

**Current state.** Title + balance cards (3-col → 1fr at 768 px) + timeline cards. Timeline grid (110 px date col + content) breaks at 600 px.

**Target behaviour.**

- Top: 3 balance cards stacked vertically on mobile, each 80 px tall with label (`--fs-small`) and value (`--fs-display` size at 28 px). Border-left accent in the existing colour.
- On tablet (≥ 768 px): 3-column grid as today.
- Timeline:
  - Mobile: vertical list. Each entry is a card. Top row: date (left, `--fs-small`) + action chip (right). Body: amount big, description below.
  - Tablet+: revert to the 2-column grid (date column + content column).
- "Buy credits" CTA: sticky bottom on mobile.
- Session chips (pills with credit names): use `flex-wrap: wrap; gap: 8px`; never let them clip.

**Files.** `pages/credits/{credits.component.html, credits.component.scss}`.

**Acceptance.**
- [ ] Timeline entries readable on 360 px with no truncation.
- [ ] Balance card values not so big they wrap onto two lines.
- [ ] Sticky "Buy credits" CTA never overlaps content.

### 4.8 `pages/not-found/not-found.ts`

Likely a small 404 page. Make sure:
- Centered illustration ≤ 200 px tall on mobile.
- "Go home" CTA: full-width 48 px button on mobile, auto-width on tablet+.
- Vertical centering uses `min-height: 100dvh` (dynamic viewport height — accounts for mobile browser chrome).

### 4.9 `components/header/header`

See **3.1**. Build:

- Mobile (< 768 px): 56 px tall, logo left, notifications + avatar right (on authenticated routes) OR "Sign in" button (on public routes).
- Tapping avatar opens a **bottom sheet** with: profile shortcut, plan, credits balance, log out.
- Tablet+ (≥ 768 px): current 72 px header with inline nav links.
- Add `RouterLinkActive` to nav links so active state is clear.

**Files.** `components/header/{header.html, header.scss, header.ts}`.

**Acceptance.**
- [ ] Avatar tap opens sheet on mobile; opens dropdown on desktop.
- [ ] No `display: none` on a nav element without an explicit replacement.

### 4.10 `components/footer/footer`

**Current state.** 4-column grid → 2 columns at 900 px → 1 column at 540 px. Tiny text.

**Target behaviour.**

- Mobile: 4 accordion sections (Brand, Product, Company, Contact). Tap to expand. The bottom "© Nutribox" strip + social icons stays at the bottom.
- Tablet+: current 4-column layout.
- Body text: `--fs-small`. Links 44 px tap target.
- Social icons: 44 × 44 each with the existing 36 px icon inside.

**Files.** `components/footer/{footer.html, footer.scss}`.

### 4.11 `components/meal-calendar/meal-calendar`

**Current state.** 7-column grid (week view). Day cards 84 → 76 px tall. Session chips shrink from 22 → 18 px with 0.6 rem text (unreadable).

**Target behaviour.**

- Mobile (< 768 px): **switch to a vertical day list**, not a grid. Each day = a row card:
  - Left: date block (e.g. "Mon · 14"). Today highlighted.
  - Right: session chips for that day, wrapping if multiple.
  - Tap a day → bottom sheet with the day's full menu and "Skip" action.
- Tablet+: keep the 7-column grid as today, but session chips become at least 24 × 24 with `--fs-small` text.
- Skip dialog: bottom sheet on mobile (3.6).

**Files.** `components/meal-calendar/{meal-calendar.html, meal-calendar.scss, meal-calendar.ts}`.

**Acceptance.**
- [ ] Mobile view is one tappable row per day; no grid.
- [ ] Tapping a day opens a sheet with selectable sessions to skip.

### 4.12 `components/notifications-drawer/notifications-drawer`

**Current state.** PrimeNG drawer, 2 tabs (Announcements, Offers), card list. No mobile padding overrides.

**Target behaviour.**

- Mobile: position bottom, sheet style (3.7), drag-handle on top, header `--fs-h2` "Notifications" + close button (right, 44 × 44).
- Tab switcher: segmented control, full-width, 44 px tall, two equal halves.
- Announcement card: icon left (40 × 40), title + body right, timestamp `--fs-small` `$muted` at the bottom. Padding 16 px. Tapping highlights briefly.
- Offer card: badge top-right corner, title left, description below, code chip with copy button on tap.

**Files.** `components/notifications-drawer/{notifications-drawer.html, notifications-drawer.scss, notifications-drawer.ts}`.

### 4.13 `pages/admin/admin-layout/admin-layout`

See **3.3**. Migrate sidebar overlay breakpoint from 900 → 1024 px. Tighten mobile-header content. Use safe-area for bottom padding of main area.

### 4.14 `pages/admin/admin-dashboard/admin-dashboard`

**Current state.** Page header banner + 4-col stats → 2-col at 1100 px → 1-col at 600 px. Charts side-by-side → 1-col at 900 px. Chart canvas 220 px fixed.

**Target behaviour.**

- Stats grid: 2-column on mobile (default). Each stat card: label (`--fs-small`), value (`--fs-h1`), delta (`--fs-micro`). Card padding 16 px.
- Tablet (≥ 768 px): 4-column.
- Charts: stack vertically on mobile; 2-column at `≥ 1024 px`. Canvas height: `clamp(180px, 36vw, 240px)`.
- Page header banner: 56 px tall on mobile (was 80+), 80 px on tablet+. Title `--fs-h1`, subtitle hidden on mobile.

### 4.15 `pages/admin/admin-customers/admin-customers`

**Current state.** Stats (none here) + toolbar (tabs + search) + table (9 columns, horizontal scroll at 720 px). Add User dialog 520 px.

**Target behaviour.**

- **Mobile (< 768 px):**
  - Toolbar: tabs scroll horizontally (snap to center). Search bar drops to a full-width row below tabs (44 px tall, leading icon, debounced).
  - Customer list: stacked Record Cards (3.4.1). Card content:
    - Header: customer name (left) + status pill (right).
    - Subline: email + phone (gray).
    - Fields shown by default: Plan, Sessions remaining, End date.
    - Hidden behind "More details": Start date, Credits, Phone again.
    - Actions: a single icon button "..." in the bottom-right opens a sheet with Edit / Delete / View Profile.
- **Tablet+ (≥ 768 px):** keep the `<p-table>` but apply the styling rules from 3.4.2.
- **Add User dialog:** bottom sheet on mobile (3.6). Form fields single-column. Sticky "Add user" button at the bottom of the sheet, full-width.

**Files.** `pages/admin/admin-customers/{admin-customers.html, admin-customers.scss, admin-customers.ts}`.

**Acceptance.**
- [ ] No horizontal scroll on the customer list at 360 px.
- [ ] Each card shows the most-needed 3 fields without expansion.
- [ ] Tap "..." opens a sheet with named, full-width actions (not a tiny tooltip menu).

### 4.16 `pages/admin/admin-credits/admin-credits`

**Current state.** Stats (4-col, no mobile collapse) + tabs + two tables + 3 dialogs.

**Target behaviour.**

- Stats: 2-col on mobile, 4-col at `≥ 768 px`.
- Tabs: horizontal scroll on mobile, snap.
- Both tables → Record Cards on mobile (per 3.4):
  - Customers tab card: customer name + tier pill, balance/bonus/used as 3 fields, "Manual credit" + "View detail" actions.
  - Log tab card: action title + customer name as subline, date/amount/reason fields.
- Dialogs (manual, detail, override) → bottom sheets on mobile.
- Plan progress bar visual (currently flex): mobile shows a single horizontal bar with two segments (plan / bonus). Labels above the bar, not inline.

### 4.17 `pages/admin/admin-announcements/admin-announcements`

**Current state.** Stats (3-col) + tabs + announcement cards (already card-based). Card has horizontal flex with icon left.

**Target behaviour.**

- Stats: 1-col on mobile (3 stacked cards), 3-col at `≥ 768 px`.
- Announcement card on mobile:
  - Vertical stack: icon (32 × 32) top-left aligned, title `--fs-h3` next to it, body below spanning full card, status pill top-right.
  - Meta row at the bottom (audience, date) as `--fs-small` `$muted`.
  - Actions (Edit, Delete, Pause): a 3-dot menu opening a sheet.
- New Announcement dialog → bottom sheet, single-column form.

### 4.18 `pages/admin/admin-offers/admin-offers`

**Current state.** Stats (4-col) + toolbar + offer cards grid. Offer cards have a left badge + right info that overflows on mobile.

**Target behaviour.**

- Stats: 2-col on mobile.
- Offer card on mobile:
  - Stack vertically: badge at the top-right corner (absolute, 56 × 56), title (`--fs-h3`), description (`--fs-small`).
  - Offer code: pill with copy icon. Tapping copies to clipboard and toasts "Code copied".
  - Stats row: 3 small KPI cells (Uses / Limit / Revenue) in a horizontal row.
  - Action: full-width "Manage offer" button at the bottom of the card.
- Create Offer dialog → bottom sheet.

### 4.19 `pages/admin/admin-reports/admin-reports`

**Current state.** Stats (4-col) + toolbar + bar chart + side-by-side small charts + top items table.

**Target behaviour.**

- Stats: 2-col on mobile.
- Bar chart: full width, height `clamp(240px, 60vw, 320px)`. Y-axis label rotated 0 (horizontal), X-axis labels rotated −30° if they would overlap.
- Side-by-side charts: stacked vertically on mobile.
- Top items table → Record Cards on mobile: rank badge + item name + revenue + orders.

### 4.20 `pages/admin/admin-settings/admin-settings`

**Current state.** Sub-tabs + multiple form panels with 2-col and 3-col grids. Toggle rows in flex.

**Target behaviour.**

- Sub-tabs: horizontal scroll on mobile.
- Form grids `fg2` and `fg3`: collapse to 1-col on mobile, 2/3-col on `≥ 768 px`.
- Toggle rows: stack info above toggle on mobile only if the description is > 40 chars. Otherwise keep horizontal but ensure 64 px row height.
- Save button: sticky bottom on mobile, full-width.

### 4.21 `pages/admin/menu-management/menu-management.component`

**This is the hardest page.** Three tabs: Tier Settings, Weekly Images, Plan Matrix.

**Target behaviour.**

- Tab list: horizontal scroll on mobile.

- **Tab 1 — Tier Settings:**
  - Each tier becomes a vertical card on mobile.
  - Card sections: Identity (name + diet badges), Pricing (price rows with effective date + scheduled rules), Delivery (weekly + monthly fields stacked), Toggles (active states), Actions.
  - Edit pricing rule → bottom sheet form.

- **Tab 2 — Weekly Images:**
  - Mobile: upload form first (full-width), then below it the coverage grid as a `2 × N` mini grid (showing tier+diet pairs). Each cell 80 × 80 with a thumbnail or empty placeholder, "+" tap to upload directly to that cell.
  - Tablet+: side-by-side as today.

- **Tab 3 — Plan Matrix:**
  - Mobile: drop the matrix entirely. Replace with a **filter-driven list**:
    - Filter chips at top: Tier · Diet · Slot · Duration (each opens a bottom sheet selector).
    - Below: list of matching plan-rows. Each row card: combo summary + computed price + toggle (active / inactive).
  - Tablet+ (≥ 1024 px): keep the matrix, with sticky first column, horizontal scroll.

**Files.** `pages/admin/menu-management/{menu-management.component.html, menu-management.component.scss, menu-management.component.ts}`.

**Acceptance.**
- [ ] All three tabs are operable in portrait at 360 px without horizontal scroll on phone.
- [ ] Image upload works with a tap (no mouse-only drag-drop).
- [ ] Plan matrix replaced by filter-list on phone but matrix preserved on tablet+.

### 4.22 `pages/admin/admin-menu/admin-menu`

**Current state.** 7-column table (Image, Name, Weekly, Monthly, W-Del, M-Del, Actions) with paginator.

**Target behaviour.**

- Mobile: Record Card per dish. Image left (64 × 64), name `--fs-h3` right, then below: 4 price fields (Weekly / Monthly / W-Del / M-Del — but **expand the labels** to "Weekly price", "Monthly price", "Weekly delivery", "Monthly delivery"). Actions in a 3-dot menu opening a sheet.
- Paginator: simplified to "Prev / Page X of Y / Next" on mobile; full PrimeNG paginator on tablet+.
- "Add menu" button: sticky bottom CTA on mobile.

---

## 5. Component-Level Rules (PrimeNG)

Apply globally in `styles.scss` (use `::ng-deep` only when scoped overrides aren't possible — prefer `:host ::ng-deep` inside the component).

- `p-button`: default min-height 44, padding `12px 20px`, font 15 px. Modifiers: `.full-width` (mobile-default for primary), `.icon-only` (44 × 44 with no horizontal padding).
- `p-inputtext`, `p-password input`: min-height 48 px, font 16 px, radius 10 px.
- `p-select`: same dimensions as inputtext; dropdown panel max-height `60vh` on mobile.
- `p-toggleswitch`: 52 × 32 (already accessible), but ensure 12 px gap from accompanying label.
- `p-skeleton`: respect the radius and dimensions of the eventual content.
- `p-dialog`: see 3.6 (sheet on mobile).
- `p-drawer`: see 3.7 (bottom-sheet style on mobile).
- `p-tabs` / `p-tablist`: enable horizontal scroll on mobile by setting `overflow-x: auto; scroll-snap-type: x mandatory;` on the tab list and `scroll-snap-align: start` on each tab.
- `p-table`: only used at `≥ 768 px`. Hide on mobile (`display: none`) and render a `<app-record-card>` list instead.
- `p-toast`: see 3.9.
- `p-confirmDialog`: replaced by bottom-sheet on mobile.

---

## 6. New Shared Components to Create

Build these once in `frontend/app/src/app/components/` and reuse across pages.

### 6.1 `<app-bottom-nav>` — see 3.2

### 6.2 `<app-record-card>` — see 3.4.1

Inputs:
- `title: string`
- `subtitle?: string`
- `status?: { label: string, tone: 'success' | 'warn' | 'danger' | 'info' | 'neutral' }`
- `fields: { label: string, value: string | TemplateRef }[]`
- `collapsibleFields?: { label: string, value: string }[]`
- `primaryAction?: { label: string, click: () => void }`
- `secondaryActions?: { icon: string, label: string, click: () => void }[]`

Output:
- `(cardClick)` event when the body is tapped (separate from action clicks).

### 6.3 `<app-section-tabs>` — horizontal scroll tab bar with snap

Inputs: `tabs: { id: string, label: string }[]`, `[(activeId)]`.
Use this for: profile sections, admin sub-tabs, admin-credits tabs, admin-settings tabs.

### 6.4 `<app-sticky-cta>` — sticky bottom CTA wrapper

A `<ng-content>` slot wrapped in a positioned bottom bar with safe-area padding. Used for: signup, plans final step, profile edits, admin-settings save, admin-menu add.

### 6.5 `<app-empty-state>` — for empty lists

Image (or icon), title, description, primary CTA. Replace ad-hoc empty messages everywhere.

---

## 7. Acceptance Checklist (run before claiming any page done)

Verify on **all three breakpoints**: 360 × 740 (small phone), 414 × 896 (large phone), 768 × 1024 (tablet portrait). Also spot-check 1280 × 800 (laptop).

- [ ] **Zero horizontal scroll** at every width ≥ 360 (except documented exceptions: plan matrix on `≥ 1024`).
- [ ] **All tap targets ≥ 44 × 44 px.** Inspect every button, link, toggle, chip, icon button.
- [ ] **No text below 12 px.** Search the file for `font-size: 0\.6` and `font-size: 0\.7` — none should remain.
- [ ] **Single-column forms on mobile.** No 2-col or 3-col grids below 768 px.
- [ ] **Inputs have `font-size: 16px`** (prevents iOS zoom on focus).
- [ ] **Primary CTA reachable with thumb** (bottom 40% of viewport or sticky bottom).
- [ ] **Bottom-fixed elements respect safe area** (use `env(safe-area-inset-bottom)`).
- [ ] **Existing functionality intact.** Form fields, validation, routes, API calls all unchanged.
- [ ] **Header has a working nav** (bottom-tab bar on mobile customer pages, drawer on admin).
- [ ] **All `<p-table>` blocks are wrapped in a `@media (min-width: 768px)` block** and have a `<app-record-card>` list as the mobile equivalent.
- [ ] **All `<p-dialog>` blocks** use the `ntb-sheet` style class.
- [ ] **All media queries use `min-width`** (not `max-width`) for new SCSS.
- [ ] **Spacing values come from the 4-px scale** (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). No 5, 6, 14, 18, 22 px.
- [ ] **Lighthouse mobile score**: Performance ≥ 80, Accessibility ≥ 95, Best Practices ≥ 95. (Run with Chrome DevTools.)
- [ ] **Reduced motion respected**: Parallax/transform animations gated by `@media (prefers-reduced-motion: no-preference)`.

---

## 8. Execution Order (recommended)

Do not attempt all 22 pages simultaneously. Suggested order:

**Phase 1 — Foundations (no page rebuilds):**
1. Update `styles.scss` with tokens (Section 2): breakpoints, mixins, type scale, spacing, tap-target tokens, global PrimeNG overrides (Section 5).
2. Build `<app-bottom-nav>`, `<app-record-card>`, `<app-section-tabs>`, `<app-sticky-cta>`, `<app-empty-state>` (Section 6).
3. Rebuild `components/header` (4.9) and `components/footer` (4.10).

**Phase 2 — Customer pages (highest impact):**

4. `pages/login` (4.2) — already mostly mobile-okay.
5. `pages/signup` (4.3).
6. `pages/dashboard` (4.4).
7. `pages/plans` (4.5).
8. `pages/profile` (4.6).
9. `pages/credits` (4.7).
10. `pages/home` (4.1) — big visual job, do near the end.
11. `pages/not-found` (4.8).
12. `components/meal-calendar` (4.11), `components/notifications-drawer` (4.12).

**Phase 3 — Admin pages:**

13. `admin-layout` (4.13), then `admin-dashboard` (4.14).
14. `admin-customers` (4.15) — proves the table-to-cards pattern.
15. `admin-credits` (4.16), `admin-announcements` (4.17), `admin-offers` (4.18), `admin-reports` (4.19), `admin-settings` (4.20), `admin-menu` (4.22).
16. `menu-management` (4.21) — hardest, do last.

**Phase 4 — Polish:**

17. Run Lighthouse on every page.
18. Manual QA on a real iPhone (Safari) and a real Android phone (Chrome).
19. Fix all checklist items still open.

---

## 9. Out of Scope (do not do)

- Backend changes. Only the Angular frontend is in scope.
- Adding new business features (new pages, new fields, new flows).
- Changing the brand colour palette.
- Replacing PrimeNG with another component library.
- Internationalisation (i18n).
- Dark/light theme switcher.
- Adding emoji or new illustrations beyond what already exists in `frontend/app/public/`.

---

## 10. Open questions to surface to the human before starting

If, while reading this, anything below is unclear, **stop and ask the human owner** — do not guess:

1. Are there any business rules that lock a field-order or field-name (e.g. "W-Del" must stay "W-Del" for regulatory reasons)? If yes, list them.
2. Is the `/forgot-password` flow now in-place on `/login` (two-step verify-otp → password), or is there still a separate `/forgot-password` route? (Verify by reading `app.routes.ts`.)
3. Is there an existing tablet-only QA device? (Affects whether 768–1023 px is a primary surface or just a graceful intermediate.)
4. Are PrimeNG `::ng-deep` overrides acceptable, or must we wrap components instead?

End of document.
