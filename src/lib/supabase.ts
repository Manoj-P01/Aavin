// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Supabase Client (Browser + Server)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

// ── Browser client (singleton) ────────────────────────────────────────────────
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Copy .env.example to .env.local and fill in your Supabase credentials. ' +
      'See config.md for instructions.'
    );
  }

  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

// Default export for convenience (lazy-initialized via Proxy)
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    const client = getSupabaseClient();
    return (client as any)[prop];
  }
});

// ── Server client (service role — server-side only) ───────────────────────────
export function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is not set. ' +
      'This client is only for server-side API routes. See config.md.'
    );
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}
