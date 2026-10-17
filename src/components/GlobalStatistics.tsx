import { useEffect, useState } from "react";
import { BarChart3, Swords, Trophy, Users } from "lucide-react";
import { supabase } from "../services/supabase";
import { fetchGlobalStatistics } from "../services/globalStatistics";
import type { GlobalStatistics as Statistics, StatisticsRow } from "../services/globalStatistics";
import { Metric, Panel } from "./Panel";
import { FactionPieChart } from "./FactionPieChart";

function name(id: string) {
  return id === "unknown" ? "Unknown faction" : id.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function ResultsTable({ rows, kind }: { rows: StatisticsRow[]; kind: "factions" | "commanders" | "matchups" }) {
  if (!rows.length) return <p className="empty">No recorded results for this selection.</p>;
  return <div className="table-wrap"><table>
    <thead><tr>
      <th>Faction</th>
      {kind === "commanders" && <th>Commander</th>}
      {kind === "matchups" && <th>Opponent faction</th>}
      <th>Army appearances</th><th>Wins</th><th>Losses</th><th>Draws</th><th>Win rate</th><th>Avg score difference</th>
    </tr></thead>
    <tbody>{rows.map((row) => <tr key={`${row.faction_id}:${row.commander_type_id ?? row.opponent_faction_id ?? ""}`}>
      <td>{name(row.faction_id)}</td>
      {kind === "commanders" && <td>{name(row.commander_type_id)}</td>}
      {kind === "matchups" && <td>{name(row.opponent_faction_id)}</td>}
      <td>{row.games.toLocaleString()}</td><td>{row.wins.toLocaleString()}</td><td>{row.losses.toLocaleString()}</td><td>{row.draws.toLocaleString()}</td>
      <td>{row.games ? `${(100 * row.wins / row.games).toFixed(1)}%` : "—"}</td>
      <td>{row.average_score_difference > 0 ? "+" : ""}{row.average_score_difference.toFixed(1)}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function GlobalStatistics() {
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
    fetchGlobalStatistics(supabase, controller.signal).then((result) => {
      if (active && !controller.signal.aborted) setData(result);
    }).catch((error) => {
      if (active) setError(controller.signal.aborted ? "Statistics request timed out. Try refreshing." : error.message);
    }).finally(() => {
      clearTimeout(timeout);
      if (active) setLoading(false);
    });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [refresh]);

  const filter = (rows: StatisticsRow[]) => rows.filter((row) => !faction || row.faction_id === faction);
  return <main className="app-shell">
    <section className="topbar">
      <div><p className="eyebrow">SOVL Replay Analyzer</p><h1>Global statistics</h1><p className="subtitle">Recorded match results across the database.</p></div>
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
      {!data.matches ? <p className="empty">No completed matches have been recorded yet.</p> : <>
        <Panel title="Faction popularity" icon={<BarChart3 />}>
          <FactionPieChart rows={data.factions} selected={faction} onSelect={setFaction} />
        </Panel>
        <div className="global-statistics-filter">
          <label>Faction <select value={faction} onChange={(event) => setFaction(event.target.value)}>
            <option value="">All factions</option>
            {data.factions.map((row) => <option key={row.faction_id} value={row.faction_id}>{name(row.faction_id)}</option>)}
          </select></label>
        </div>
        <Panel title="Faction results" icon={<Users />}><ResultsTable rows={filter(data.factions)} kind="factions" /></Panel>
        <Panel title="Faction matchups" icon={<Swords />}><ResultsTable rows={filter(data.matchups)} kind="matchups" /></Panel>
        <Panel title="Commander results" icon={<Trophy />}><ResultsTable rows={filter(data.commanders)} kind="commanders" /></Panel>
        <p className="subtitle">Win rate is wins divided by army appearances; draws count as non-wins. Each match contributes two army appearances, including mirror matches. Commander results count armies containing that type once per match, regardless of copies. Score differences are from the listed faction’s perspective. Small samples may not reflect overall balance.</p>
      </>}
    </>}
  </main>;
}
