import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: "custom" });
try {
  const { analyzeReplay } = await server.ssrLoadModule("/src/parser/sovlReplay.ts");
  const { createStatisticsPayload, previewStatistics, previewBulkStatistics } = await server.ssrLoadModule("/src/parser/statistics.ts");
  const { factionFromList } = await server.ssrLoadModule("/src/parser/catalogue.ts");
  assert.equal(factionFromList({ factionType: 14 }).id, "UndyingDynasties");
  assert.equal(factionFromList({ factionType: 14 }).name, "Undying Dynasties");
  assert.equal(factionFromList({ factionType: 999 }).id, "unknown", "Unestablished faction codes are not guessed");
  const currentFormat = {
    formatVersion: 2, recordedUtc: "2026-11-12T20:36:27.6801015Z",
    header: {
      player0Name: "A", player1Name: "B", mapID: 5,
      player0List: { factionType: 12, characters: { entries: [
        { unitID: "abyssalPrince", count: 1, width: 1, hasCharacter: false },
        { unitID: "plagueFlies", count: 2, width: 3, hasCharacter: true, character: { unitID: "abyssalHerald" } },
      ] }, battleLine: { entries: [{ unitID: "plagueWalkers", count: 10, width: 6 }] } },
      player1List: { factionType: 14, characters: { entries: [
        { unitID: "boneDragon", count: 1, width: 1, hasCharacter: true, character: { unitID: "risenKing" } },
        { unitID: "reliquary", count: 1, width: 1, hasCharacter: true, character: { unitID: "hierophant" } },
      ] } },
    },
    events: [], outcome: { winnerPlayerID: -1, player0Score: 403, player1Score: 354, finalTurn: 7 },
  };
  const updatedPayload = await createStatisticsPayload(analyzeReplay(JSON.stringify(currentFormat)));
  assert.deepEqual(updatedPayload.players[0].commanders, ["abyssalHerald", "abyssalPrince"]);
  assert.deepEqual(updatedPayload.players[1].commanders, ["hierophant", "risenKing"]);
  assert.equal(updatedPayload.players[1].faction, "UndyingDynasties");
  assert.equal(updatedPayload.winner, null, "Recorded draw is preserved despite different scores");
  assert.equal(updatedPayload.scoreDifference, 49);
  const analyses = [];
  for (const name of fs.readdirSync("public/samples").filter((file) => file.endsWith(".SOVL"))) {
    const raw = JSON.parse(fs.readFileSync(`public/samples/${name}`, "utf8"));
    const analysis = analyzeReplay(JSON.stringify(raw), name);
    analyses.push(analysis);
    const payload = await createStatisticsPayload(analysis);
    assert.match(payload.identifier, /^sovl-match-v1:[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(payload).sort(), ["identifier", "players", "recordedUtc", "scoreDifference", "uploader", "winner"]);
    assert.equal(payload.recordedUtc, new Date(raw.recordedUtc).toISOString());
    assert.equal(payload.players.filter((player) => player.result === "win").length, 1);
    assert.equal(payload.players.flatMap((player) => player.commanders).length, analysis.units.filter((unit) => unit.commander || unit.isStandaloneCommander).length);
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
