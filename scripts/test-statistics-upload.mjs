import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: "custom" });
try {
  const { analyzeReplay } = await server.ssrLoadModule("/src/parser/sovlReplay.ts");
  const { uploadStatistics } = await server.ssrLoadModule("/src/services/statisticsUpload.ts");
  const file = fs.readdirSync("public/samples").find((name) => name.endsWith(".SOVL"));
  const analysis = analyzeReplay(fs.readFileSync(`public/samples/${file}`, "utf8"));
  const calls = [];
  const options = {
    endpoint: "https://example.invalid/functions/v1/ingest-matches",
    publishableKey: "public-test-key",
    getToken: async () => "session-test-token",
    bulk: true,
    fetcher: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, init, body });
      const count = Array.isArray(body) ? body.length : 1;
      return Response.json({ received: count, inserted: count, duplicates: 0, rejected: 0 });
    },
  };
  const distinctMatches = Array.from({ length: 205 }, (_, index) => ({
    ...analysis,
    recordedData: { ...analysis.recordedData, recordedUtc: new Date(Date.parse(analysis.recordedData.recordedUtc) + index * 1000).toISOString() },
  }));
  const result = await uploadStatistics(distinctMatches, options);
  assert.equal(result.inserted, 205);
  assert.deepEqual(calls.map((call) => call.body.length), [100, 100, 5]);
  assert.ok(calls.every((call) => call.init.headers.Authorization === "Bearer session-test-token"));
  assert.ok(calls.every((call) => call.init.headers.apikey === "public-test-key"));
  assert.ok(calls.every((call) => new TextEncoder().encode(call.init.body).length <= 1_000_000));
  assert.ok(!("events" in calls[0].body[0]), "Only match summaries are sent");

  calls.length = 0;
  await uploadStatistics([analysis], { ...options, bulk: false });
  assert.equal(calls.length, 1);
  assert.ok(!Array.isArray(calls[0].body), "Single upload uses one object");

  calls.length = 0;
  const invalid = { ...analysis, recordedData: { ...analysis.recordedData, outcome: null } };
  const skipped = await uploadStatistics([invalid], options);
  assert.equal(skipped.skipped, 1);
  assert.equal(calls.length, 0, "Missing outcomes never reach the backend");

  await assert.rejects(uploadStatistics([analysis], {
    ...options,
    fetcher: async () => new Response(null, { status: 401 }),
  }), /session expired/);
  await assert.rejects(uploadStatistics([analysis], {
    ...options,
    fetcher: async () => Response.json({ received: 1, inserted: 50, duplicates: 0, rejected: 0 }),
  }), /unexpected response/);
  let requests = 0;
  await assert.rejects(uploadStatistics(distinctMatches.slice(0, 101), {
    ...options,
    fetcher: async (...args) => {
      requests++;
      if (requests === 2) throw new Error("Network unavailable");
      return options.fetcher(...args);
    },
  }), /Confirmed so far: 100 added/);
  const duplicates = await uploadStatistics([analysis], {
    ...options,
    fetcher: async () => Response.json({ received: 1, inserted: 0, duplicates: 1, rejected: 0 }),
  });
  assert.equal(duplicates.duplicates, 1);
  const rejected = await uploadStatistics([analysis], {
    ...options,
    fetcher: async () => Response.json({ received: 1, inserted: 0, duplicates: 0, rejected: 1 }),
  });
  assert.equal(rejected.rejected, 1);

  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  calls.length = 0;
  await uploadStatistics([analysis], { ...options, storage });
  assert.equal(calls.length, 1);
  const cached = await uploadStatistics([analysis], { ...options, storage });
  assert.equal(cached.cached, 1);
  assert.equal(calls.length, 1, "Confirmed matches are not sent again");
  saved.clear();
  calls.length = 0;
  const repeated = await uploadStatistics([analysis, analysis], { ...options, storage });
  assert.equal(repeated.inserted, 1);
  assert.equal(repeated.cached, 1, "Repeated selections are deduplicated before sending");

  saved.clear();
  await uploadStatistics(distinctMatches.slice(0, 2), {
    ...options, storage,
    fetcher: async () => Response.json({ received: 2, inserted: 1, duplicates: 0, rejected: 1, errors: [{ index: 1 }] }),
  });
  calls.length = 0;
  const retried = await uploadStatistics(distinctMatches.slice(0, 2), { ...options, storage });
  assert.equal(retried.cached, 1);
  assert.equal(calls[0].body.length, 1, "Rejected matches remain eligible for retry");

  saved.clear();
  await assert.rejects(uploadStatistics([analysis], {
    ...options, storage, fetcher: async () => { throw new Error("Network failed"); },
  }), /Network failed/);
  assert.equal(saved.size, 0, "Failed requests are never cached");
  await uploadStatistics([analysis], {
    ...options, storage,
    fetcher: async () => Response.json({ received: 1, inserted: 0, duplicates: 1, rejected: 0 }),
  });
  assert.equal((await uploadStatistics([analysis], { ...options, storage })).cached, 1, "Backend duplicates are cached too");
  saved.clear();
  saved.set(`sovl-uploaded-matches-v1:${options.endpoint}`, "broken JSON");
  assert.equal((await uploadStatistics([analysis], { ...options, storage })).inserted, 1);
  const brokenStorage = { getItem: () => { throw new Error("Blocked"); }, setItem: () => { throw new Error("Full"); } };
  assert.equal((await uploadStatistics([analysis], { ...options, storage: brokenStorage })).inserted, 1);
  console.log("Statistics upload checks passed (mock requests only).");
} finally {
  await server.close();
}
