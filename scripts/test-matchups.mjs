import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: "custom" });
try {
  const { summarizeMatchupResults } = await server.ssrLoadModule("/src/parser/matchups.ts");
  const { analyzeReplayBatch } = await server.ssrLoadModule("/src/parser/sovlReplay.ts");
  const game = (opponent, winner, swapped = false, legacy = false) => ({
    players: [
      { id: swapped ? 1 : 0, name: "Main", faction: { id: "own" } },
      { id: swapped ? 0 : 1, name: opponent, faction: { id: "enemy" } },
    ],
    recordedData: legacy ? { outcome: null, formatVersion: null, objectiveScores: [] } : {
      formatVersion: 2,
      outcome: { winnerPlayerID: winner === "Main" ? (swapped ? 1 : 0) : winner === "draw" ? -1 : (swapped ? 0 : 1), player0Score: swapped ? 60 : 100, player1Score: swapped ? 100 : 60 },
      objectiveScores: [{ playerId: swapped ? 1 : 0, points: 50 }],
    },
  });
  const rows = summarizeMatchupResults([
    game("Hard", "Hard"), game(" hard ", "draw", true),
    game("Easy", "Main"), game("Easy", "Main", true),
    game("Once", "Once"), game("Unknown", null, false, true), game("Unknown", null, true, true),
  ]);
  const main = rows.find((row) => row.playerName === "Main");
  assert.deepEqual(main.opponents.map((row) => row.opponentName), ["Hard", "Easy", "Unknown"]);
  const hard = main.opponents[0];
  assert.equal(hard.winRate, 0);
  assert.equal(hard.losses, 1);
  assert.equal(hard.draws, 1);
  assert.equal(hard.averageScoreDifference, 40);
  assert.equal(hard.averageObjectivePoints, 50);
  assert.equal(hard.averageOpponentObjectivePoints, 0);
  assert.equal(main.opponents[2].winRate, null);
  assert.equal(main.opponents[2].averageScoreDifference, null);
  const enemy = rows.find((row) => row.playerName === "Hard").opponents[0];
  assert.equal(enemy.averageScoreDifference, -40);
  assert.equal(enemy.averageOpponentObjectivePoints, 50);
  assert.equal(main.factions[0].games, 7);
  assert.equal(main.factions[0].resultGames, 5);
  assert.equal(main.factions[0].winRate, 2 / 5);
  const inputs = fs.readdirSync("public/samples").filter((file) => file.endsWith(".SOVL")).map((name) => ({ name, text: fs.readFileSync(`public/samples/${name}`, "utf8") }));
  const batch = analyzeReplayBatch(inputs);
  const zak = batch.opponentFactions.find((row) => row.playerName === "ZakMcKracken");
  assert.equal(zak.factions.reduce((total, row) => total + row.wins, 0), 5);
  assert.ok(zak.factions.every((row) => row.winRate === 1));
  assert.ok(batch.opponentPlayers.every((row) => row.opponents.length === 0));
  const repeated = analyzeReplayBatch([...inputs, inputs[0]]);
  assert.equal(repeated.opponentPlayers.find((row) => row.playerName === "ZakMcKracken").opponents[0].games, 2);
  console.log("Matchup results, perspectives, missing data, filtering, sorting, and sample integration passed.");
} finally {
  await server.close();
}
