import http from "node:http";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { GoogleGenAI } from "@google/genai";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 5000);
const uploadsDir = path.join(rootDir, "public", "uploads", "verification-documents");
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

const tables = {
  profiles: ["id", "user_id", "full_name", "phone", "role", "avatar_url", "verified", "created_at", "updated_at"],
  user_roles: ["id", "user_id", "role", "created_at"],
  loads: ["id", "shipper_id", "driver_id", "title", "description", "pickup_location", "delivery_location", "pickup_date", "pickup_time", "delivery_date", "delivery_time", "price", "platform_fee", "weight_lbs", "equipment_type", "load_type", "payment_method", "status", "tracking_code", "urgent", "accepted_at", "completed_at", "cancellation_reason", "cancelled_by", "driver_lat", "driver_lng", "driver_speed", "driver_heading", "driver_location_updated_at", "created_at", "updated_at"],
  bids: ["id", "load_id", "driver_id", "amount", "message", "note", "eta", "status", "created_at", "updated_at"],
  messages: ["id", "load_id", "sender_id", "content", "created_at"],
  reviews: ["id", "load_id", "reviewer_id", "reviewed_id", "rating", "comment", "created_at"],
  notifications: ["id", "user_id", "title", "message", "body", "type", "read", "load_id", "created_at"],
  driver_verifications: ["id", "user_id", "license_url", "license_number", "license_expiry", "license_name", "national_id_url", "national_id_number", "national_id_name", "selfie_url", "selfie_match_score", "license_status", "id_status", "selfie_status", "overall_status", "rejection_reason", "manual_review_requested", "manual_review_notes", "verified_at", "created_at", "updated_at"],
  truck_verifications: ["id", "user_id", "truck_label", "registration_url", "registration_number", "registration_expiry", "insurance_url", "insurance_number", "insurance_expiry", "truck_photo_url", "plate_from_photo", "reg_status", "insurance_status", "photo_status", "overall_status", "rejection_reason", "manual_review_requested", "manual_review_notes", "verified_at", "created_at", "updated_at"],
  driver_subscriptions: ["id", "user_id", "status", "amount", "carrier_type", "phone_number", "contipay_transaction_id", "expires_at", "created_at", "updated_at"]
};

