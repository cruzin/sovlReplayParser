export function showLatestUploadsLink(email?: string) {
  return email?.trim().toLowerCase() === "kjell.emil.wilhelmsen@gmail.com";
}

export function pageFromHash(hash: string): "parser" | "statistics" | "latestUploads" | "onlyOpponents" {
  if (hash === "#/statistics/onlyOpponents") return "onlyOpponents";
  if (hash === "#/statistics/latestUploads") return "latestUploads";
  if (hash === "#/statistics") return "statistics";
  return "parser";
}
