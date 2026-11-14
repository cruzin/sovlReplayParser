export type StatisticsRow = {
  faction_id: string;
  commander_type_id?: string;
  opponent_faction_id?: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  average_score_difference: number | null;
};

export type PlayerAppearance = { player_name: string; games: number };

export type GlobalStatistics = {
  matches: number;
  draws: number;
  latestMatch: string | null;
  factions: StatisticsRow[];
  commanders: StatisticsRow[];
  matchups: StatisticsRow[];
  playerAppearances?: PlayerAppearance[];
  excludedMatches?: number;
};

export type StatisticsScope = "all" | "latestUploads" | "onlyOpponents";

export async function fetchGlobalStatistics(client, signal?: AbortSignal, scope: StatisticsScope = "all"): Promise<GlobalStatistics> {
  const rpc = { all: "global_statistics", latestUploads: "latest_upload_statistics", onlyOpponents: "opponent_statistics" }[scope];
  const { data, error } = await client.rpc(rpc).abortSignal(signal ?? AbortSignal.timeout(30_000));
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error(`Statistics are not set up yet. Run the supplied ${rpc} SQL migration in Supabase, then refresh.`);
    }
    throw new Error(error.message || "Could not load global statistics.");
  }
  if (!data || !Number.isInteger(data.matches) || data.matches < 0 || (scope === "latestUploads" && data.matches > 30) ||
      !Number.isInteger(data.draws) || data.draws < 0 ||
      ![data.factions, data.commanders, data.matchups].every(Array.isArray)) {
    throw new Error("The statistics server returned an unexpected response.");
  }
  if (scope === "latestUploads" && data.playerAppearances !== undefined &&
      (!Array.isArray(data.playerAppearances) || data.playerAppearances.some((row) =>
        !row || typeof row.player_name !== "string" || !Number.isInteger(row.games) || row.games < 1 || row.games > data.matches))) {
    throw new Error("The statistics server returned invalid player appearances.");
  }
  if (scope === "onlyOpponents" && (!Number.isInteger(data.excludedMatches) || data.excludedMatches < 0)) {
    throw new Error("The statistics server returned invalid opponent coverage.");
  }
  if (scope === "onlyOpponents" && data.factions.reduce((total, row) => total + row.games, 0) !== data.matches) {
    throw new Error("Opponent statistics must count one army per included match.");
  }
  return data;
}
