import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: "custom" });
try {
  const { analyzeReplay } = await server.ssrLoadModule("/src/parser/sovlReplay.ts");
  const { createStatisticsPayload, previewStatistics, previewBulkStatistics } = await server.ssrLoadModule("/src/parser/statistics.ts");
  const analyses = [];
  for (const name of fs.readdirSync("public/samples").filter((file) => file.endsWith(".SOVL"))) {
    const raw = JSON.parse(fs.readFileSync(`public/samples/${name}`, "utf8"));
    const analysis = analyzeReplay(JSON.stringify(raw), name);
    analyses.push(analysis);
    const payload = await createStatisticsPayload(analysis);
    assert.match(payload.identifier, /^sovl-match-v1:[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(payload).sort(), ["identifier", "players", "recordedUtc", "scoreDifference", "winner"]);
    assert.equal(payload.recordedUtc, new Date(raw.recordedUtc).toISOString());
    assert.equal(payload.players.filter((player) => player.result === "win").length, 1);
    assert.equal(payload.players.flatMap((player) => player.commanders).length, analysis.units.filter((unit) => unit.commander).length);
    const swapped = structuredClone(raw);
    [swapped.header.player0Name, swapped.header.player1Name] = [raw.header.player1Name, raw.header.player0Name];
    [swapped.header.player0List, swapped.header.player1List] = [raw.header.player1List, raw.header.player0List];
    [swapped.outcome.player0Score, swapped.outcome.player1Score] = [raw.outcome.player1Score, raw.outcome.player0Score];
    swapped.outcome.winnerPlayerID = 1 - raw.outcome.winnerPlayerID;
    assert.deepEqual(await createStatisticsPayload(analyzeReplay(JSON.stringify(swapped))), payload, "Player slots do not affect payload");
    const changed = structuredClone(analysis);
    changed.recordedData.recordedUtc = new Date(Date.parse(raw.recordedUtc) + 1000).toISOString();
    assert.notEqual((await createStatisticsPayload(changed)).identifier, payload.identifier);
    changed.recordedData.outcome.winnerPlayerID = -1;
    const draw = await createStatisticsPayload(changed);
    assert.equal(draw.winner, null);
    assert.ok(draw.players.every((player) => player.result === "draw"));
    changed.recordedData.outcome = null;
    assert.equal(await createStatisticsPayload(changed), null);
    console.log(`${name}: statistics OK`);
  }
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    await previewBulkStatistics(analyses);
    assert.equal(logs.length, 1, "Bulk previews log one request");
    assert.deepEqual(logs[0][1], await Promise.all(analyses.map(createStatisticsPayload)));
    logs.length = 0;
    await previewStatistics(analyses[0]);
    assert.equal(logs.length, 1);
    assert.ok(!Array.isArray(logs[0][1]), "Single upload sends an object");
    logs.length = 0;
    await previewBulkStatistics([]);
    assert.equal(logs.length, 0, "Empty batches do not send requests");
  } finally {
    console.log = originalLog;
  }
  for (const name of fs.readdirSync("tests/fixtures/legacy").filter((file) => file.endsWith(".SOVL"))) {
    assert.equal(await createStatisticsPayload(analyzeReplay(fs.readFileSync(`tests/fixtures/legacy/${name}`, "utf8"))), null);
  }
} finally {
  await server.close();
}
