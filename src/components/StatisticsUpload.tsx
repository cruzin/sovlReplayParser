import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseUrl, publishableKey, uploaderId } from "../services/supabase";
import { uploadStatistics } from "../services/statisticsUpload";

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setAuthBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPassword("");
      setAuthBusy(false);
    }
  }

  async function signOut() {
    setAuthBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }

  if (!ready || !session) {
    return (
      <main className="app-shell login-shell">
        <section className="login-card" aria-label="Sign in">
          <p className="eyebrow">SOVL Replay Analyzer</p>
          <h1>Sign in</h1>
          {!ready ? <p role="status">Checking sign-in…</p> : <>
            <p>Sign in to access the replay parser.</p>
            <form className="statistics-login" onSubmit={signIn}>
              <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <button className="theme-toggle" type="submit" disabled={authBusy}>{authBusy ? "Signing in…" : "Sign in"}</button>
            </form>
          </>}
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return <>
    <div className="account-bar">
      <span>{session.user.email}</span>
      <button type="button" className="theme-toggle" disabled={authBusy} onClick={signOut}>Sign out</button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    {children(session)}
  </>;
}

export function StatisticsUpload({ upload, session }: { upload: any; session: Session }) {
  const busy = useRef(false);
  const attempted = useRef(null);
  const [sending, setSending] = useState(false);
  const allowed = session.user.id === uploaderId;

  useEffect(() => {
    if (!allowed || !upload || upload === attempted.current || busy.current) return;
    busy.current = true;
    attempted.current = upload;
    setSending(true);

    void uploadStatistics(upload.analyses, {
      endpoint: `${supabaseUrl}/functions/v1/ingest-matches`,
      publishableKey,
      bulk: upload.bulk,
      getToken: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session?.user.id !== uploaderId) throw new Error("Sign in with the uploader account.");
        return data.session.access_token;
      },
    }).then((result) => {
      console.info("[Replay statistics] Upload result:", result);
    }).catch((error) => {
      console.warn("[Replay statistics] Upload failed:", error);
    }).finally(() => {
      busy.current = false;
      setSending(false);
    });
  }, [upload, allowed, sending]);

  return null;
}
