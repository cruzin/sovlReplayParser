import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { fetchGlobalStatistics } = await server.ssrLoadModule("/src/services/globalStatistics.ts");
  const { pageFromHash, showLatestUploadsLink } = await server.ssrLoadModule("/src/navigation.ts");
  const { PlayerAppearancesChart } = await server.ssrLoadModule("/src/components/PlayerAppearancesChart.tsx");
  const { FactionPieChart } = await server.ssrLoadModule("/src/components/FactionPieChart.tsx");
  const client = (reply, expectedRpc = "global_statistics") => ({ rpc: (name) => {
    assert.equal(name, expectedRpc);
    return { abortSignal: async () => reply };
  } });
  const empty = { matches: 0, draws: 0, latestMatch: null, factions: [], commanders: [], matchups: [] };
  assert.deepEqual(await fetchGlobalStatistics(client({ data: empty })), empty);
  const recorded = { ...empty, matches: 3, draws: 1, latestMatch: "2026-10-17T10:00:00Z", factions: [
    { faction_id: "DwarfHolds", games: 3, wins: 1, losses: 1, draws: 1, average_score_difference: -10.5 },
  ] };
  assert.deepEqual(await fetchGlobalStatistics(client({ data: recorded })), recorded);
  assert.deepEqual(await fetchGlobalStatistics(client({ data: recorded }, "latest_upload_statistics"), undefined, "latestUploads"), recorded);
  assert.deepEqual(await fetchGlobalStatistics(client({ data: empty }, "latest_upload_statistics"), undefined, "latestUploads"), empty);
  const thirty = { ...empty, matches: 30 };
  assert.deepEqual(await fetchGlobalStatistics(client({ data: thirty }, "latest_upload_statistics"), undefined, "latestUploads"), thirty);
  assert.equal((await fetchGlobalStatistics(client({ data: { ...empty, matches: 31 } }))).matches, 31, "All-time results remain unlimited");
  await assert.rejects(fetchGlobalStatistics(client({ data: { ...empty, matches: 31 } }, "latest_upload_statistics"), undefined, "latestUploads"), /unexpected response/);
  await assert.rejects(fetchGlobalStatistics(client({ error: { code: "PGRST202" } }, "latest_upload_statistics"), undefined, "latestUploads"), /latest_upload_statistics SQL migration/);
  assert.equal(pageFromHash("#/statistics/latestUploads"), "latestUploads");
  assert.equal(pageFromHash("#/statistics/onlyOpponents"), "onlyOpponents");
  const opponentData = { ...recorded, excludedMatches: 12 };
  assert.deepEqual(await fetchGlobalStatistics(client({ data: opponentData }, "opponent_statistics"), undefined, "onlyOpponents"), opponentData);
  const noOpponents = { ...empty, excludedMatches: 12 };
  assert.deepEqual(await fetchGlobalStatistics(client({ data: noOpponents }, "opponent_statistics"), undefined, "onlyOpponents"), noOpponents);
  await assert.rejects(fetchGlobalStatistics(client({ data: recorded }, "opponent_statistics"), undefined, "onlyOpponents"), /invalid opponent coverage/);
  await assert.rejects(fetchGlobalStatistics(client({ data: { ...opponentData, factions: [{ ...recorded.factions[0], games: 6 }] } }, "opponent_statistics"), undefined, "onlyOpponents"), /one army per included match/);
  await assert.rejects(fetchGlobalStatistics(client({ error: { code: "PGRST202" } }, "opponent_statistics"), undefined, "onlyOpponents"), /opponent_statistics SQL migration/);
  assert.equal(pageFromHash("#/statistics"), "statistics");
  assert.equal(pageFromHash("#/parser"), "parser");
  assert.equal(pageFromHash(""), "parser");
  assert.equal(showLatestUploadsLink("kjell.emil.wilhelmsen@gmail.com"), true);
  assert.equal(showLatestUploadsLink(" KJELL.EMIL.WILHELMSEN@gmail.com "), true);
  assert.equal(showLatestUploadsLink("someone@example.com"), false);
  assert.equal(showLatestUploadsLink(), false);
  const withPlayers = { ...recorded, playerAppearances: [{ player_name: "A", games: 1 }, { player_name: "B", games: 3 }] };
  assert.deepEqual(await fetchGlobalStatistics(client({ data: withPlayers }, "latest_upload_statistics"), undefined, "latestUploads"), withPlayers);
  await assert.rejects(fetchGlobalStatistics(client({ data: { ...recorded, playerAppearances: [{ player_name: "A", games: 4 }] } }, "latest_upload_statistics"), undefined, "latestUploads"), /invalid player appearances/);
  const chart = renderToStaticMarkup(createElement(PlayerAppearancesChart, { players: withPlayers.playerAppearances }));
  assert.ok(chart.indexOf('aria-label="B: 3 matches"') < chart.indexOf('aria-label="A: 1 match"'), "Most frequent players appear first");
  assert.ok(chart.includes("width:100%"));
  assert.ok(chart.includes("width:33.333"));
  const opponentPie = renderToStaticMarkup(createElement(FactionPieChart, { rows: recorded.factions, selected: "", onSelect: () => {}, opponentsOnly: true }));
  assert.ok(opponentPie.includes("opponent counts in each match"));
  assert.ok(!opponentPie.includes("Both armies count"), "Opponent page does not claim to count uploader armies");
  await assert.rejects(fetchGlobalStatistics(client({ error: { code: "PGRST202" } })), /SQL migration/);
  await assert.rejects(fetchGlobalStatistics(client({ error: { message: "Permission denied" } })), /Permission denied/);
  await assert.rejects(fetchGlobalStatistics(client({ data: { matches: -1 } })), /unexpected response/);
  console.log("Global statistics query checks passed (mock backend).");
} finally {
  await server.close();
}
