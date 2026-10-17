const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors });
}

// createUserClient must forward the user's Authorization header, never an admin key.
export function createIngestHandler(createUserClient: (authorization: string) => any) {
  return async (request: Request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return respond({ error: "Use POST" }, 405);

    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in before uploading" }, 401);

    try {
      const supabase = createUserClient(authorization);
      const { data: auth, error: authError } = await supabase.auth.getUser(authorization.slice(7));
      if (authError || !auth.user?.id) return respond({ error: "Invalid or expired session" }, 401);

      const reader = request.body?.getReader();
      if (!reader) return respond({ error: "Missing request body" }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1_000_000) {
          await reader.cancel();
          return respond({ error: "Request exceeds 1 MB" }, 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }

      let body;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { return respond({ error: "Invalid JSON" }, 400); }
      const matches = Array.isArray(body) ? body : [body];
      if (!matches.length || matches.length > 100) return respond({ error: "Send between 1 and 100 matches per request" }, 400);

      const summary = { received: matches.length, inserted: 0, duplicates: 0, rejected: 0, errors: [] as { index: number; message: string }[] };
      for (const [index, match] of matches.entries()) {
        const { data, error } = await supabase.rpc("ingest_match", { payload: match });
        if (error) {
          console.error("Match insert failed", { index, code: error.code, message: error.message });
          summary.rejected++;
          summary.errors.push({ index, message: "Match could not be saved; see function logs" });
        } else if (data === "inserted") summary.inserted++;
        else if (data === "duplicate") summary.duplicates++;
        else throw new Error("Unexpected insert response");
      }
      return respond(summary);
    } catch (error) {
      console.error("Upload request failed", error);
      return respond({ error: "Upload request failed" }, 500);
    }
  };
}
