import type { PlayerAppearance } from "../services/globalStatistics";

export function PlayerAppearancesChart({ players }: { players: PlayerAppearance[] }) {
  const sorted = [...players].sort((a, b) => b.games - a.games || a.player_name.localeCompare(b.player_name));
  const maximum = Math.max(1, ...sorted.map((player) => player.games));
  return <figure className="player-appearances-chart">
    <figcaption>Number of the latest 30 matches featuring each player. Names are grouped ignoring case and surrounding spaces. This counts players in matches, not the accounts submitting them.</figcaption>
    {!sorted.length ? <p className="empty">No player appearances recorded.</p> : <ul>
      {sorted.map((player) => <li key={player.player_name}>
        <span className="player-appearances-name">{player.player_name}</span>
        <div className="player-appearances-track" role="img" aria-label={`${player.player_name}: ${player.games} ${player.games === 1 ? "match" : "matches"}`}>
          <span style={{ width: `${100 * player.games / maximum}%` }} />
        </div>
        <strong>{player.games}</strong>
      </li>)}
    </ul>}
  </figure>;
}
