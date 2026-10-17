import { createClient } from "@supabase/supabase-js";
import { readAuthCallback } from "./authFlow";

// These are public browser credentials. Authorization is enforced by the backend.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://eovllsljleficdhpgcda.supabase.co";
export const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_e-nIhlFwZn0jZ6Y-tblwTQ_sCi5qlws";
// Capture provider errors before the SDK consumes the OAuth callback URL.
export const initialAuthCallback = typeof window === "undefined" ? { error: "" } : readAuthCallback(window.location.href);
export const supabase = createClient(supabaseUrl, publishableKey, { auth: { flowType: "pkce" } });
