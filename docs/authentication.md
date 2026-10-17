# Google OAuth authentication

The entry screen uses **Continue with Google** for both signup and sign-in.
There are no email/password, confirmation-mail, or password-reset forms. Google
handles identity verification; this flow does not need custom SMTP.

## Supabase and Google setup

1. Create a Google Cloud project and configure its Google Auth Platform app
   branding, audience, and contact details. Use an External audience if people
   outside your organization need access.
2. Create an OAuth client with application type **Web application**.
3. Add this exact **Authorized redirect URI** in Google:
   `https://eovllsljleficdhpgcda.supabase.co/auth/v1/callback`
   This is Supabase's callback, not the app URL.
4. In Supabase Authentication > Sign In / Providers > Google, enable Google and
   enter the Google client ID and client secret. Keep the secret in Supabase,
   never in frontend code or Vite environment variables.
5. Ensure Supabase allows new user signups.
6. In Supabase Authentication > URL Configuration, set **Site URL** to the
   deployed app's root, including any repository subpath. Add these local
   Redirect URLs for testing:
   - `http://127.0.0.1:5174/`
   Add the exact production app URL as well (for example,
   `https://cruzin.github.io/sovlReplayParser/`, if that is your deployment).
   Different development ports/hostnames need their own allowed URLs.
7. If Google's audience is in Testing mode, add the people testing sign-in to
   Google's test-user list. Publish the OAuth app when ready for public use.

Reference: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Frontend behavior

- Supabase's SDK redirects the current tab through Google and back to the app.
- The first successful Google login creates the Supabase account automatically.
- The client uses PKCE; Supabase exchanges the callback code for a session.
- OAuth errors appear on the login screen. Callback parameters are removed
  after SDK initialization; arbitrary provider error text/tokens are not shown.
- Redirect URLs respect the Vite base and repository subpaths. They never copy
  callback tokens or application hash navigation into the return URL.
- Sign-out clears the local session and hides the parser.
- Existing valid sessions remain usable. New login uses Google only.
- Signed-in users can use the parser, global statistics, and submit match data.
  Submission requires the [authenticated-upload backend update](statistics-backend.md)
  to be deployed. A missing/expired session is rejected by the API and database.

## Verification

Run `node scripts/test-auth-flow.mjs`, `npm run typecheck`, and
`npm run build`. Tests mock OAuth and send no real account requests.

After provider setup, sign out, choose Continue with Google, and complete sign-in.
Confirm the parser opens and the session survives a refresh. Test sign-out and
Google cancellation. Live OAuth cannot be verified before the provider and its
credentials are configured in Supabase.
