import { createStatisticsPayload } from "../parser/statistics";

export type UploadSummary = {
  received: number;
  inserted: number;
  duplicates: number;
  rejected: number;
  skipped: number;
  cached: number;
};

type UploadOptions = {
  endpoint: string;
  publishableKey: string;
  getToken: () => Promise<string>;
  bulk: boolean;
  fetcher?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
};

function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function readIdentifiers(storage: UploadOptions["storage"], key: string): Set<string> {
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? "[]");
    return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === "string" && /^sovl-match-v1:[a-f0-9]{64}$/.test(id)) : []);
  } catch { return new Set(); }
}

// Only summaries leave the browser. Split bulk uploads at the endpoint's limits.
export async function uploadStatistics(analyses, options: UploadOptions): Promise<UploadSummary> {
  const summary: UploadSummary = { received: 0, inserted: 0, duplicates: 0, rejected: 0, skipped: 0, cached: 0 };
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const cacheKey = `sovl-uploaded-matches-v1:${options.endpoint}`;
  const known = readIdentifiers(storage, cacheKey);
  const selected = new Set<string>();
  const payloads = [];
  for (const analysis of analyses) {
    const payload = await createStatisticsPayload(analysis);
    if (!payload) { summary.skipped++; continue; }
    if (known.has(payload.identifier) || selected.has(payload.identifier)) {
      summary.cached++;
      continue;
    }
    selected.add(payload.identifier);
    payloads.push(payload);
  }
  const batches = [];
  let batch = [];
  let bytes = 2; // JSON array brackets
  for (const payload of payloads) {
    const size = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
    if (size + 2 > 1_000_000) throw new Error("A match summary exceeds the upload size limit.");
    if (batch.length && (batch.length === 100 || bytes + size + 1 > 1_000_000)) {
      batches.push(batch);
      batch = [];
      bytes = 2;
    }
    bytes += size + (batch.length ? 1 : 0);
    batch.push(payload);
  }
  if (batch.length) batches.push(batch);

  for (const matches of batches) {
    try {
      const token = await options.getToken();
      const response = await (options.fetcher ?? fetch)(options.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: options.publishableKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(options.bulk ? matches : matches[0]),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Your session expired. Sign in again and retry.");
        if (response.status === 403) throw new Error("This account does not have upload permission.");
        throw new Error(`Statistics server returned HTTP ${response.status}.`);
      }
      const result = await response.json();
      if (![result.received, result.inserted, result.duplicates, result.rejected]
        .every((value) => Number.isInteger(value) && value >= 0) ||
        result.received !== matches.length ||
        result.inserted + result.duplicates + result.rejected !== result.received) {
        throw new Error("Statistics server returned an unexpected response.");
      }
      summary.received += result.received;
      summary.inserted += result.inserted;
      summary.duplicates += result.duplicates;
      summary.rejected += result.rejected;

      // The endpoint reports rejected entries by their index in this batch.
      // Without an unambiguous rejection list, cache none of a partial result.
      const rejectedIndices = Array.isArray(result.errors)
        ? result.errors.map((error) => error?.index) : [];
      const rejected = new Set(rejectedIndices);
      if (result.rejected === 0 || (rejectedIndices.length === result.rejected &&
          rejected.size === result.rejected && rejectedIndices.every((index) =>
            Number.isInteger(index) && index >= 0 && index < matches.length))) {
        const merged = readIdentifiers(storage, cacheKey);
        for (const [index, match] of matches.entries()) {
          if (result.rejected === 0 || !rejected.has(index)) merged.add(match.identifier);
        }
        try { storage?.setItem(cacheKey, JSON.stringify([...merged])); } catch {
          // Disabled/full storage must not turn a successful upload into a failure.
        }
      }
    } catch (error) {
      throw new Error(`${(error as Error).message} Confirmed so far: ${summary.inserted} added, ${summary.duplicates} already recorded, ${summary.rejected} rejected. You can retry; stored identifiers prevent duplicates.`);
    }
  }
  return summary;
}
