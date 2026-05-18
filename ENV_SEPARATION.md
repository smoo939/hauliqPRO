# Environment Variable Separation Strategy for Hauliq

## Overview
This document enforces **strict separation** of Supabase environment variables between frontend (Vite) and backend (Node.js/Replit).

**Goal:** Frontend NEVER touches `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or other backend secrets.

---

## Frontend (Vite React)

### Allowed Environment Variables
Frontend code in `src/` can ONLY use variables prefixed with `VITE_`:

```env
# Frontend only (.env.local or Vite build)
VITE_SUPABASE_URL=https://ajxggjeuxfjshrovmzzx.supabase.co
VITE_SUPABASE_ANON_KEY=sb-publishable-xxxxxxxx
VITE_POSTHOG_KEY=phc_xxxxxxx
```

### Access Pattern
```typescript
// ✅ CORRECT: Use import.meta.env for Vite variables
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ❌ WRONG: Never access process.env in browser code
const wrong = process.env.DATABASE_URL; // Undefined (safe) or security risk
```

### Supabase Client Setup
File: `src/integrations/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

const _supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export const supabase = {
  auth: _supabaseClient.auth,
  // ... rest of wrapper
};
```

### Frontend Diagnostic Log
File: `src/main.tsx`

```typescript
const diagnosticLog = () => {
  console.log('✅ Frontend Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('✅ Frontend Supabase Anon Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Loaded' : 'MISSING');
  
  // Verify backend secrets are NOT exposed
  if (import.meta.env.DATABASE_URL) {
    console.error('❌ SECURITY RISK: DATABASE_URL exposed to browser!');
  }
};

if (import.meta.env.DEV) diagnosticLog();
```

---

## Backend (Node.js / server/index.mjs)

### Allowed Environment Variables
Backend server can use all environment variables (no `VITE_` prefix needed):

```env
# Backend only (Replit secrets or .env)
DATABASE_URL=postgresql://postgres:PASSWORD@db.ajxggjeuxfjshrovmzzx.supabase.co:5432/postgres
SUPABASE_URL=https://ajxggjeuxfjshrovmzzx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxx
AI_INTEGRATIONS_GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxx
```

### Access Pattern
```javascript
// ✅ CORRECT: Use process.env in Node.js
const dbUrl = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: dbUrl });

// DATABASE_URL is ONLY used here, not in src/
```

### PostgreSQL Connection
```javascript
// server/index.mjs
const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