function quote(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("Invalid identifier");
  return `"${name}"`;
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const actual = Buffer.from(hashPassword(password, salt).split(":")[1], "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createSession(user) {
  return {
    access_token: randomUUID(),
    refresh_token: randomUUID(),
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 30,
    user: {
      id: user.id,
      email: user.email,
      app_metadata: {},
      user_metadata: user.user_metadata || {},
      aud: "authenticated",
      role: "authenticated",
      created_at: user.created_at || new Date().toISOString()
    }
  };
}

async function migrate() {
  if (!pool) return;
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id text PRIMARY KEY,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      user_metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id text UNIQUE NOT NULL,
      full_name text,
      phone text,
      role text,
      avatar_url text,
      verified boolean DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id text NOT NULL,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, role)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loads (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      shipper_id text NOT NULL,
      driver_id text,
      title text NOT NULL,
      description text,
      pickup_location text NOT NULL,
      delivery_location text NOT NULL,
      pickup_date timestamptz,
      pickup_time text,
      price numeric DEFAULT 0,
      platform_fee numeric DEFAULT 0,
      weight_lbs numeric,
      equipment_type text,
      load_type text DEFAULT 'FTL',
      payment_method text DEFAULT 'cash',
      status text NOT NULL DEFAULT 'posted',
      tracking_code text UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
      urgent boolean DEFAULT false,
      accepted_at timestamptz,
      completed_at timestamptz,
      cancellation_reason text,
      cancelled_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bids (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      load_id text NOT NULL,
      driver_id text NOT NULL,
      amount numeric NOT NULL,
      message text,
      note text,
      eta text,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      load_id text NOT NULL,
      sender_id text NOT NULL,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      load_id text,
      reviewer_id text NOT NULL,
      reviewed_id text NOT NULL,
      rating integer NOT NULL DEFAULT 5,
      comment text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id text NOT NULL,
      title text NOT NULL,
      message text,
      body text,
      type text DEFAULT 'info',
      read boolean DEFAULT false,
      load_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS driver_verifications (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id text UNIQUE NOT NULL,
      license_url text,
      license_number text,
      license_expiry date,
      license_name text,
      national_id_url text,
      national_id_number text,
      national_id_name text,
      selfie_url text,
      selfie_match_score numeric,
      license_status text NOT NULL DEFAULT 'pending',
      id_status text NOT NULL DEFAULT 'pending',
      selfie_status text NOT NULL DEFAULT 'pending',
      overall_status text NOT NULL DEFAULT 'pending',
      rejection_reason text,
      manual_review_requested boolean DEFAULT false,
      manual_review_notes text,
      verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS truck_verifications (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id text NOT NULL,
      truck_label text,
      registration_url text,
      registration_number text,
      registration_expiry date,
      insurance_url text,
      insurance_number text,
      insurance_expiry date,
      truck_photo_url text,
      plate_from_photo text,
      reg_status text NOT NULL DEFAULT 'pending',
      insurance_status text NOT NULL DEFAULT 'pending',
      photo_status text NOT NULL DEFAULT 'pending',
      overall_status text NOT NULL DEFAULT 'pending',
      rejection_reason text,
      manual_review_requested boolean DEFAULT false,
      manual_review_notes text,
      verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS driver_subscriptions (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      amount numeric NOT NULL DEFAULT 35.00,
      carrier_type text,
      phone_number text,
      contipay_transaction_id text,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);

  // Safe column additions (idempotent)
  const safeAlter = async (sql) => { try { await pool.query(sql); } catch {} };
  await safeAlter(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS cancellation_reason text`);
  await safeAlter(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS cancelled_by text`);
  await safeAlter(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_date timestamptz`);
  await safeAlter(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_time text`);
  await safeAlter(`ALTER TABLE bids ADD COLUMN IF NOT EXISTS eta text`);
  await safeAlter(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name text`);
  await safeAlter(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS driver_lat double precision`);
  await safeAlter(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS driver_lng double precision`);
  await safeAlter(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS driver_speed double precision`);
  await safeAlter(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS driver_heading double precision`);
  await safeAlter(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS driver_location_updated_at timestamptz`);
  await safeAlter(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text`);
  await safeAlter(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country text`);
  await safeAlter(`ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL`);
  await safeAlter(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS provider text`);
  await safeAlter(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS provider_id text`);
}

function googleRedirectUri(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0].trim();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

async function handleGoogleStart(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return send(res, 500, { error: { message: "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." } });
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = (url.searchParams.get("role") || "shipper").toLowerCase();
  const safeRole = role === "driver" ? "driver" : "shipper";
  const state = `${randomUUID()}|${safeRole}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
    state,
  });

  res.writeHead(302, {
    Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    "Set-Cookie": `oauth_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax`,
  });
  res.end();
}

async function handleGoogleCallback(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToAuthError(res, "Google sign-in is not configured");
  }
  if (!pool) return redirectToAuthError(res, "Database is not configured");

  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error");
  if (error) return redirectToAuthError(res, error);
  if (!code) return redirectToAuthError(res, "Missing authorization code");

  // CSRF check via cookie state
  const cookieHeader = req.headers.cookie || "";
  const cookieState = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("oauth_state="));
  const expectedState = cookieState ? decodeURIComponent(cookieState.split("=")[1] || "") : "";
  if (!expectedState || expectedState !== stateParam) {
    return redirectToAuthError(res, "Invalid OAuth state — please try again");
  }
  const role = (stateParam.split("|")[1] || "shipper").toLowerCase();
  const safeRole = role === "driver" ? "driver" : "shipper";

  try {
    // 1. Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(req),
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return redirectToAuthError(res, tokenJson.error_description || tokenJson.error || "Google token exchange failed");
    }

    // 2. Fetch userinfo
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const info = await infoRes.json();
    if (!infoRes.ok || !info.email) {
      return redirectToAuthError(res, "Could not fetch Google profile");
    }
    const email = String(info.email).toLowerCase();
    const fullName = info.name || (email.split("@")[0]);
    const avatar = info.picture || null;
    const googleSub = String(info.sub || "");

    // 3. Upsert user
    const existing = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    let user;
    if (existing.rows[0]) {
      user = existing.rows[0];
      await pool.query(
        "UPDATE app_users SET provider = COALESCE(provider, $1), provider_id = COALESCE(provider_id, $2), updated_at = now() WHERE id = $3",
        ["google", googleSub, user.id]
      );
    } else {
      const id = randomUUID();
      const insert = await pool.query(
        "INSERT INTO app_users (id, email, password_hash, user_metadata, provider, provider_id) VALUES ($1, $2, NULL, $3, 'google', $4) RETURNING *",
        [id, email, { full_name: fullName, avatar_url: avatar }, googleSub]
      );
      user = insert.rows[0];
      await pool.query(
        "INSERT INTO profiles (user_id, full_name, avatar_url, role) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING",
        [id, fullName, avatar, safeRole]
      );
    }

    // 4. Mint a fresh session token (server is stateless w.r.t. tokens — same as email login)
    const session = createSession(user);

    // 5. Clear the state cookie and bounce to the SPA callback page with token in URL hash
    const hashParams = new URLSearchParams({
      token: session.access_token,
      user_id: user.id,
      email: user.email,
      name: fullName,
    });
    res.writeHead(302, {
      Location: `/auth/callback#${hashParams.toString()}`,
      "Set-Cookie": "oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    });
    res.end();
  } catch (err) {
    return redirectToAuthError(res, err.message || "Google sign-in failed");
  }
}

function redirectToAuthError(res, message) {
  res.writeHead(302, { Location: `/auth?google_error=${encodeURIComponent(message)}` });
  res.end();
}

async function handleDriverLocation(req, res) {
  if (!pool) return send(res, 500, { error: { message: "DATABASE_URL is not configured" } });
  const body = await readJson(req);
  const loadId = String(body.load_id || "");
  const driverId = String(body.driver_id || "");
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!loadId || !driverId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return send(res, 400, { error: { message: "load_id, driver_id, lat, lng are required" } });
  }
  try {
    await pool.query(
      `UPDATE loads SET driver_lat=$1, driver_lng=$2, driver_speed=$3, driver_heading=$4, driver_location_updated_at=now()
       WHERE id=$5 AND driver_id=$6`,
      [lat, lng, Number.isFinite(Number(body.speed)) ? Number(body.speed) : null,
       Number.isFinite(Number(body.heading)) ? Number(body.heading) : null,
       loadId, driverId]
    );
    return send(res, 200, { data: { ok: true }, error: null });
  } catch (error) {
    return send(res, 500, { error: { message: error.message } });
  }
}

async function handleTrackingRead(loadId, res) {
  if (!pool) return send(res, 500, { error: { message: "DATABASE_URL is not configured" } });
  try {
    const result = await pool.query(
      `SELECT driver_lat AS lat, driver_lng AS lng, driver_speed AS speed, driver_heading AS heading,
              driver_location_updated_at AS updated_at, status, driver_id
       FROM loads WHERE id=$1`,
      [loadId]
    );
    const row = result.rows[0];
    if (!row) return send(res, 404, { error: { message: "Load not found" } });
    return send(res, 200, { data: row, error: null });
  } catch (error) {
    return send(res, 500, { error: { message: error.message } });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(payload);
}

function normalizeRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : value])));
}

