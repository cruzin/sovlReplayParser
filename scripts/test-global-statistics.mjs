import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { fetchGlobalStatistics } = await server.ssrLoadModule("/src/services/globalStatistics.ts");
  const client = (reply) => ({ rpc: (name) => {
    assert.equal(name, "global_statistics");
    return { abortSignal: async () => reply };
  } });
  const empty = { matches: 0, draws: 0, latestMatch: null, factions: [], commanders: [], matchups: [] };
  assert.deepEqual(await fetchGlobalStatistics(client({ data: empty })), empty);
  const recorded = { ...empty, matches: 3, draws: 1, latestMatch: "2026-10-17T10:00:00Z", factions: [
    { faction_id: "DwarfHolds", games: 3, wins: 1, losses: 1, draws: 1, average_score_difference: -10.5 },
  ] };
  assert.deepEqual(await fetchGlobalStatistics(client({ data: recorded })), recorded);
  await assert.rejects(fetchGlobalStatistics(client({ error: { code: "PGRST202" } })), /SQL migration/);
  await assert.rejects(fetchGlobalStatistics(client({ error: { message: "Permission denied" } })), /Permission denied/);
  await assert.rejects(fetchGlobalStatistics(client({ data: { matches: -1 } })), /unexpected response/);
  console.log("Global statistics query checks passed (mock backend).");
} finally {
  await server.close();
}
