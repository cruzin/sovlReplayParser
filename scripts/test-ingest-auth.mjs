import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { createIngestHandler } = await server.ssrLoadModule("/supabase/functions/ingest-matches/handler.ts");
  let inserts = 0;
  const handler = createIngestHandler((authorization) => ({
    auth: { getUser: async (token) => {
      assert.equal(authorization, `Bearer ${token}`, "Caller session is passed through");
      return token === "expired" ? { data: { user: null }, error: { message: "Expired" } }
        : { data: { user: { id: token } }, error: null };
    } },
    rpc: async (name, args) => {
      assert.equal(name, "ingest_match");
      assert.ok(args.payload);
      inserts++;
      return { data: "inserted", error: null };
    },
  }));
  const request = (token, body = {}) => new Request("https://example.invalid/ingest-matches", {
    method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  });
  assert.equal((await handler(request(null))).status, 401);
  assert.equal((await handler(request("expired"))).status, 401);
  assert.equal(inserts, 0, "Unauthenticated requests never reach the database");
  for (const user of ["existing-uploader", "brand-new-google-user"]) {
    const response = await handler(request(user));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).inserted, 1);
  }
  assert.equal((await (await handler(request("another-user", [{}, {}]))).json()).inserted, 2);
  assert.equal((await handler(request("user", Array(101).fill({})))).status, 400);
  assert.equal((await handler(request("user", []))).status, 400);
  assert.equal((await handler(new Request("https://example.invalid", { method: "OPTIONS" }))).status, 204);
  assert.equal(inserts, 4);
  console.log("Authenticated ingestion checks passed: multiple users accepted, missing/expired sessions rejected (mock backend).");
} finally { await server.close(); }