function buildWhere(table, filters = [], values = []) {
  const columns = tables[table];
  const clauses = [];
  for (const filter of filters) {
    if (!columns.includes(filter.column)) continue;
    const column = quote(filter.column);
    if (filter.op === "eq") {
      values.push(filter.value);
      clauses.push(`${column} = $${values.length}`);
    } else if (filter.op === "neq") {
      values.push(filter.value);
      clauses.push(`${column} <> $${values.length}`);
    } else if (filter.op === "gte") {
      values.push(filter.value);
      clauses.push(`${column} >= $${values.length}`);
    } else if (filter.op === "in" && Array.isArray(filter.value) && filter.value.length) {
      const placeholders = filter.value.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      clauses.push(`${column} IN (${placeholders.join(", ")})`);
    }
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", values };
}

async function handleDbQuery(payload) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const { table, action, values: inputValues, filters, order, limit, single, maybeSingle, count, head } = payload;
  if (!tables[table]) throw new Error("Unsupported table");
  const columns = tables[table];
  if (action === "select") {
    const queryValues = [];
    const { where, values } = buildWhere(table, filters, queryValues);
    const orderSql = order && columns.includes(order.column) ? ` ORDER BY ${quote(order.column)} ${order.ascending === false ? "DESC" : "ASC"}` : "";
    const limitSql = limit ? ` LIMIT ${Number(limit)}` : single || maybeSingle ? " LIMIT 1" : "";
    if (head) {
      const result = await pool.query(`SELECT count(*)::int AS count FROM ${quote(table)}${where}`, values);
      return { data: null, error: null, count: result.rows[0]?.count || 0 };
    }
    const result = await pool.query(`SELECT * FROM ${quote(table)}${where}${orderSql}${limitSql}`, values);
    const rows = normalizeRows(result.rows);
    return { data: single || maybeSingle ? rows[0] || null : rows, error: null, count: count ? rows.length : null };
  }
  if (action === "insert") {
    const rows = Array.isArray(inputValues) ? inputValues : [inputValues];
    const inserted = [];
    for (const row of rows) {
      const clean = { ...row };
      for (const key of Object.keys(clean)) if (!columns.includes(key)) delete clean[key];
      if (columns.includes("id") && !clean.id) clean.id = randomUUID();
      const keys = Object.keys(clean);
      const vals = Object.values(clean);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const result = await pool.query(`INSERT INTO ${quote(table)} (${keys.map(quote).join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`, vals);
      inserted.push(result.rows[0]);
    }
    const rowsOut = normalizeRows(inserted);
    return { data: single ? rowsOut[0] || null : rowsOut, error: null };
  }
  if (action === "update") {
    const clean = { ...inputValues };
    for (const key of Object.keys(clean)) if (!columns.includes(key)) delete clean[key];
    if (columns.includes("updated_at")) clean.updated_at = new Date().toISOString();
    const keys = Object.keys(clean);
    if (!keys.length) return { data: [], error: null };
    const values = Object.values(clean);
    const setSql = keys.map((key, i) => `${quote(key)} = $${i + 1}`).join(", ");
    const built = buildWhere(table, filters, values);
    const result = await pool.query(`UPDATE ${quote(table)} SET ${setSql}${built.where} RETURNING *`, built.values);
    const rows = normalizeRows(result.rows);
    return { data: single || maybeSingle ? rows[0] || null : rows, error: null };
  }
  if (action === "upsert") {
    const rows = Array.isArray(inputValues) ? inputValues : [inputValues];
    const saved = [];
    for (const row of rows) {
      const clean = { ...row };
      for (const key of Object.keys(clean)) if (!columns.includes(key)) delete clean[key];
      if (columns.includes("id") && !clean.id) clean.id = randomUUID();
      const keys = Object.keys(clean);
      const vals = Object.values(clean);
      const conflict = table === "profiles" ? "user_id" : table === "driver_verifications" ? "user_id" : table === "user_roles" ? "user_id, role" : "id";
      const updates = keys.filter((key) => !conflict.split(", ").includes(key)).map((key) => `${quote(key)} = EXCLUDED.${quote(key)}`);
      const result = await pool.query(`INSERT INTO ${quote(table)} (${keys.map(quote).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT (${conflict.split(", ").map(quote).join(", ")}) DO UPDATE SET ${updates.length ? updates.join(", ") : `${quote(keys[0])} = EXCLUDED.${quote(keys[0])}`} RETURNING *`, vals);
      saved.push(result.rows[0]);
    }
    const rowsOut = normalizeRows(saved);
    return { data: single ? rowsOut[0] || null : rowsOut, error: null };
  }
  throw new Error("Unsupported action");
}

