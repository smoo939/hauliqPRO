# Project Notes

## Overview
Hauliq is a Vite React application migrated from Lovable to run on Replit.

## Current Architecture
- The app runs through `npm run dev`, which starts `server/index.mjs` on port 5000.
- The server serves the Vite React app in development and exposes local API routes under `/api`.
- Browser-side Supabase and Lovable runtime dependencies have been removed.
- The retained `src/integrations/supabase/client.ts` file is a compatibility adapter for existing app code. It forwards auth, database, storage, realtime no-op subscriptions, and migrated function calls to the Replit server.
- PostgreSQL access is server-side only through `DATABASE_URL`; database credentials are not exposed to the browser.
- Local-first behavior is implemented in `src/lib/localFirst.ts`. The UI reads cached loads and bid state from a browser/device-local store, queues submitted bids immediately, and syncs them to the server in the background when connectivity is available.
- `@capacitor/network` is used to detect reconnect events; `@capacitor-community/sqlite` is loaded for mobile builds, with IndexedDB-backed browser storage used in the web preview.

## Database
- `npm run db:push` initializes the Replit PostgreSQL schema.
- Tables include app users, profiles, roles, loads, bids, messages, reviews, notifications, verifications, trucks, and driver subscriptions.
- Local device tables/stores include `available_loads`, `pending_bids`, and `sync_meta`.

## External Services
- AI chatbot requests are routed through `/api/functions/ai-chatbot` and read `LOVABLE_API_KEY` only on the server if configured.
- If `LOVABLE_API_KEY` is not configured, AI features return a configuration message instead of exposing secrets or failing the app startup.
- Google OAuth from Lovable is disabled in this migration; email/password auth is handled by the Replit server.

## Verification
- Workflow `Start application` runs `npm run dev` on port 5000.
- The app has been restarted and verified in the Replit preview without runtime errors.
- Offline/local-first changes were restarted and verified in the preview. Workflow logs show the server running normally; browser logs only show non-blocking React Router/autocomplete warnings.