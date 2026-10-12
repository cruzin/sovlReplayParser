export function RecordedReplay({ data, players }) {
  return (
    <div className="recorded-replay">
      {data.outcome && (
        <p>
          <strong>{data.outcome.winnerName ? `${data.outcome.winnerName} won` : "No recorded winner"}</strong>
          {` · ${players[0].name} ${data.outcome.player0Score} — ${players[1].name} ${data.outcome.player1Score}`}
          {` · Final turn ${data.outcome.finalTurn}`}
          {data.outcome.concededPlayerName && ` · ${data.outcome.concededPlayerName} conceded`}
        </p>
      )}
      <p className="muted">Results and objective points are recorded by the replay. Final scores can include other sources of points.</p>
      <div className="table-wrap compact">
        <table>
          <thead><tr><th>Player</th><th>Recorded objective points</th></tr></thead>
          <tbody>{players.map((player) => (
            <tr key={player.id}><td>{player.name}</td><td>{data.objectiveScores.filter((event) => event.playerId === player.id).reduce((total, event) => total + event.points, 0)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {data.objectiveScores.length > 0 && <p>Objective scoring: {data.objectiveScores.map((event) => `Turn ${event.turn}: ${event.playerName} +${event.points}`).join(" · ")}</p>}
      <p>Healing: {data.healing.reduce((total, event) => total + event.amount, 0)} recorded · Self damage: {data.selfDamage.reduce((total, event) => total + event.amount, 0)} wounds · Deployment positions: {data.startingPositions.length}</p>
      <p className="muted">Format {data.formatVersion} · Game {data.gameVersion ?? "Unknown"} · Balance {data.balanceVersion ?? "Unknown"} · Recorded {data.recordedUtc ?? "Unknown"} · Map ID {data.mapId} · Scenario code {data.scenarioCode}</p>
    </div>
  );
}