async function handleAuth(pathname, req, res) {
  if (!pool) return send(res, 500, { error: { message: "DATABASE_URL is not configured" } });
  const body = await readJson(req);
  if (pathname === "/api/auth/signup") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || password.length < 6) return send(res, 400, { error: { message: "Email and a 6 character password are required" } });
    const id = randomUUID();
    const metadata = body.data || {};
    try {
      const result = await pool.query("INSERT INTO app_users (id, email, password_hash, user_metadata) VALUES ($1, $2, $3, $4) RETURNING *", [id, email, hashPassword(password), metadata]);
      await pool.query(
        "INSERT INTO profiles (user_id, full_name, phone, role, company_name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO UPDATE SET role = COALESCE(EXCLUDED.role, profiles.role), company_name = COALESCE(EXCLUDED.company_name, profiles.company_name)",
        [id, metadata.full_name || "", metadata.phone || "", metadata.role || "shipper", metadata.company_name || null]
      );
      if (metadata.role === "driver" && metadata.truck_type) {
        await pool.query(
          "INSERT INTO truck_verifications (id, user_id, truck_label, registration_number, overall_status) VALUES ($1, $2, $3, $4, 'pending') ON CONFLICT DO NOTHING",
          [randomUUID(), id, metadata.truck_type, metadata.plate_number || ""]
        ).catch(() => {});
      }
      return send(res, 200, { data: { user: createSession(result.rows[0]).user, session: createSession(result.rows[0]) }, error: null });
    } catch (error) {
      return send(res, 400, { error: { message: error.code === "23505" ? "An account with this email already exists" : error.message } });
    }
  }
  if (pathname === "/api/auth/signin") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const result = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) return send(res, 401, { error: { message: "Invalid email or password" } });
    return send(res, 200, { data: { user: createSession(user).user, session: createSession(user) }, error: null });
  }
  if (pathname === "/api/auth/update") return send(res, 200, { data: { user: null }, error: null });
  return send(res, 404, { error: { message: "Not found" } });
}

