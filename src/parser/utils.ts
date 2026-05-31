const TYPE_PREFIX = "SOVL.";

export function values(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node;
  if (Array.isArray(node.$values)) return node.$values;
  if (node.$values && typeof node.$values === "object") return Object.values(node.$values);
  return [];
}

export function shortType(type) {
  return String(type || "")
    .replace(TYPE_PREFIX, "")
    .replace(", Assembly-CSharp", "");
}

export function unknownUnit(id) {
  return {
    globalId: id,
    playerId: id >= 0 ? 1 : 0,
    playerName: "Unknown player",
    section: "Unknown",
    unitType: "Unknown",
    name: `Unit ${id}`,
    count: 0,
  };
}

export function stripUnityRichText(text) {
  return String(text || "").replace(/<[^>]+>/g, "").trim();
}

export function splitIdentifier(value) {
  return String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
}

export function titleCase(value) {
  return String(value)
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function sum(items) {
  return items.reduce((total, value) => total + (Number(value) || 0), 0);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

export function formatDecimal(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}
