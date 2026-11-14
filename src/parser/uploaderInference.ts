type Match = { identifier: string; players: { name: string }[] };
const playerKey = (name: string) => name.normalize("NFC").trim().toLowerCase();

// This is a batch-level heuristic, not a verified link to a signed-in account.
export function inferUploader(matches: Match[]): string | null {
  const unique = [...new Map(matches.map((match) => [match.identifier, match])).values()];
  if (unique.length < 2) return null;
  const counts = new Map<string, { name: string; games: number }>();
  for (const match of unique) {
    const names = new Map(match.players.map((player) => [playerKey(player.name), player.name]));
    for (const [key, name] of names) {
      const entry = counts.get(key) ?? { name, games: 0 };
      entry.games++;
      counts.set(key, entry);
    }
  }
  const ranked = [...counts.values()].sort((a, b) => b.games - a.games);
  if (!ranked.length || ranked[0].games < 2 || ranked[0].games === ranked[1]?.games) return null;
  return ranked[0].name;
}

export function annotateUploader<T extends Match>(matches: T[], bulk: boolean): (T & { uploader: string | null })[] {
  const uploader = bulk ? inferUploader(matches) : null;
  return matches.map((match) => {
    const matching = uploader === null ? [] : match.players.filter((player) => playerKey(player.name) === playerKey(uploader));
    // Preserve the exact payload spelling. Ambiguous names cannot identify a side.
    return { ...match, uploader: matching.length === 1 ? matching[0].name : null };
  });
}