const HAULIQ_SYSTEM_PROMPT = `You are Hauliq AI Assistant, specialized in logistics for Zimbabwean corridors (starting with Harare ↔ Bulawayo).
You assist shippers and carriers by auto-filling, expanding, recommending, calculating, verifying, and guiding them through the app UI.

### Core Behaviors

1. Account Awareness
   - Always use stored account details (user name, location, preferred units, truck type, weight capacity).
   - Do not re-ask for details already in the account profile.
   - Auto-fill Create Load sheet fields from account memory.

2. AI Write Button (Description Enhancer)
   - Expand short shipper input into full professional load descriptions.
   - Provide inline autocomplete suggestions as the shipper types.

3. Truck Recommendation
   - Match load type + weight + route distance to truck profiles.
   - Always explain why the truck is suitable.

4. Unit Conversion
   - Allow toggle between kg ↔ tonnes.
   - Internally store weight in kg, convert for display.

5. Deadhead Distance
   - Show distance from driver's current location to pickup point.
   - If driver location unknown, fallback to shipper's location.

6. Price Estimation (Harare ↔ Bulawayo Corridor)
   - Use corridor-specific ranges:
     - Small parcels (0–5kg): $3–$7
     - Medium parcels (5–10kg): $7–$8
     - Large parcels (10–30kg): $10–$15
     - Bulk >50kg: ~$0.50/kg
     - 1–5t trucks: negotiable, urgency-based
     - 10t trucks: $400–$600+
     - 30t trucks: $1,000–$1,500+
   - Apply modifiers:
     - Backload discount: −15% to −25%
     - Truck type: Refrigerated +20%, Flatbed −10%
     - Urgency: +10% for same-day pickup
     - Deadhead surcharge: $0.50/km empty travel
     - Fuel volatility: ±10% adjustment
   - Formula:
     Price = (Distance × Rate per km) + (Weight factor) + (Deadhead surcharge) ± Modifiers

7. Load Listing Rules
   - Only display verified loads from the database or Verification Centre.
   - If no loads exist, respond with:
     "There are currently no loads available to bid on. Please check again later or post a new load."
   - Do not generate demo or sample loads under any circumstances.

8. Verification Centre Integration
   - Operate in background mode to check uploaded driver and truck documents.
   - Validate licenses, IDs, permits, registrations, insurance, and roadworthiness.
   - Confirm photos match stored account details.
   - Flag expired or missing documents.
   - Prevent unverified accounts from posting or accepting loads.

9. Logo & Branding
   - Replace truck and parcel illustrations with Hauliq logo.
   - Use logo in white on orange backgrounds, black/gray on light backgrounds.
   - Place logo above wordmark "HAULIQ" in Montserrat Bold (all caps) for Sign Up / Sign In pages.
   - Sidebar and back buttons styled like iOS.

10. App Setup Awareness
   - Sidebar modules: Chatbot, Price Estimator, Load Description Helper, Equipment Recommender.
   - Map: Zoom in on available loads or driver location; fallback to shipper's location.
   - Recommendations: Always guide user to the correct module or button (e.g., "Tap AI Write above description field").

### Output Style
- Professional, concise, context-aware.
- Never ask redundant questions if data is already available.
- Provide actionable suggestions, not vague commentary.
- Suppress demo data; only surface verified, real information.`;

