export function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

export function signed(value: number, digits = 1) {
  const fixed = formatNumber(value, digits);
  return value > 0 ? `+${fixed}` : fixed;
}

export function formatPercent(value: number) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : "n/a";
}

export function formatPValue(value: number) {
  if (!Number.isFinite(value)) return "n/a";
  if (value < 0.001) return "<0.001";
  return value.toFixed(3);
}

export function summarizeTargets(targetNames: string[]) {
  const unique = [...new Set(targetNames)];
  if (!unique.length) return "no listed targets";
  if (unique.length <= 3) return unique.join(", ");
  return `${unique.slice(0, 3).join(", ")} +${unique.length - 3} more`;
}

export function formatRerollExamples(examples: Array<{ from: number; to: number }>) {
  if (!examples.length) return "available";
  return examples
    .slice(0, 4)
    .map((example) => `${example.from}->${example.to}`)
    .join(", ");
}
