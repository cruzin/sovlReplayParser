import { BarChart3, Crosshair, Dice5, Files, Shield, Swords, Trophy, Users } from "lucide-react";
import { formatNumber, formatPercent, formatPValue } from "./format";
import { Metric, Panel, PanelHeading } from "./Panel";
import { PlayerLuck } from "./PlayerLuck";
import { OpponentFactionChart } from "./OpponentFactionChart";

export function BulkAnalysis({ analysis }) {
  const mostPlayed = [...analysis.opponentFactions].sort((a, b) => b.games - a.games || a.playerName.localeCompare(b.playerName))[0];
  return (
    <>
      <Panel title="Opponent Faction Overview" icon={<Shield />}>
        <OpponentFactionOverview overview={mostPlayed ? [mostPlayed] : []} />
      </Panel>

      <Panel title="Opponent Player Overview" icon={<Users />}>
        <OpponentPlayerOverview overview={analysis.opponentPlayers} />
      </Panel>

      {analysis.opponentFactions.filter((player) => player.games >= 20).map((player) => (
        <Panel key={player.playerName} title={`${player.playerName}'s Opponent Factions`} icon={<BarChart3 />}>
          <OpponentFactionChart player={player} />
        </Panel>
      ))}

      <section className="metric-grid">
        <Metric icon={<Files />} label="Games" value={analysis.totals.games} />
        <Metric icon={<Users />} label="Players" value={analysis.players.length} />
        <Metric icon={<Swords />} label="Combats" value={analysis.totals.combats} />
        <Metric icon={<Crosshair />} label="Ranged attacks" value={analysis.totals.rangedAttacks} />
        <Metric icon={<Dice5 />} label="Tracked dice" value={analysis.totals.totalDice} />
        <Metric icon={<Trophy />} label="Unlikely fights" value={analysis.totals.flaggedFights} />
      </section>

        <Panel title="Aggregate Player Luck" icon={<BarChart3 />}>
          <PlayerLuck
            players={analysis.players}
            favor={analysis.favor}
            firstHalf={analysis.firstHalfLuck}
            latterHalf={analysis.latterHalfLuck}
          />
        </Panel>


      <section className="panel">
        <PanelHeading icon={<Files />} title="Games In Batch" />
        <BulkGameTable games={analysis.games} />
      </section>
    </>
  );
}

