// Transport preview only. Never include replay events, files, or army lists.
export async function createStatisticsPayload(analysis) {
  const { recordedData, players, units } = analysis;
  const { recordedUtc, mapId, outcome } = recordedData;
  if (!recordedUtc || mapId == null || !outcome || players.length !== 2) return null;
  const timestamp = Date.parse(recordedUtc);
  const scores = [outcome.player0Score, outcome.player1Score];
  if (!Number.isFinite(timestamp) || !scores.every((score) => typeof score === "number" && Number.isFinite(score)) ||
      ![0, 1, -1].includes(outcome.winnerPlayerID)) return null;

  const sides = players.map((player) => ({
    name: player.name.normalize("NFC").trim(),
    score: scores[player.id],
    faction: player.faction.id,
    commanders: units.filter((unit) => unit.playerId === player.id && unit.commander)
      .map((unit) => unit.commander.sourceId).sort(),
    result: outcome.winnerPlayerID === -1 ? "draw" : outcome.winnerPlayerID === player.id ? "win" : "loss",
  })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.score - b.score);

  // Fixed field order and ordinal name sorting keep fingerprints stable across locales.
  // Timestamp agreement between opposing players' recordings remains unverified.
  const fingerprint = JSON.stringify({
    recordedUtc: new Date(timestamp).toISOString(),
    players: sides.map(({ name, score }) => ({ name, score })),
    mapId,
  });
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const identifier = `sovl-match-v1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return {
    identifier,
    recordedUtc: new Date(timestamp).toISOString(),
    players: sides.map(({ name, faction, commanders, result }) => ({ name, faction, commanders, result })),
    winner: outcome.winnerPlayerID === -1 ? null : players.find((player) => player.id === outcome.winnerPlayerID).name.normalize("NFC").trim(),
    // Signed difference from the alphabetically first player's perspective.
    scoreDifference: sides[0].score - sides[1].score,
  };
}

async function prepareStatisticsPreview(analysis) {
  try {
    const payload = await createStatisticsPayload(analysis);
    if (!payload) {
      console.info("[Replay statistics] Skipped: missing valid recorded timestamp, map, or result.");
      return null;
    }
    return payload;
  } catch (error) {
    // Statistics must never prevent local replay analysis.
    console.warn("[Replay statistics] Could not prepare preview:", error);
    return null;
  }
}

export async function previewStatistics(analysis) {
  const payload = await prepareStatisticsPreview(analysis);
  if (!payload) return;
  console.log("[Replay statistics] Would send:", payload);
  // await fetch("/api/v1/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

export async function previewBulkStatistics(analyses) {
  const payload = (await Promise.all(analyses.map(prepareStatisticsPreview))).filter((match) => match !== null);
  if (!payload.length) return;
  console.log("[Replay statistics] Would send bulk:", payload);
  // await fetch("/api/v1/matches/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
