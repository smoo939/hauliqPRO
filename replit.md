# Project Notes

## Overview
Hauliq is a logistics/freight marketplace for Zimbabwe built with React + TypeScript + Vite (frontend) and Node.js + PostgreSQL (backend). Electric Amber (#FFBF00) Industrial-Tech branding.

## Current Architecture
- The app runs through `npm run dev`, which starts `server/index.mjs` on port 5000.
- The server serves the Vite React app in development and exposes local API routes under `/api`.
- Browser-side Supabase and Lovable runtime dependencies have been removed.
- The retained `src/integrations/supabase/client.ts` file is a compatibility adapter for existing app code. It forwards auth, database, storage, realtime subscriptions, and migrated function calls to the Replit server.
- PostgreSQL access is server-side only through `DATABASE_URL`; database credentials are not exposed to the browser.
- Local-first behavior is implemented in `src/lib/localFirst.ts`. The UI reads cached loads and bid state from a browser/device-local store, queues submitted bids immediately, and syncs them to the server in the background when connectivity is available.
- `@capacitor/network` is used to detect reconnect events; `@capacitor-community/sqlite` is loaded for mobile builds, with IndexedDB-backed browser storage used in the web preview.

## Database
- `npm run db:push` initializes the Replit PostgreSQL schema.
- Tables include app users, profiles (with company_name), roles, loads, bids, messages, reviews, notifications, verifications, truck_verifications, and driver subscriptions.
- Local device tables/stores include `available_loads`, `pending_bids`, and `sync_meta`.

## External Services
- AI chatbot requests are routed through `/api/functions/ai-chatbot` and use Replit's Gemini AI integration (`AI_INTEGRATIONS_GEMINI_*` env vars are auto-provisioned). Falls back to `GEMINI_API_KEY` if set.
- PostHog telemetry initialized in `src/lib/posthog.ts` using `VITE_POSTHOG_KEY` from environment.
- Maps use LocationIQ tiles (pk.79ff1b13183afa6fe0469c3585a467c6) — dark tiles in dark mode, light tiles in light mode via DynamicTileLayer.tsx + useTheme hook.

## Key Features Implemented
### Phase 1 & 2
- Electric Amber (#FFBF00) branding throughout
- Bid-only model for carriers (no direct load claiming)
- Gemini AI chatbot with floating amber pulsing button
- Chat locking, cancellations, ratings, 100km geofencing
- Carrier 2-step signup (company + truck details)
- Shipper soft-delete, platform fee system
- LiveTrackingMap component with real-time GPS trail and ETA

### Phase 3 (latest)
- **Map light/dark mode**: DynamicTileLayer now uses useTheme() to switch between light/dark LocationIQ tile URLs
- **AI button**: Removed `✦` sparkle text from HauliqAIChatbot, kept amber pulsing rings
- **Auth page**: Removed "Industrial-grade freight marketplace" subtitle from AuthPage
- **Tab indicator**: BottomTabs now uses a separate per-tab indicator bar (not layoutId) aligned precisely with active tab
- **Carrier profile**: ProfileView shows company name, truck type, plate number, and verification status for carriers fetched from truck_verifications + profiles
- **Loadboard spinner**: DriverHomeView no longer shows persistent spinner while scanning for loads — shows empty state immediately
- **PostHog telemetry**: posthog-js installed, initialized in main.tsx via `src/lib/posthog.ts`; set `VITE_POSTHOG_KEY` in .env
- **Live tracking (shipper)**: ShipperLiveView shows "Show Live Tracking" button for in_transit loads that renders LiveTrackingMap embedded in the detail sheet
- **Truck mismatch warning**: ShipperLiveView checks carrier's truck type vs load equipment_type before accepting a bid; shows amber warning dialog if mismatch detected (can still accept)
- **Capacitor (APK/AAB)**: @capacitor/core, @capacitor/android, @capacitor/cli installed; capacitor.config.ts created with appId `com.hauliq.app`; `npm run cap:init` initializes Android platform, `npm run cap:sync` builds and syncs to Android

## Mobile (APK/AAB) Build Steps
1. `npm run cap:init` — initializes Capacitor and adds Android platform (run once)
2. `npm run cap:sync` — builds web app and syncs to Android project
3. Open Android Studio via `npm run cap:open`
4. Build APK: `./gradlew assembleRelease` or AAB: `./gradlew bundleRelease` in the `android/` folder
5. AndroidManifest.xml permissions needed: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `INTERNET`

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (Replit DB)
- `GEMINI_API_KEY` — Google Gemini AI key (set in Replit Secrets)
- `VITE_POSTHOG_KEY` — PostHog telemetry capture key (in .env)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — Supabase credentials

## Verification
- Workflow `Start application` runs `npm run dev` on port 5000.
- App verified running in Replit preview without runtime errors.
- Phase 3 changes tested and visible in preview.

### Phase 4 — Soft Neutral iOS Redesign
- **Design system**: New "Soft Neutral" palette in `src/index.css` & `tailwind.config.ts` — bg `#F8F9FA`, charcoal text `#2D3436`, amber `#FBBF24` reserved exclusively for primary CTAs, status highlights, and active map routes. Cards now use `rounded-xl` (20px), no 1px borders, and `shadow-soft` (0 10px 30px rgba(0,0,0,0.04)).
- **Utilities**: Added `.glass`, `.glass-strong` (frosted), `.island` (info groupings), `.shadow-soft/float/pop`, `.glow-amber`, `.route-glow`, `.heavy-label`, plus pill classes (`.pill`, `.pill-amber`, `.pill-success`, `.pill-warning`, `.pill-danger`, `.pill-muted`, `.pill-charcoal`). Legacy `.bento-card`, `.industrial-border`, `.amber-badge` aliased to soft equivalents.
- **Base UI**: `card.tsx` (rounded-xl, shadow-soft, no border), `button.tsx` (rounded-full, soft+charcoal variants), `badge.tsx` (soft pill variants), `input.tsx` (rounded-2xl, secondary fill, no border).
- **Navigation**: `BottomTabs` rebuilt as floating frosted-glass pill nav with thin-stroke icons. `AppSidebar` trigger uses glass pill, profile avatar gets `glow-amber`.
- **Map**: `LiveTrackingMap` shows triple-stroke glowing amber Polyline + amber truck pin; floating glass LIVE pill, last-update pill, and inset bottom tracking card with ETA/speed/distance. `DriverHomeView` & `ShipperLiveView` use grayscale tile base + amber/charcoal markers.
- **Loadboard**: `driver/LoadCard` rebuilt spacious with horizontal Processing → Transit → Delivered amber dot/line progress and soft pills.
- **Verification**: `VerificationCenter` `StatusBadge` now soft pill spans (pale amber Pending). `DocUploadCard` uses secondary icon tile + bold title + status pill.
- **Settings**: `SettingItem` is rounded-2xl with secondary background; sidebar items use soft hover.
- **Auth/Onboarding**: `AuthPage` card uses `shadow-float`, role toggles are rounded-2xl pills with amber ring when selected. `RoleSelectPage` cards lose heavy borders, gain amber-glow icon tiles.
- **Theme**: Light is the default theme (`useTheme` defaults to 'light'); dark mode is a soft premium dark (not industrial).

### Phase 6 — AI matching, live GPS, carriers browse, telemetry
- **Tonnes/kg toggle**: `ShipperCreateLoad` weight field has a kg/tonnes toggle pill. Internally always stored as kg (`weight_lbs` column reused). Truck recommendation re-fires on weight change.
- **AI truck recommendation**: `recommendTruck(kgWeight, description)` heuristic suggests truck type while shipper types; rendered as inline pill below weight field.
- **Apple sign-in removed**: `AuthPage` now has a single full-width Google button. Google still routes through `comingSoon('Google sign-in')` toast — needs Google OAuth credentials wired (free tier blocker).
- **Live driver GPS tracking**: HTTP-based publish/poll model (replaces broken Supabase Realtime).
  - Server: `loads` table got `driver_lat`, `driver_lng`, `driver_speed`, `driver_heading`, `driver_location_updated_at` columns; `profiles` got `city`, `country`. New endpoints: `POST /api/driver/location` (driver publishes), `GET /api/loads/:id/tracking` (shipper/anyone polls).
  - Driver: `useDriverTracking(activeLoadId, driverId)` hook uses `navigator.geolocation.watchPosition` + 8s heartbeat to POST coords. Wired into `DriverActiveView` for the first in-transit/picked-up/accepted active load.
  - Shipper: `LiveTrackingMap` polls the tracking endpoint every 5s and animates the amber trail.
- **Browse Carriers (shipper)**: New `ShipperCarriersView` at route `/shipper/carriers`, linked from sidebar. Filter sheet: truck-type chips (12 types), verified-only toggle, distance-radius slider (uses `navigator.geolocation` for shipper position; haversine to geocoded carrier city via Nominatim). Shows avatar, verified badge, truck label, city + distance, rating, completed-trips count.
- **Map zoom-to-content**: `ShipperLiveView` `FitBounds` now centers on user's geolocation (city zoom 12) when no shipments yet, instead of country centroid. Final fallback is Harare, not the country centroid.
- **PostHog wiring**: `useAuth` calls `identifyUser(id, {email})` on session restore + auth change; emits `signed_in` / `signed_up` events; `resetTracking()` on signOut. `ShipperCreateLoad` emits `load_posted` with truck/weight/budget metadata on success. PostHog still requires `VITE_POSTHOG_KEY` env var to actually send events.

### Phase 5 — Auth redesign + Privacy & Consent
- **AuthPage redesign**: iOS pill-card aesthetic. Login has Email/Phone toggle pills, leading-icon inputs, Remember me + Forgot Password row, Log In button, "Or Continue With" with Google/Apple placeholder buttons. Signup field order: Full Name → Email → Phone → Country/City (replaced "State" with "City", country-filtered city list) → Home Address → New Password → Confirm Password → Role pills → Terms checkbox.
- **H logo enlargement**: AuthPage tile is now `h-20 w-20 rounded-3xl` with logo `size={72}`; RoleSelectPage tiles are `h-16 w-16` with logo `size={56}`.
- **Privacy & Terms pages**: `src/pages/PrivacyPolicy.tsx` and `src/pages/Terms.tsx`; routes `/privacy` and `/terms` in `src/App.tsx`. Auth-page Terms/Privacy links navigate here.
- **ConsentGate**: `src/components/ConsentGate.tsx` wraps all routes inside `AuthProvider`. After auth, if no consent record exists for the user, a modal overlay forces them to accept Terms+Privacy and choose Notifications/Location toggles before they can use the app. Acceptance is stored in `localStorage` under `hauliq_consent_v1_<userId>`. If the user grants notifications/location, the gate triggers the corresponding browser permission prompts. Bumping `CONSENT_VERSION` re-prompts everyone.
