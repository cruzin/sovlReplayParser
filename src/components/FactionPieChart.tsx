import { useState } from "react";
import type { StatisticsRow } from "../services/globalStatistics";

const colors = ["#3979ae", "#679a3b", "#bc8042", "#8961b3", "#b95166", "#379b91", "#d16c39", "#5769b1", "#988b31", "#477d54", "#ae5895", "#ae493f", "#498eac", "#7b838c"];
const factionIds = ["EmpiresOfMen", "GreenskinTribes", "DwarfHolds", "ElvenConclaves", "DeadNations", "GoatmenRaiders", "AbyssalLegions", "ReptilianKingdoms", "RatkinClans", "DeepwoodGuardians", "DarkbornElves", "AbyssalDemons", "KnightsOfAvalon", "unknown"];
const label = (id: string) => id === "unknown" ? "Unknown faction" : id.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

export function FactionPieChart({ rows, selected, onSelect }: {
  rows: StatisticsRow[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState("");
  const factions = [...rows].filter((row) => row.games > 0).sort((a, b) => b.games - a.games || a.faction_id.localeCompare(b.faction_id));
  const total = factions.reduce((sum, row) => sum + row.games, 0);
  if (!total) return null;
  let angle = -Math.PI / 2;
  const slices = factions.map((row) => {
    const start = angle;
    angle += row.games / total * Math.PI * 2;
    return {
      ...row,
      path: `M 160 160 L ${160 + 144 * Math.cos(start)} ${160 + 144 * Math.sin(start)} A 144 144 0 ${angle - start > Math.PI ? 1 : 0} 1 ${160 + 144 * Math.cos(angle)} ${160 + 144 * Math.sin(angle)} Z`,
      color: colors[Math.max(0, factionIds.indexOf(row.faction_id))],
      description: `${label(row.faction_id)}: ${row.games.toLocaleString()} army appearances (${(100 * row.games / total).toFixed(1)}%)`,
    };
  });
  const active = slices.find((row) => row.faction_id === (hovered || selected));
  const toggle = (id: string) => onSelect(id === selected ? "" : id);
  return <figure className="faction-pie">
    <figcaption>Share of all {total.toLocaleString()} army appearances. Select a faction to filter the results below.</figcaption>
    <div className="faction-pie-layout">
      <div className="faction-pie-visual">
        <svg viewBox="0 0 320 320" role="group" aria-label="Faction popularity pie chart">
          {slices.map((slice) => {
            const props = {
              fill: slice.color,
              className: "faction-pie-slice",
              style: { opacity: (hovered || selected) && (hovered || selected) !== slice.faction_id ? 0.45 : 1 },
              tabIndex: 0,
              role: "button",
              "aria-label": slice.description,
              "aria-pressed": slice.faction_id === selected,
              onMouseEnter: () => setHovered(slice.faction_id),
              onMouseLeave: () => setHovered(""),
              onFocus: () => setHovered(slice.faction_id),
              onBlur: () => setHovered(""),
              onClick: () => toggle(slice.faction_id),
              onKeyDown: (event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(slice.faction_id); }
              },
            };
            return slices.length === 1
              ? <circle key={slice.faction_id} cx="160" cy="160" r="144" {...props}><title>{slice.description}</title></circle>
              : <path key={slice.faction_id} d={slice.path} {...props}><title>{slice.description}</title></path>;
          })}
        </svg>
        <p className="faction-pie-detail">{active?.description ?? "Both armies count in each match, including mirror matches."}</p>
      </div>
      <ul className="faction-pie-legend">{slices.map((slice) => <li key={slice.faction_id}>
        <button type="button" aria-pressed={selected === slice.faction_id} onClick={() => toggle(slice.faction_id)}
          onMouseEnter={() => setHovered(slice.faction_id)} onMouseLeave={() => setHovered("")}
          onFocus={() => setHovered(slice.faction_id)} onBlur={() => setHovered("")}>
          <span className="faction-pie-swatch" style={{ background: slice.color }} aria-hidden="true" />
          <span>{label(slice.faction_id)}</span>
          <strong>{(100 * slice.games / total).toFixed(1)}% <small>({slice.games.toLocaleString()})</small></strong>
        </button>
      </li>)}</ul>
    </div>
  </figure>;
}
