import type { GoTrueClient } from "@supabase/supabase-js";

export function authErrorMessage(error: { code?: string; message?: string; details?: { code?: string; error?: string } }) {
  const candidate = error.code || error.details?.code || error.details?.error || "";
  const code = /^[a-z][a-z0-9_]{0,63}$/.test(candidate) ? candidate : "";
  const hints: Record<string, string> = {
    access_denied: "Google sign-in was cancelled or denied. Check that your Google account is an allowed test user.",
    provider_disabled: "Enable Google under Supabase Authentication providers.",
    signup_disabled: "Enable new user signups in Supabase Authentication.",
    bad_code_verifier: "The sign-in verifier could not be validated. Start again in the same browser and use the same hostname and port.",
    flow_state_not_found: "This sign-in attempt expired or was already used. Start a fresh sign-in.",
    flow_state_expired: "This sign-in attempt expired. Start a fresh sign-in.",
    unexpected_failure: "Supabase could not complete Google sign-in. Check Authentication logs for the underlying provider error.",
  };
  let hint = hints[code] || "Google sign-in could not be completed. Check Supabase Authentication logs for details.";
  // Recognize specific diagnostics without displaying arbitrary URL/provider text.
  if (/unable to exchange external code/i.test(error.message ?? "")) hint = "Google authorization code exchange failed. Recheck the Google client ID and client secret in Supabase, and the authorized callback URL in Google Cloud.";
  if (/error getting user email|email.*external provider/i.test(error.message ?? "")) hint = "Supabase could not retrieve your email from Google. Check that the Google OAuth scopes include openid, email, and profile.";
  if (/database error saving new user/i.test(error.message ?? "")) hint = "Database error saving the Google account. Check database triggers and constraints on auth.users in Supabase.";
  if (/database error finding user/i.test(error.message ?? "")) hint = "Database error finding the account. Check Supabase Auth service logs for the database error.";
  if (/multiple accounts.*same email/i.test(error.message ?? "")) hint = "Supabase found multiple accounts with the same email. Check the existing user and identity records.";
  if (/code verifier|code_verifier/i.test(error.message ?? "")) hint = hints.bad_code_verifier;
  if (/invalid_client|client secret/i.test(error.message ?? "")) hint = "Check the Google client ID and client secret saved in Supabase's Google provider.";
  return `${hint}${code ? ` (Code: ${code})` : ""}`;
}

export function readAuthCallback(url: string) {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.slice(1));
  const error = parsed.searchParams.get("error") ?? hash.get("error");
  const code = parsed.searchParams.get("error_code") ?? hash.get("error_code");
  return {
    error: error || code
      ? authErrorMessage({ code: code || error, message: parsed.searchParams.get("error_description") ?? hash.get("error_description") ?? "" })
      : "",
  };
}

export function authRedirect(currentUrl: string, base: string) {
  // Resolve relative deployments without copying callback tokens or navigation.
  return new URL(base, currentUrl).toString();
}

export function clearAuthCallback(url: string) {
  const parsed = new URL(url);
  for (const key of ["code", "state", "error", "error_code", "error_description", "auth"]) {
    parsed.searchParams.delete(key);
  }
  if (!parsed.hash.startsWith("#/")) parsed.hash = "";
  return parsed.toString();
}

export async function startGoogleSignIn(auth: Pick<GoTrueClient, "signInWithOAuth">, redirectTo: string) {
  const { data, error } = await auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google sign-in is unavailable. Please try again.");
}
