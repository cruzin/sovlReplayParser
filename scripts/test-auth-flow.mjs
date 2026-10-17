import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { authRedirect, readAuthCallback, clearAuthCallback, startGoogleSignIn, authErrorMessage } = await server.ssrLoadModule("/src/services/authFlow.ts");
  const redirect = authRedirect("http://127.0.0.1:5174/#/statistics", "./");
  assert.equal(redirect, "http://127.0.0.1:5174/");
  assert.equal(authRedirect("https://example.com/sovlReplayParser/?code=secret#/statistics", "./"), "https://example.com/sovlReplayParser/");
  assert.match(readAuthCallback("https://example.com/#error=access_denied&error_description=secret").error, /cancelled or denied/);
  assert.match(readAuthCallback("https://example.com/?error=server_error").error, /could not be completed/);
  assert.equal(readAuthCallback("https://example.com/#/statistics").error, "");
  assert.ok(!readAuthCallback("https://example.com/#error=server_error&error_description=private-token").error.includes("private-token"));
  assert.match(authErrorMessage({ details: { code: "unexpected_failure" } }), /Code: unexpected_failure/);
  assert.match(authErrorMessage({ message: "PKCE code verifier missing" }), /same browser/);
  assert.match(authErrorMessage({ message: "invalid_client" }), /client secret/);
  assert.match(readAuthCallback("https://example.com/#error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+private-code").error, /authorization code exchange failed/);
  assert.ok(!readAuthCallback("https://example.com/#error=server_error&error_description=Unable+to+exchange+external+code%3A+private-code").error.includes("private-code"));
  assert.match(authErrorMessage({ message: "Database error saving new user" }), /triggers and constraints/);
  assert.match(authErrorMessage({ message: "Error getting user email from external provider" }), /scopes/);
  assert.equal(clearAuthCallback("https://example.com/app/?code=secret&state=secret#/statistics"), "https://example.com/app/#/statistics");
  assert.equal(clearAuthCallback("https://example.com/app/#access_token=secret&refresh_token=secret"), "https://example.com/app/");
  assert.equal(clearAuthCallback("https://example.com/app/?auth=recovery&error=denied&error_code=x&error_description=secret"), "https://example.com/app/");

  let request;
  await startGoogleSignIn({
    signInWithOAuth: async (options) => {
      request = options;
      return { data: { provider: "google", url: "https://example.supabase.co/auth/v1/authorize?provider=google" }, error: null };
    },
  }, redirect);
  assert.deepEqual(request, { provider: "google", options: { redirectTo: redirect, queryParams: { prompt: "select_account" } } });
  await assert.rejects(startGoogleSignIn({
    signInWithOAuth: async () => ({ data: {}, error: new Error("Google provider disabled") }),
  }, redirect), /provider disabled/);
  await assert.rejects(startGoogleSignIn({
    signInWithOAuth: async () => ({ data: { url: null }, error: null }),
  }, redirect), /unavailable/);
  console.log("Google OAuth, callback cleanup, and redirect checks passed (mock auth only).");
} finally { await server.close(); }
