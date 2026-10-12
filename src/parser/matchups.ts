// Results use only explicit replay outcomes; legacy games stay in encounter counts.
export function summarizeMatchupResults(analyses) {
  const players = new Map();
  const keyFor = (name) => String(name).trim().toLowerCase();
  const empty = () => ({ games: 0, resultGames: 0, wins: 0, losses: 0, draws: 0, scoreGames: 0, scoreDifferenceTotal: 0, objectiveGames: 0, objectivePointsTotal: 0, opponentObjectivePointsTotal: 0 });
  const finish = (row) => ({
    ...row,
    winRate: row.resultGames ? row.wins / row.resultGames : null,
    averageScoreDifference: row.scoreGames ? row.scoreDifferenceTotal / row.scoreGames : null,
    averageObjectivePoints: row.objectiveGames ? row.objectivePointsTotal / row.objectiveGames : null,
    averageOpponentObjectivePoints: row.objectiveGames ? row.opponentObjectivePointsTotal / row.objectiveGames : null,
  });
  for (const analysis of analyses) {
    for (const player of analysis.players) {
      const opponent = analysis.players.find((other) => other.id !== player.id);
      if (!opponent) continue;
      const key = keyFor(player.name);
      const summary = players.get(key) ?? { playerName: player.name, games: 0, factions: new Map(), opponents: new Map() };
      summary.games += 1;
      const factionKey = opponent.faction?.id ?? "unknown";
      const opponentKey = keyFor(opponent.name);
      const faction = summary.factions.get(factionKey) ?? { ...empty(), id: factionKey };
      const matchup = summary.opponents.get(opponentKey) ?? { ...empty(), opponentName: opponent.name };
      for (const row of [faction, matchup]) {
        row.games += 1;
        const data = analysis.recordedData;
        const outcome = data?.outcome;
        if (outcome && [0, 1, -1].includes(outcome.winnerPlayerID)) {
          row.resultGames += 1;
          if (outcome.winnerPlayerID === player.id) row.wins += 1;
          else if (outcome.winnerPlayerID === -1) row.draws += 1;
          else row.losses += 1;
        }
        const ownScore = outcome?.[`player${player.id}Score`];
        const enemyScore = outcome?.[`player${opponent.id}Score`];
        if (Number.isFinite(ownScore) && Number.isFinite(enemyScore)) {
          row.scoreGames += 1;
          row.scoreDifferenceTotal += ownScore - enemyScore;
        }
        // Completed v2 games with no scoring events contribute zero objective points.
        if (data?.formatVersion === 2 && outcome) {
          row.objectiveGames += 1;
          for (const event of data.objectiveScores) {
            if (event.playerId === player.id) row.objectivePointsTotal += event.points;
            if (event.playerId === opponent.id) row.opponentObjectivePointsTotal += event.points;
          }
        }
      }
      summary.factions.set(factionKey, faction);
      summary.opponents.set(opponentKey, matchup);
      players.set(key, summary);
    }
  }
  return [...players.values()].map((player) => ({
    playerName: player.playerName,
    games: player.games,
    factions: [...player.factions.values()].map(finish),
    opponents: [...player.opponents.values()].map(finish)
      .filter((opponent) => opponent.games > 1)
      .sort((a, b) => (a.winRate ?? Infinity) - (b.winRate ?? Infinity) || b.games - a.games || a.opponentName.localeCompare(b.opponentName)),
  })).sort((a, b) => b.games - a.games || a.playerName.localeCompare(b.playerName));
}
