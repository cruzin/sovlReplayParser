import { createClient } from "npm:@supabase/supabase-js@2";
import { createIngestHandler } from "./handler.ts";

Deno.serve(createIngestHandler((authorization) => {
  const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const key = keys.default ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!key) throw new Error("Missing project API key");
  return createClient(Deno.env.get("SUPABASE_URL")!, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}));