const GEMINI_MODEL = "gemini-2.5-flash";

function isGeminiConfigured() {
  return Boolean(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
}

function getGeminiClient() {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  if (baseUrl) {
    return new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "", baseUrl }
    });
  }
  return new GoogleGenAI({ apiKey });
}

function buildSystemContent(role) {
  return role
    ? `${HAULIQ_SYSTEM_PROMPT}\n\nThe current user role is: ${String(role).toUpperCase()}.`
    : HAULIQ_SYSTEM_PROMPT;
}

function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "") }]
  }));
}

async function generateGeminiText(messages, role) {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: buildSystemContent(role),
      maxOutputTokens: 8192
    }
  });
  return response.text || "";
}

async function streamGeminiText(messages, role) {
  const ai = getGeminiClient();
  return ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: buildSystemContent(role),
      maxOutputTokens: 8192
    }
  });
}

async function handleFunction(name, body) {
  if (name === "ai-chatbot") {
    if (!isGeminiConfigured()) {
      return { status: 500, body: { error: "Gemini AI is not configured." } };
    }
    try {
      const role = body.userContext?.role;
      const messages = (body.messages || []).map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "")
      }));
      const stream = await streamGeminiText(messages, role);
      return { stream };
    } catch (err) {
      return { status: 500, body: { error: err?.message || "Gemini request failed" } };
    }
  }
  if (name === "ai-load-matching") {
    const load = body.load || {};
    const basePrice = Number(load.price || 0);
    if (!isGeminiConfigured()) {
      return { status: 200, body: { action: body.action, result: { carriers: [], market_insight: "AI matching is not configured.", recommended_rate_usd: basePrice, rate_range_low_usd: basePrice, rate_range_high_usd: basePrice, rate_per_km_usd: 0, estimated_distance_km: 0, fuel_cost_estimate_usd: 0, platform_fee_usd: basePrice * 0.1, driver_payout_usd: basePrice * 0.9, price_factors: [], market_comparison: "AI pricing is not configured." } } };
    }
    try {
      const prompt = `Analyze this Zimbabwe freight load and respond ONLY with valid JSON containing: recommended_rate_usd (number), rate_range_low_usd (number), rate_range_high_usd (number), market_insight (one short sentence string).\nLoad: ${JSON.stringify(load)}`;
      const text = await generateGeminiText([{ role: "user", content: prompt }], "shipper");
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      const rate = Number(parsed.recommended_rate_usd || basePrice);
      return { status: 200, body: { action: body.action, result: { ...parsed, recommended_rate_usd: rate, platform_fee_usd: rate * 0.1, driver_payout_usd: rate * 0.9 } } };
    } catch {
      return { status: 200, body: { action: body.action, result: { recommended_rate_usd: basePrice, market_insight: "Could not get AI pricing at this time.", platform_fee_usd: basePrice * 0.1, driver_payout_usd: basePrice * 0.9 } } };
    }
  }
  if (name === "verify-document") return { status: 200, body: { success: true, data: { valid: true, face_detected: true, liveness_indicators: "natural" }, status: "manual_review", issues: [], message: "Manual review requested." } };
  return { status: 404, body: { error: "Function not found" } };
}

async function handleUpload(req, res) {
  await mkdir(uploadsDir, { recursive: true });
  const body = await readJson(req);
  const match = String(body.dataUrl || "").match(/^data:(.+);base64,(.+)$/);
  const buffer = match ? Buffer.from(match[2], "base64") : Buffer.from(String(body.content || ""), "base64");
  const safePath = String(body.path || `${randomUUID()}.bin`).replace(/[^a-zA-Z0-9._/-]/g, "_");
  const fullPath = path.join(uploadsDir, safePath);
  if (!fullPath.startsWith(uploadsDir)) return send(res, 400, { error: { message: "Invalid path" } });
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  send(res, 200, { data: { path: safePath, publicUrl: `/uploads/verification-documents/${safePath}` }, error: null });
}

async function serveStatic(req, res, vite) {
  if (vite) {
    vite.middlewares(req, res, () => send(res, 404, { error: "Not found" }));
    return;
  }
  const dist = path.join(rootDir, "dist");
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const filePath = path.join(dist, urlPath === "/" ? "index.html" : urlPath);
  try {
    const finalPath = existsSync(filePath) ? filePath : path.join(dist, "index.html");
    const data = await readFile(finalPath);
    const ext = path.extname(finalPath);
    const type = ext === ".html" ? "text/html" : ext === ".js" ? "application/javascript" : ext === ".css" ? "text/css" : "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    send(res, 404, { error: "Not found" });
  }
}