async function migrate() {
  if (!pool) return; // Safe fallback
  // Database operations...
}
```

### Backend Diagnostic Log
File: `server/index.mjs`

```javascript
const diagnosticLog = () => {
  console.log('✅ Backend Database URL:', process.env.DATABASE_URL ? 'Configured' : '❌ MISSING');
  console.log('✅ Backend Supabase Service Role:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : '⚠️ Optional');
};

diagnosticLog();
```

---

## Vite Configuration

File: `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Environment variables are automatically filtered by Vite
  // Only VITE_* variables are available to src/
}));
```

---

## CI/CD Enforcement

GitHub Action: `.github/workflows/env-separation-qa.yml`

### Checks Performed:
1. **Reject DATABASE_URL in src/** - Fails build if found
2. **Reject SUPABASE_SERVICE_ROLE_KEY in src/** - Fails build if found
3. **Reject GOOGLE_CLIENT_SECRET in src/** - Fails build if found
4. **Verify VITE_SUPABASE_URL in client.ts** - Must exist
5. **Verify DATABASE_URL in server/index.mjs** - Must exist
6. **Scan for hardcoded secrets** - Pattern matching for API keys
7. **Verify built bundle is clean** - No backend secrets in dist/

### Run Command:
```bash
npm run build
# CI validates: grep -r "DATABASE_URL" src/ && exit 1 || echo "✅ Clean"
```

---

## Local Development Setup

### 1. Create `.env.local` (Frontend only)
```bash
VITE_SUPABASE_URL=https://ajxggjeuxfjshrovmzzx.supabase.co
VITE_SUPABASE_ANON_KEY=sb-publishable-xxxxxxxx
VITE_POSTHOG_KEY=phc_xxxxxxx
```

### 2. Set Backend Secrets via Replit Secrets
In Replit console:
```
DATABASE_URL=postgresql://...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxx
```

### 3. Run Dev Server
```bash
npm run dev
# Starts server/index.mjs on port 5000
# Vite serves frontend, backend handles /api routes
```

---

## QA Testing Checklist

### Frontend Verification
- [ ] `src/main.tsx` logs frontend env vars (dev mode)
- [ ] `src/integrations/supabase/client.ts` uses only `VITE_*` vars
- [ ] Browser DevTools: `import.meta.env.DATABASE_URL` is `undefined`
- [ ] No `process.env` in any `src/` file
- [ ] Built `dist/` contains no `DATABASE_URL` strings

### Backend Verification
- [ ] `server/index.mjs` logs backend env vars on startup
- [ ] Database pool initializes with `DATABASE_URL`
- [ ] `/api` routes access `process.env.DATABASE_URL` safely
- [ ] Service role key never exposed to browser

### CI/CD Verification
- [ ] PR fails if `DATABASE_URL` added to `src/`
- [ ] PR fails if `SUPABASE_SERVICE_ROLE_KEY` added to `src/`
- [ ] Build succeeds only if frontend uses `VITE_*` vars
- [ ] Built bundle passes secret scan

---

## Example: Prisma Schema

### ✅ CORRECT: Uses DATABASE_URL backend-only
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // Backend only
}

model User {
  id    String  @id @default(cuid())
  email String  @unique
}
```

### ❌ WRONG: Never import in src/
```typescript
// ❌ BAD - Don't do this
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient(); // Tries to connect from browser!
```

### ✅ CORRECT: API endpoint instead
```typescript
// src/hooks/useUsers.ts
async function getUsers() {
  // Call backend API, let server handle Prisma
  const response = await fetch('/api/users');
  return response.json();
}

// server/index.mjs
app.get('/api/users', async (req, res) => {
  // Server has access to DATABASE_URL
  const users = await prisma.user.findMany();
  res.json(users);
});
```

---

## Release GStack

### CEO Review (Design & Security)
- [ ] Environment variable separation approved
- [ ] No hardcoded secrets in code
- [ ] CI/CD gates properly configured

### QA Test
- [ ] Run `.github/workflows/env-separation-qa.yml`
- [ ] Verify frontend logs show only `VITE_*` vars
- [ ] Verify backend logs show secure config loading
- [ ] Test builds with and without backend vars
- [ ] Inspect dist/ bundle for any secrets

### Ship Release
- [ ] Merge PR with CI passing
- [ ] Deploy with proper Replit secrets configured
- [ ] Monitor logs: `console.group("🔐 Backend Environment Check")`
- [ ] Confirm no errors in browser console about missing env vars

---

## Troubleshooting

### "Missing VITE_SUPABASE_URL in browser"
- **Cause:** `.env.local` not created or Vite not restarted
- **Fix:** Create `.env.local` with `VITE_SUPABASE_URL`, then `npm run dev`

### "DATABASE_URL is not configured" error from backend
- **Cause:** Backend missing `DATABASE_URL` in Replit secrets
- **Fix:** Add `DATABASE_URL` to Replit Secrets (not `.env`)

### "DATABASE_URL found in src/" CI failure
- **Cause:** Accidental import or hardcoding
- **Fix:** Remove from code, use API endpoint instead

### Built bundle contains DATABASE_URL
- **Cause:** Vite was given non-`VITE_` prefixed variable
- **Fix:** Ensure CI doesn't pass `DATABASE_URL` to build step

---

## References
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Node.js process.env](https://nodejs.org/api/process.html#process_process_env)
- [PostgreSQL Connections](https://www.postgresql.org/docs/current/libpq-connect.html)
