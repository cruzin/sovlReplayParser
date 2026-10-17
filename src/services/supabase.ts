import { createClient } from "@supabase/supabase-js";

// These are public browser credentials. Authorization is enforced by the backend.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://eovllsljleficdhpgcda.supabase.co";
export const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_e-nIhlFwZn0jZ6Y-tblwTQ_sCi5qlws";
export const uploaderId = "b424b4a7-751b-4dac-9a6b-8840c7720777";
export const supabase = createClient(supabaseUrl, publishableKey);