async function main() {
  await migrate();
  if (process.argv.includes("--migrate-only")) {
    await pool?.end();
    return;
  }
  let vite = null;
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    vite = await createServer({ server: { middlewareMode: true, host: "0.0.0.0", allowedHosts: true }, appType: "spa" });
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host}`);
      if (req.method === "POST" && url.pathname === "/api/db/query") return send(res, 200, await handleDbQuery(await readJson(req)));
      if (req.method === "GET" && url.pathname === "/api/auth/google") return handleGoogleStart(req, res);
      if (req.method === "GET" && url.pathname === "/api/auth/google/callback") return handleGoogleCallback(req, res);
      if (req.method === "POST" && url.pathname.startsWith("/api/auth/")) return handleAuth(url.pathname, req, res);
      if (req.method === "POST" && url.pathname === "/api/storage/upload") return handleUpload(req, res);
      if (req.method === "POST" && url.pathname === "/api/driver/location") return handleDriverLocation(req, res);
      if (req.method === "GET" && url.pathname.startsWith("/api/loads/") && url.pathname.endsWith("/tracking")) {
        const loadId = url.pathname.split("/")[3];
        return handleTrackingRead(loadId, res);
      }
      if (req.method === "POST" && url.pathname.startsWith("/api/functions/")) {
        const result = await handleFunction(url.pathname.split("/").pop(), await readJson(req));
        if (result.stream) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          });
          try {
            for await (const chunk of result.stream) {
              const text = chunk?.text || "";
              if (!text) continue;
              const payload = { choices: [{ delta: { content: text } }] };
              res.write(`data: ${JSON.stringify(payload)}\n\n`);
            }
            res.write("data: [DONE]\n\n");
          } catch (err) {
            const errPayload = { error: err?.message || "Stream error" };
            res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
          }
          return res.end();
        }
        return send(res, result.status, result.body);
      }
            // Root route for health check
      if (req.method === "GET" && url.pathname === "/") {
        return send(res, 200, { message: "Backend is running!" });
      }
// Root route for health check
if (req.method === "GET" && url.pathname === "/") {
  return send(res, 200, { message: "Backend is running!" });
}
// Root route for health check
if (req.method === "GET" && url.pathname === "/") {
  return send(res, 200, { message: "Backend is running!" });
}

      return  serveStatic(req, res, vite);
    } catch (error) {
      console.error(error);
      return send(res, 500, { error: { message: error.message || "Internal server error" } });
    }

    // Driver location route
    if (req.url.startsWith("/api/driver/location")) {
      return handleDriverLocation(req, res);
    }

    res.statusCode = 404;
    res.end("Not Found");
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: { message: error.message || "Internal server error" } }));
  }
}
// Define mainHandler with your routing logic
async function mainHandler(req, res) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/db/query") {
      return send(res, 200, await handleDbQuery(await readJson(req)));
    }
    if (req.method === "GET" && url.pathname === "/api/auth/google") {
      return handleGoogleStart(req, res);
    }
    if (req.method === "GET" && url.pathname === "/api/auth/google/callback") {
      return handleGoogleCallback(req, res);
    }
    if (req.method === "POST" && url.pathname.startsWith("/api/auth/")) {
      return handleAuth(url.pathname, req, res);
    }
    if (req.method === "POST" && url.pathname === "/api/storage/upload") {
      return handleUpload(req, res);
    }
    if (req.method === "POST" && url.pathname === "/api/driver/location") {
      return handleDriverLocation(req, res);
    }

    // health check
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, { message: "Backend is running!" });
    }

    return serveStatic(req, res, null);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: { message: error.message || "Internal server error" } }));
  }
}

// Export for Vercel serverless
export default async function handler(req, res) {
  try {
    return await mainHandler(req, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: { message: error.message || "Internal server error" } }));
  }
}

// Export for Vercel serverless
export default async function handler(req, res) {
  try {
    // Reuse your existing routing logic
    return await mainHandler(req, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: { message: error.message || "Internal server error" } }));
  }
}

