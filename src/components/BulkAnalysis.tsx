import { BarChart3, Crosshair, Dice5, Files, Shield, Swords, Trophy, Users } from "lucide-react";
import { formatNumber, formatPercent, formatPValue } from "./format";
import { Metric, Panel, PanelHeading } from "./Panel";
import { PlayerLuck } from "./PlayerLuck";

export function BulkAnalysis({ analysis }) {
  return (
    <>
      <section className="metric-grid">
        <Metric icon={<Files />} label="Games" value={analysis.totals.games} />
        <Metric icon={<Users />} label="Players" value={analysis.players.length} />
        <Metric icon={<Swords />} label="Combats" value={analysis.totals.combats} />
        <Metric icon={<Crosshair />} label="Ranged attacks" value={analysis.totals.rangedAttacks} />
        <Metric icon={<Dice5 />} label="Tracked dice" value={analysis.totals.totalDice} />
        <Metric icon={<Trophy />} label="Unlikely fights" value={analysis.totals.flaggedFights} />
      </section>

      <section className="two-column">
        <Panel title="Aggregate Player Luck" icon={<BarChart3 />}>
          <PlayerLuck
            players={analysis.players}
            favor={analysis.favor}
            firstHalf={analysis.firstHalfLuck}
            latterHalf={analysis.latterHalfLuck}
          />
        </Panel>
        <Panel title="Opponent Faction Overview" icon={<Shield />}>
          <OpponentFactionOverview overview={analysis.opponentFactions} />
        </Panel>
      </section>

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
      {overview.map((player) => (
        <div className="opponent-player-card" key={player.playerName}>
          <div className="opponent-player-heading">
            <strong>{player.playerName}</strong>
            <span>{player.games} game{player.games === 1 ? "" : "s"}</span>
          </div>
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
            <th>Factions</th>
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
              <td>{game.factions?.map((faction) => faction.name).join(" vs ")}</td>
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
