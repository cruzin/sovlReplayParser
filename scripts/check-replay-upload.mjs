// Dry-run compatibility check. Reads a local replay; never sends network requests.
import fs from "node:fs";
import { createServer } from "vite";

if (!process.argv[2]) throw new Error("Usage: node scripts/check-replay-upload.mjs <replay path>");
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { analyzeReplay } = await server.ssrLoadModule("/src/parser/sovlReplay.ts");
  const { createStatisticsPayload } = await server.ssrLoadModule("/src/parser/statistics.ts");
  const analysis = analyzeReplay(fs.readFileSync(process.argv[2], "utf8"));
  const payload = await createStatisticsPayload(analysis);
  if (!payload) throw new Error("Parsed, but missing required upload metadata.");
  console.log(JSON.stringify({
    formatVersion: analysis.recordedData.formatVersion,
    gameVersion: analysis.recordedData.gameVersion,
    balanceVersion: analysis.recordedData.balanceVersion,
    units: analysis.units.length,
    combats: analysis.combats.length,
    d6: analysis.totalDice,
    outcome: analysis.recordedData.outcome,
    payload,
  }, null, 2));
  if (payload.players.some((player) => player.faction === "unknown")) throw new Error("Unknown faction: format parses but faction mapping needs an update.");
} finally { await server.close(); }
