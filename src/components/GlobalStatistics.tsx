import { useEffect, useState } from "react";
import { BarChart3, Swords, Trophy, Users } from "lucide-react";
import { supabase } from "../services/supabase";
import { fetchGlobalStatistics } from "../services/globalStatistics";
import type { GlobalStatistics as Statistics, StatisticsRow, StatisticsScope } from "../services/globalStatistics";
import { Metric, Panel } from "./Panel";
import { FactionPieChart } from "./FactionPieChart";
import { PlayerAppearancesChart } from "./PlayerAppearancesChart";

function name(id: string) {
  return id === "unknown" ? "Unknown faction" : id.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function ResultsTable({ rows, kind, opponentsOnly = false }: { rows: StatisticsRow[]; kind: "factions" | "commanders" | "matchups"; opponentsOnly?: boolean }) {
  if (!rows.length) return <p className="empty">No recorded results for this selection.</p>;
  return <div className="table-wrap"><table>
    <thead><tr>
      <th>Faction</th>
      {kind === "commanders" && <th>Commander</th>}
      {kind === "matchups" && <th>{opponentsOnly ? "Uploader faction" : "Opponent faction"}</th>}
      <th>Army appearances</th><th>Wins</th><th>Losses</th><th>Draws</th><th>Win rate</th><th>Avg win score diff</th>
    </tr></thead>
    <tbody>{rows.map((row) => <tr key={`${row.faction_id}:${row.commander_type_id ?? row.opponent_faction_id ?? ""}`}>
      <td>{name(row.faction_id)}</td>
      {kind === "commanders" && <td>{name(row.commander_type_id)}</td>}
      {kind === "matchups" && <td>{name(row.opponent_faction_id)}</td>}
      <td>{row.games.toLocaleString()}</td><td>{row.wins.toLocaleString()}</td><td>{row.losses.toLocaleString()}</td><td>{row.draws.toLocaleString()}</td>
      <td>{row.games ? `${(100 * row.wins / row.games).toFixed(1)}%` : "—"}</td>
      <td>{row.average_score_difference == null ? "—" : `${row.average_score_difference > 0 ? "+" : ""}${row.average_score_difference.toFixed(1)}`}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function GlobalStatistics({ scope = "all" }: { scope?: StatisticsScope }) {
  const [data, setData] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [faction, setFaction] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setLoading(true);
    setError("");
    fetchGlobalStatistics(supabase, controller.signal, scope).then((result) => {
      if (active && !controller.signal.aborted) setData(result);
    }).catch((error) => {
      if (active) setError(controller.signal.aborted ? "Statistics request timed out. Try refreshing." : error.message);
    }).finally(() => {
      clearTimeout(timeout);
      if (active) setLoading(false);
    });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [refresh, scope]);

  const filter = (rows: StatisticsRow[]) => rows.filter((row) => !faction || row.faction_id === faction);
  const opponentsOnly = scope === "onlyOpponents";
  return <main className="app-shell">
    <section className="topbar">
      <div><p className="eyebrow">SOVL Replay Analyzer</p><h1>{opponentsOnly ? "Opponents only" : scope === "latestUploads" ? "Latest 30 uploads" : "Global statistics"}</h1><p className="subtitle">{opponentsOnly ? "All-time results for opponents of inferred uploaders. Uploader armies are excluded." : scope === "latestUploads" ? "Statistics for the 30 most recently uploaded matches, ordered by upload time." : "Recorded match results across the database."}</p></div>
      <button type="button" className="theme-toggle" onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
    </section>
    {loading && <p className="loading" role="status">Loading statistics…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!loading && !error && data && <>
      <section className="metric-grid">
        <Metric icon={<Swords />} label="Recorded matches" value={data.matches.toLocaleString()} />
        <Metric icon={<Trophy />} label="Drawn matches" value={data.draws.toLocaleString()} />
        <Metric icon={<Users />} label="Factions played" value={data.factions.length} />
        <Metric icon={<BarChart3 />} label="Latest match" value={data.latestMatch ? new Date(data.latestMatch).toLocaleDateString() : "—"} />
      </section>
      {opponentsOnly && <p className="subtitle">{data.matches.toLocaleString()} matches included · {data.excludedMatches.toLocaleString()} excluded because the uploader could not be inferred. Identification is based on player-name frequency, not a verified account identity.</p>}
      {!data.matches ? <p className="empty">{opponentsOnly ? "No matches with an inferred uploader have been recorded yet." : "No completed matches have been recorded yet."}</p> : <>
        {scope === "latestUploads" && <Panel title="Player appearances" icon={<Users />}>
          {data.playerAppearances ? <PlayerAppearancesChart players={data.playerAppearances} /> : <p className="empty">Player appearance data is not available yet.</p>}
        </Panel>}
        <Panel title="Faction popularity" icon={<BarChart3 />}>
          <FactionPieChart rows={data.factions} selected={faction} onSelect={setFaction} opponentsOnly={opponentsOnly} />
        </Panel>
        <div className="global-statistics-filter">
          <label>Faction <select value={faction} onChange={(event) => setFaction(event.target.value)}>
            <option value="">All factions</option>
            {data.factions.map((row) => <option key={row.faction_id} value={row.faction_id}>{name(row.faction_id)}</option>)}
          </select></label>
        </div>
        <Panel title="Faction results" icon={<Users />}><ResultsTable rows={filter(data.factions)} kind="factions" /></Panel>
        <Panel title="Faction matchups" icon={<Swords />}><ResultsTable rows={filter(data.matchups)} kind="matchups" opponentsOnly={opponentsOnly} /></Panel>
        <Panel title="Commander results" icon={<Trophy />}><ResultsTable rows={filter(data.commanders)} kind="commanders" /></Panel>
        <p className="subtitle">Win rate is wins divided by army appearances; draws count as non-wins. {opponentsOnly ? "Each eligible match contributes one opponent army, including mirror matches. Matchups show that opponent’s results against the uploader’s faction." : "Each match contributes two army appearances, including mirror matches."} Commander results count armies containing that type once per match, regardless of copies. Average win score differences include wins only, from the listed faction’s perspective; no wins is shown as —. Small samples may not reflect overall balance.</p>
      </>}
    </>}
  </main>;
}
