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
- AI chatbot requests are routed through `/api/functions/ai-chatbot` and use `GEMINI_API_KEY` from server environment.
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
