import http from "node:http";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 5000);
const uploadsDir = path.join(rootDir, "public", "uploads", "verification-documents");
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

const tables = {
  profiles: ["id", "user_id", "full_name", "phone", "role", "avatar_url", "verified", "created_at", "updated_at"],
  user_roles: ["id", "user_id", "role", "created_at"],
  loads: ["id", "shipper_id", "driver_id", "title", "description", "pickup_location", "delivery_location", "pickup_date", "pickup_time", "delivery_date", "delivery_time", "price", "platform_fee", "weight_lbs", "equipment_type", "load_type", "payment_method", "status", "tracking_code", "urgent", "accepted_at", "completed_at", "cancellation_reason", "cancelled_by", "created_at", "updated_at"],
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

const HAULIQ_SYSTEM_PROMPT = `You are Hauliq AI Assistant, a logistics genius built to help shippers and carriers in Zimbabwe.
Your responsibilities include:

1. Role Awareness:
   - Detect whether the user is a SHIPPER (posting loads, seeking carriers, estimating prices, writing descriptions).
   - Detect whether the user is a CARRIER (finding loads, checking equipment fit, asking about routes or pricing).
   - Tailor responses accordingly.

2. Chatbot:
   - Answer user questions conversationally about loads, routes, pricing, and logistics.

3. Price Estimator:
   - Given origin, destination, weight, and load type, estimate freight price realistically.

4. Load Description Helper (AI Write):
   - When the user is on the Create Shipment sheet and invokes "AI Write," expand short shipment descriptions into detailed, professional postings.

5. Equipment Recommender:
   - Recommend the best truck or equipment type for the load and explain why.

6. Load Posting & Finding:
   - Help shippers post loads with clear steps.
   - Help carriers find loads in specified corridors.

7. ID on Loads:
   - Generate a unique identifier for each load when requested (format: HAULIQ-<date>-<random number>).

Rules:
- Always respond in clear, structured text.
- Adapt tone and detail depending on whether the user is a shipper or carrier.`;

const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL = "gemini-2.5-flash";

function buildSystemContent(role) {
  return role
    ? `${HAULIQ_SYSTEM_PROMPT}\n\nThe current user role is: ${String(role).toUpperCase()}.`
    : HAULIQ_SYSTEM_PROMPT;
}

async function callGeminiChat(messages, role, { stream = false } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured. Add it in Secrets.");
  const resp = await fetch(GEMINI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [{ role: "system", content: buildSystemContent(role) }, ...messages],
      stream
    })
  });
  return resp;
}

async function handleFunction(name, body) {
  if (name === "ai-chatbot") {
    if (!process.env.GEMINI_API_KEY) {
      return { status: 500, body: { error: "GEMINI_API_KEY is not configured. Add it in Secrets." } };
    }
    try {
      const role = body.userContext?.role;
      const messages = (body.messages || []).map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "")
      }));
      const resp = await callGeminiChat(messages, role, { stream: true });
      if (!resp.ok) {
        const errText = await resp.text();
        return { status: resp.status, body: { error: `Gemini request failed: ${errText.slice(0, 200)}` } };
      }
      return { proxy: resp };
    } catch (err) {
      return { status: 500, body: { error: err?.message || "Gemini request failed" } };
    }
  }
  if (name === "ai-load-matching") {
    const load = body.load || {};
    const basePrice = Number(load.price || 0);
    if (!process.env.GEMINI_API_KEY) {
      return { status: 200, body: { action: body.action, result: { carriers: [], market_insight: "AI matching requires GEMINI_API_KEY to be configured in Secrets.", recommended_rate_usd: basePrice, rate_range_low_usd: basePrice, rate_range_high_usd: basePrice, rate_per_km_usd: 0, estimated_distance_km: 0, fuel_cost_estimate_usd: 0, platform_fee_usd: basePrice * 0.1, driver_payout_usd: basePrice * 0.9, price_factors: [], market_comparison: "Configure GEMINI_API_KEY in Secrets for live AI pricing." } } };
    }
    try {
      const prompt = `Analyze this Zimbabwe freight load and respond ONLY with valid JSON containing: recommended_rate_usd (number), rate_range_low_usd (number), rate_range_high_usd (number), market_insight (one short sentence string).\nLoad: ${JSON.stringify(load)}`;
      const resp = await callGeminiChat([{ role: "user", content: prompt }], "shipper", { stream: false });
      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content || "{}";
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
      if (req.method === "POST" && url.pathname.startsWith("/api/auth/")) return handleAuth(url.pathname, req, res);
      if (req.method === "POST" && url.pathname === "/api/storage/upload") return handleUpload(req, res);
      if (req.method === "POST" && url.pathname.startsWith("/api/functions/")) {
        const result = await handleFunction(url.pathname.split("/").pop(), await readJson(req));
        if (result.proxy) {
          res.writeHead(result.proxy.status, Object.fromEntries(result.proxy.headers.entries()));
          if (result.proxy.body) for await (const chunk of result.proxy.body) res.write(chunk);
          return res.end();
        }
        return send(res, result.status, result.body);
      }
      return serveStatic(req, res, vite);
    } catch (error) {
      console.error(error);
      return send(res, 500, { error: { message: error.message || "Internal server error" } });
    }
  });
  server.listen(port, "0.0.0.0", () => console.log(`Hauliq running on port ${port}`));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
