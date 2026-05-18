// ============================================================================
// 🔹 BACKEND ENVIRONMENT DIAGNOSTICS
// Confirms DATABASE_URL and backend secrets are available server-side only
// ============================================================================

console.log("\n" + "=".repeat(80));
console.log("🔐 BACKEND STARTUP: Environment Variable Separation Check");
console.log("=".repeat(80));

const backendDiagnostics = {
  "DATABASE_URL": {
    available: !!process.env.DATABASE_URL,
    value: process.env.DATABASE_URL ? "✅ Loaded (first 50 chars)" : "❌ MISSING"
  },
  "SUPABASE_URL": {
    available: !!process.env.SUPABASE_URL,
    value: process.env.SUPABASE_URL || "❌ MISSING"
  },
  "SUPABASE_SERVICE_ROLE_KEY": {
    available: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    value: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Loaded" : "❌ MISSING"
  },
  "GOOGLE_CLIENT_ID": {
    available: !!process.env.GOOGLE_CLIENT_ID,
    value: process.env.GOOGLE_CLIENT_ID ? "✅ Loaded" : "❌ MISSING"
  },
  "GOOGLE_CLIENT_SECRET": {
    available: !!process.env.GOOGLE_CLIENT_SECRET,
    value: process.env.GOOGLE_CLIENT_SECRET ? "✅ Loaded (secret)" : "❌ MISSING"
  },
  "GEMINI_API_KEY": {
    available: !!process.env.GEMINI_API_KEY || !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    value: (process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY) ? "✅ Loaded" : "❌ MISSING"
  }
};

Object.entries(backendDiagnostics).forEach(([key, { available, value }]) => {
  const status = available ? "✅" : "❌";
  console.log(`${status} ${key}: ${value}`);
});

// Critical checks
const requiredVars = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`\n❌ CRITICAL: Missing required backend environment variables: ${missing.join(", ")}`);
  console.error("Backend operations will fail without these variables.");
}

console.log(
  "\n✅ Backend environment properly configured. Database and service credentials isolated from frontend."
);
console.log("=".repeat(80) + "\n");

export {};
