export type StatisticsRow = {
  faction_id: string;
  commander_type_id?: string;
  opponent_faction_id?: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  average_score_difference: number;
};

export type GlobalStatistics = {
  matches: number;
  draws: number;
  latestMatch: string | null;
  factions: StatisticsRow[];
  commanders: StatisticsRow[];
  matchups: StatisticsRow[];
};

export async function fetchGlobalStatistics(client, signal?: AbortSignal): Promise<GlobalStatistics> {
  const { data, error } = await client.rpc("global_statistics").abortSignal(signal ?? AbortSignal.timeout(30_000));
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("Global statistics are not set up yet. Run the supplied global_statistics SQL migration in Supabase, then refresh.");
    }
    throw new Error(error.message || "Could not load global statistics.");
  }
  if (!data || !Number.isInteger(data.matches) || data.matches < 0 ||
      !Number.isInteger(data.draws) || data.draws < 0 ||
      ![data.factions, data.commanders, data.matchups].every(Array.isArray)) {
    throw new Error("The statistics server returned an unexpected response.");
  }
  return data;
}
