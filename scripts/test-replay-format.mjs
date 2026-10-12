import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: "custom" });
try {
  const { analyzeReplay, analyzeReplayBatch } = await server.ssrLoadModule("/src/parser/sovlReplay.ts");
  const { factionFromList } = await server.ssrLoadModule("/src/parser/catalogue.ts");
  assert.equal(factionFromList({ factionType: 2 }).id, "GreenskinTribes", "Supplied Greenskin army list records code 2");
  assert.equal(factionFromList({ factionType: 3 }).id, "DwarfHolds", "Supplied Dwarf army list records code 3");
  assert.equal(factionFromList({ factionType: 6 }).id, "GoatmenRaiders", "Supplied Goatmen army list records code 6");
  assert.equal(factionFromList({ factionType: 7 }).id, "AbyssalLegions", "Supplied Abyssal army list records code 7");
  assert.equal(factionFromList({ factionType: 8 }).id, "ReptilianKingdoms", "Supplied Reptilian army list records code 8");
  assert.equal(factionFromList({ factionType: 11 }).id, "DarkbornElves", "Supplied Darkborn army list records code 11");
  assert.equal(factionFromList({ factionType: 12 }).id, "AbyssalDemons", "Supplied Demon army list records code 12");
  assert.equal(factionFromList({ factionType: 4, battleLine: { entries: [{ unitID: "imperialHalberd" }] } }).id, "ElvenConclaves", "Recorded code overrides unit hints");
  assert.equal(factionFromList({ factionType: 999, battleLine: { entries: [{ unitID: "deepwoodGuard" }] } }).id, "unknown", "Unknown code is not inferred from units");
  const inputs = [];
  for (const directory of ["public/samples", "tests/fixtures/legacy"]) {
    for (const name of fs.readdirSync(directory).filter((file) => file.endsWith(".SOVL"))) {
      const text = fs.readFileSync(`${directory}/${name}`, "utf8");
      const raw = JSON.parse(text);
      const analysis = analyzeReplay(text, name);
      assert.ok(analysis.units.length && analysis.totalDice && analysis.combats.length, name);
      assert.equal(analysis.totalDice, analysis.players.reduce((total, player) => total + player.rolls, 0));
      assert.ok(analysis.rollGroups.every((group) => group.playerName !== "Unknown player"));
      if (raw.formatVersion === 2) {
        inputs.push({ name, text });
        assert.ok(analysis.players.every((player) => player.faction.id !== "unknown"), `${name}: recorded faction resolved`);
        const events = raw.events;
        const count = (type) => events.filter((event) => event.t === type).length;
        assert.equal(analysis.events.length, events.length);
        assert.equal(analysis.combats.length, count("combat_contact"));
        assert.equal(analysis.rangedAttacks.length, count("ranged"));
        assert.equal(analysis.activeEffects.length, count("spell"));
        assert.equal(analysis.disciplineTests.length, count("break_test") + count("rally_test"));
        assert.equal(analysis.recordedData.outcome.winnerName, raw.header[`player${raw.outcome.winnerPlayerID}Name`]);
        assert.equal(analysis.recordedData.objectiveScores.length, count("objectives_scored"));
        // Count only supported D6 sources, excluding contextual healing/self-damage D3s.
        const dice = (rolls = []) => rolls.filter((roll) => !roll.isD3).length;
        const expectedDice = events.reduce((total, event) => {
          if (event.t === "combat_contact") return total + [event.stepOne, ...(event.hasSecondStep ? [event.stepTwo] : [])].reduce((n, step) => n + dice(step?.toHit?.rolls) + dice(step?.save?.rolls), 0);
          if (event.t === "ranged") return total + dice(event.toHitRolls) + dice(event.saveRolls);
          if (["break_test", "rally_test"].includes(event.t) && !event.test.crumble && !event.test.rolls.some((roll) => roll.isD3)) return total + dice(event.test.rolls);
          return total;
        }, 0);
        assert.equal(analysis.totalDice, expectedDice, `${name}: D6 coverage`);
        for (const combat of analysis.combats) {
          const event = events[combat.eventIndex];
          assert.equal(combat.unitA.globalId, event.unitID1);
          assert.equal(combat.unitB.globalId, event.unitID2);
          for (const group of combat.rollGroups) {
            const side = group.id.includes("-A-") ? event.stepOne : event.stepTwo;
            assert.equal(group.playerId, (group.phase === "hit" ? side.toHit : side.save).rollerID);
          }
        }
      }
      console.log(`${name}: ${analysis.units.length} units, ${analysis.combats.length} combats, ${analysis.totalDice} D6`);
    }
  }
  const batch = analyzeReplayBatch(inputs);
  assert.equal(batch.totals.games, 5);
  assert.equal(batch.totals.totalDice, batch.analyses.reduce((total, analysis) => total + analysis.totalDice, 0));
  assert.throws(() => analyzeReplay('{"formatVersion":3}'), /Unsupported replay format/);
  assert.throws(() => analyzeReplay('{}'), /missing army lists/);
  console.log("Replay format and batch checks passed.");
} finally {
  await server.close();
}
