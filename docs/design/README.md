# HoppDrive UI redesign: hand-off for Claude Code

Two design canvases (B2C and Admin) were produced in Claude. This folder is the export.

- `b2c/screens/*.png`, `admin/screens/*.png`: rendered screenshots of every board at its real width. **Look at these first.** File names tell the device: Desktop 1440, Tablet 820, Mobile 390, UltraWide 1920.
- `b2c/source/*.dc.html`, `admin/source/*.dc.html`: the markup of each board. They use a small template syntax (`<sc-for>`, `<sc-if>`, `{{ }}`, `<dc-import>`) and cannot be opened directly in a browser. Read them for exact class names, spacing and copy, then rebuild them as React/Tailwind.
- `b2c/source/b2c.css`, `admin/source/admin.css`: the design tokens and shared component classes (buttons, cards, chips, tables, status pills, drawers, modals, skeletons). Translate these to Tailwind utilities or `@layer components`. Do not paste them in as global CSS.
- `apps/*/public/logos/*.svg`: new logo set, already wired into Navbar, Footer, admin sidebar and admin login on branch `design/ui-refresh`.

## Screen to code map

| Design board | Code |
|---|---|
| B2C Main, Home-Tablet(-2), Home-Mobile(-2), Home-UltraWide | `apps/web/src/app/page.tsx`, `components/b2c/*` (HeroSection, VehicleGrid/VehicleCard, PricingSection, WhyHoppDrive, HowItWorks, SocialProof, FaqSection, MapSection, ContactForm), `layout/Navbar`, `layout/Footer` |
| B2C Fleet-Desktop/Mobile | `app/fahrzeuge/page.tsx`, `app/mieten/[kategorie]/page.tsx` |
| B2C Vehicle-Desktop/Mobile | `app/fahrzeuge/[slug]/page.tsx`, `VehicleImageGallery` |
| B2C Inquiry-States | `components/b2c/ContactForm.tsx` (6 states) |
| B2C Mobile-Nav-Consent | `Navbar` mobile menu, `consent/CookieBanner`, filter sheet, empty state, `not-found.tsx` |
| B2C Legal-Desktop | `app/agb`, `app/impressum`, `app/privacy` |
| Admin Main, Dashboard-Tablet, Dashboard-UltraWide | `apps/admin/src/app/(cms)/page.tsx`, `(cms)/layout.tsx` (sidebar: 264 px, 76 px rail on tablet, bottom nav on mobile) |
| Admin Inquiries-Desktop, Inquiries-Tablet(-Detail) | `(cms)/inquiries/page.tsx` |
| Admin Contracts-Desktop, Contracts-Dunning | `(cms)/contracts/page.tsx` |
| Admin Calendar-Desktop, Calendar-Booking | `(cms)/availability/page.tsx` |
| Admin Fleet-Desktop, Reports-Desktop | `(cms)/fleet`, `(cms)/reports` |
| Admin Content-Desktop, Content-Lists | `(cms)/homepage`, `testimonials`, `faq`, `locations` |
| Admin Settings-Users | `(cms)/settings`, `(cms)/profile` |
| Admin Auth | `(cms)/login`, `(cms)/reset-password`, `app/contracts/[id]/sign` |
| Admin States-Admin, Mobile-Screens | shared `StatusBadge`, `StatCard`, dialogs replacing `confirm()`/`alert()`, mobile layouts |

## Rules for the implementation

1. **Zero functional regression.** Keep every existing API call, form field, validation and route. The design changes presentation first.
2. Use the existing Tailwind preset (`packages/tailwind-config`); colours and Fira Sans already match. Add tokens there only if the design needs one that is missing (status colours, `ruby-tint`).
3. Mobile first: below 768 px, 48x48 touch targets, bottom nav in admin, tables become cards. 768 to 1024 px: collapsible sidebar (76 px rail). Above 1024 px: persistent sidebar, multi-pane. Keep the focus ring (3 px blue, 2 px offset) and the measured contrasts.
4. Text in `[square brackets]` in the designs is placeholder content for facts that are not in the code (address, phone, opening hours, legal text). Do not ship brackets; read the real values from existing data or leave the current content.
5. Every note tagged **[Improvement & Reason]** in the canvases is a deviation from the current app. Some need backend work and must not be faked in the UI. Implement the UI part only when the data exists:
   - Quick-request bar with price estimate: uses the existing price API, front end only.
   - Price ladder and "30 days total" on cards: use the tiered per-day price from the API, not a flat 40 %.
   - Users and roles page (Administrator, Rental, Editorial, Read): **needs a role field and permissions in the API and database**. Build it last, or as a separate change.
   - Activity log page: the AuditLog table exists but has no UI endpoint yet.
   - Year-over-year comparison and CSV export in reports: check the API first.
   - Password strength meter and lockout after failed attempts: suggestions, need server rules.
6. Work in small steps, one screen group per commit, and run `npm run build` and the type check after each.

## Prompt to give Claude Code

```
Read docs/design/README.md and look at the PNGs in docs/design/b2c/screens and
docs/design/admin/screens. Implement the redesign on branch design/ui-refresh
in apps/web and apps/admin, in this order:
1. B2C home page (hero with quick-request bar, vehicle cards, price ladder,
   FAQ, location, contact form) at 390 / 820 / 1440 / 1920 px.
2. B2C fleet list and vehicle detail pages.
3. Contact form states and cookie banner.
4. Admin shell (sidebar, rail, bottom nav), dashboard, inquiries, contracts.
5. The rest of admin.
Use docs/design/*/source/*.dc.html for exact class names, spacing and copy,
and the two .css files for tokens. Keep all existing functionality and API calls.
Compare your result with the PNGs after each step and fix differences.
Start with step 1 only, then stop and show me.
```
