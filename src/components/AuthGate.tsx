import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { initialAuthCallback, supabase } from "../services/supabase";
import { authRedirect, clearAuthCallback, startGoogleSignIn, authErrorMessage } from "../services/authFlow";

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialAuthCallback.error);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    // Initialization is already started by the SDK. Await the same operation so
    // failed OAuth code exchanges are surfaced instead of silently returning to login.
    void supabase.auth.initialize().then(({ error }) => {
      if (!active) return;
      if (error) setError(initialAuthCallback.error || authErrorMessage(error));
      window.history.replaceState(null, "", clearAuthCallback(window.location.href));
      setReady(true);
    }).catch(() => {
      if (active) {
        setError("Could not initialize sign-in. Refresh the page to try again.");
        setReady(true);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function signIn() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await startGoogleSignIn(supabase.auth, authRedirect(window.location.href, import.meta.env.BASE_URL));
      // The SDK redirects this tab to Google; keep the button disabled until navigation.
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      window.history.replaceState(null, "", clearAuthCallback(window.location.href));
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  if (!ready || !session) {
    return <main className="app-shell login-shell">
      <section className="login-card" aria-label="Sign in">
        <p className="eyebrow">SOVL Replay Analyzer</p>
        <h1>Sign in</h1>
        {!ready ? <p role="status">Checking sign-in…</p> : <>
          <p>Sign in with your Google account to access the replay parser.</p>
          <button type="button" className="google-signin" disabled={busy} onClick={signIn}>
            <span aria-hidden="true" className="google-signin-mark">G</span>
            {busy ? "Redirecting to Google…" : "Continue with Google"}
          </button>
          <p className="login-note">Your account is created automatically the first time you sign in.</p>
        </>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </main>;
  }
  return <>
    <div className="account-bar">
      <span>{session.user.email}</span>
      <button type="button" className="theme-toggle" disabled={busy} onClick={signOut}>Sign out</button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    {children(session)}
  </>;
}
