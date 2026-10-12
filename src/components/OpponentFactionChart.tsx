import { formatPercent } from "./format";

export function OpponentFactionChart({ player }) {
  const factions = [...player.factions].sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
  const maximum = Math.max(1, ...factions.map((faction) => faction.games));
  return (
    <figure className="opponent-chart">
      <figcaption>{player.games} replays · Number of games against each faction</figcaption>
      <div className="opponent-chart-bars">
        {factions.map((faction) => (
          <div className="opponent-chart-row" key={faction.id}>
            <span className="opponent-chart-label">
              {faction.iconUrl && <img src={faction.iconUrl} alt="" />}
              {faction.name}
            </span>
            <div className="opponent-chart-track opponent-faction-bar" role="img" aria-label={`${faction.name}: ${faction.games} games, ${formatPercent(faction.percentage)}`}>
              <span style={{ width: `${faction.games / maximum * 100}%` }} />
            </div>
            <span className="opponent-chart-value">{faction.games} ({formatPercent(faction.percentage)})</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
