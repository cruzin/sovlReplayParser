import { BarChart3, Crosshair, Dice5, Files, Swords, Trophy, Users, WandSparkles } from "lucide-react";
import { BulkRerolls } from "./EffectsAndRerolls";
import { formatNumber, formatPValue } from "./format";
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
        <Panel title="Bulk Rerolls" icon={<WandSparkles />}>
          <BulkRerolls rerolls={analysis.rerolls} totals={analysis.totals} />
        </Panel>
      </section>

      <section className="panel">
        <PanelHeading icon={<Files />} title="Games In Batch" />
        <BulkGameTable games={analysis.games} />
      </section>
    </>
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