function OpponentFactionOverview({ overview }) {
  if (!overview.length) return <p className="empty">No opponent factions found in this batch.</p>;
  return (
    <div className="opponent-faction-overview">
      <MatchupNote />
      {overview.map((player) => (
        <div className="opponent-player-card" key={player.playerName}>
          <div className="opponent-player-heading">
            <strong>{player.playerName}'s opponents</strong>
            <span>{player.games} game{player.games === 1 ? "" : "s"}</span>
          </div>
          <p className="opponent-own-factions">Played as: {formatFactionCounts(player.playedAsFactions)}</p>
          <div className="opponent-faction-list">
            {player.factions.map((faction) => (
              <div className="opponent-faction-row" key={faction.id}>
                <FactionBadge faction={faction} />
                <div className="opponent-faction-detail">
                  <div>
                    <strong>{faction.name}</strong>
                    <span>
                      {faction.games}/{player.games} games - {formatPercent(faction.percentage)}
                    </span>
                  </div>
                  <p className="opponent-own-factions">
                    Win rate {matchupPercent(faction.winRate)} ({faction.wins}W / {faction.losses}L / {faction.draws}D; {faction.resultGames} recorded results)
                    {` · Avg score difference ${signedAverage(faction.averageScoreDifference)}`}
                    {` · Avg points ${matchupAverage(faction.averagePoints)} / ${matchupAverage(faction.averageOpponentPoints)} (objectives: ${matchupAverage(faction.averageObjectivePoints)} / ${matchupAverage(faction.averageOpponentObjectivePoints)}) (you / opponent)`}
                  </p>
                  <div className="opponent-faction-bar" aria-label={`${faction.name} ${formatPercent(faction.percentage)}`}>
                    <span style={{ width: `${Math.round(faction.percentage * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function matchupAverage(value) {
  return value == null ? "n/a" : formatNumber(value, 1);
}

function matchupPercent(value) {
  return value == null ? "n/a" : formatPercent(value);
}

function signedAverage(value) {
  return value == null ? "n/a" : `${value > 0 ? "+" : ""}${formatNumber(value, 1)}`;
}

function MatchupNote() {
  return <p className="opponent-own-factions">Win rates use recorded outcomes; draws count as non-wins. Final points differences are your final score minus your opponent's. Average points use final scores, including objective points; parentheses show the objective portion. Missing data is excluded from averages.</p>;
}

function OpponentPlayerOverview({ overview }) {
  const players = overview.filter((player) => player.opponents.length);
  if (!players.length) return <p className="empty">No repeated opponents in this batch. Opponents need at least two games to appear.</p>;
  return <div className="opponent-faction-overview">
    <MatchupNote />
    <p className="opponent-own-factions">At least two games per opponent. Lowest win rate first; opponents without recorded results appear last.</p>
    {players.map((player) => <div className="opponent-player-card" key={player.playerName}>
      <div className="opponent-player-heading"><strong>{player.playerName}'s opponents</strong></div>
      <div className="table-wrap compact"><table>
        <thead><tr><th>Opponent</th><th>Games</th><th>Win rate</th><th>W / L / D</th><th>Avg final points difference</th><th>Avg points (you / opponent)</th></tr></thead>
        <tbody>{player.opponents.map((opponent) => <tr key={opponent.opponentName}>
          <td>{opponent.opponentName}</td><td>{opponent.resultGames} (<span title="replay files">{opponent.games}</span>)</td>
          <td>{matchupPercent(opponent.winRate)}</td><td>{opponent.wins} / {opponent.losses} / {opponent.draws}</td>
          <td>{signedAverage(opponent.averageScoreDifference)}<span className="matchup-detail">{opponent.scoreGames} scored games</span></td>
          <td>{matchupAverage(opponent.averagePoints)} / {matchupAverage(opponent.averageOpponentPoints)}<span className="matchup-detail">(objectives: {matchupAverage(opponent.averageObjectivePoints)} / {matchupAverage(opponent.averageOpponentObjectivePoints)})</span></td>
        </tr>)}</tbody>
      </table></div>
    </div>)}
  </div>;
}

function formatFactionCounts(factions) {
  if (!factions?.length) return "Unknown faction";
  return factions
    .map((faction) => `${faction.name}${faction.games > 1 ? ` (${faction.games})` : ""}`)
    .join(", ");
}

function FactionBadge({ faction }) {
  return (
    <span className="faction-badge" title={faction.name}>
      {faction.iconUrl ? <img src={faction.iconUrl} alt="" /> : faction.initials}
    </span>
  );
}

function BulkGameTable({ games }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Replay</th>
            <th>Players</th>
            <th>Player factions</th>
            <th>Final points / difference</th>
            <th>Favored</th>
            <th>Dice</th>
            <th>Combats</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.title}>
              <td>
                <strong>{game.title}</strong>
                <span>{game.events} events</span>
              </td>
              <td>{game.players.map((player) => player.name).join(" vs ")}</td>
              <td>
                {game.players
                  .map((player, index) => `${player.name}: ${game.factions?.[index]?.name ?? "Unknown faction"}`)
                  .join(" vs ")}
              </td>
              <td>
                {Number.isFinite(game.outcome?.player0Score) && Number.isFinite(game.outcome?.player1Score) ? <>
                  {game.outcome.player0Score} / {game.outcome.player1Score}
                  <span className="matchup-detail">Difference {signedAverage(game.outcome.player0Score - game.outcome.player1Score)} ({game.players[0].name})</span>
                </> : "n/a"}
              </td>
              <td>
                {game.favor ? (
                  <>
                    <strong>{game.favor.favoredPlayerName}</strong>
                    <span>
                      z {formatNumber(game.favor.z, 2)} - p {formatPValue(game.favor.pValue)}
                    </span>
                  </>
                ) : (
                  "n/a"
                )}
              </td>
              <td>{game.totalDice}</td>
              <td>{game.combats}</td>
              <td>{game.flaggedFights}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
