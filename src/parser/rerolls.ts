import { probabilityForD6Target } from "./probability";
import { clamp, sum, values } from "./utils";

export function analyzeRollArray({ id, label, playerId, playerName, unitName, phase, target, rolls }) {
  const baseProbability = probabilityForD6Target(target);
  const normalized = rolls.map((roll) => normalizeRoll(roll, baseProbability, target));
  const expectedPerRoll = normalized.length
    ? sum(normalized.map((item) => item.expectedSuccess)) / normalized.length
    : baseProbability;
  const successes = normalized.filter((item) => item.success).length;
  const expectedSuccesses = sum(normalized.map((item) => item.expectedSuccess));
  return {
    id,
    eventIndex: Number(id.match(/\d+/)?.[0] ?? 0),
    label,
    playerId,
    playerName,
    unitName,
    phase,
    target,
    targetLabel: target > 0 ? `${target}+` : "special",
    rolls: normalized,
    successes,
    expectedSuccesses,
    expectedPerRoll,
    successDelta: successes - expectedSuccesses,
    rerolls: summarizeRollRerolls(normalized),
  };
}

export function normalizeRoll(roll, baseSuccessProbability = 0.5, target = null) {
  const rerollTypes = values(roll?.rerollTypes).map((value) => Number(value));
  const adjustedSuccessProbability = adjustedProbabilityForRerolls(baseSuccessProbability, rerollTypes, target);
  return {
    result: Number(roll?.result || 0),
    success: Boolean(roll?.success || roll?.autoSuccess),
    rerolled: Boolean(roll?.rerolled),
    resultPreReroll: Number(roll?.resultPreReroll || 0),
    successPreReroll: Boolean(roll?.successPreReroll),
    rerollTypes,
    rerollLabels: rerollTypes.map(labelRerollType),
    expectedSuccess: adjustedSuccessProbability,
    successVariance: adjustedSuccessProbability * (1 - adjustedSuccessProbability),
    baseSuccessProbability,
    isD3: Boolean(roll?.isD3),
    doubleWounds: Boolean(roll?.doubleWounds),
  };
}

export function summarizeRollRerolls(rolls) {
  const applied = rolls.filter((roll) => roll.rerolled || roll.resultPreReroll);
  const available = rolls.filter((roll) => roll.rerollTypes.length);
  const byType = new Map();
  for (const roll of available) {
    for (const type of roll.rerollTypes) {
      const current = byType.get(type) || { type, label: labelRerollType(type), available: 0, applied: 0 };
      current.available += 1;
      if (roll.rerolled || roll.resultPreReroll) current.applied += 1;
      byType.set(type, current);
    }
  }
  return {
    available: available.length,
    applied: applied.length,
    byType: [...byType.values()],
    examples: applied.slice(0, 8).map((roll) => ({
      from: roll.resultPreReroll,
      to: roll.result,
      successBefore: roll.successPreReroll,
      successAfter: roll.success,
      labels: roll.rerollLabels,
    })),
  };
}

export function summarizeRerolls(rollGroups) {
  const groups = rollGroups.filter((group) => group.rerolls?.available || group.rerolls?.applied);
  const totals = {
    available: sum(groups.map((group) => group.rerolls.available)),
    applied: sum(groups.map((group) => group.rerolls.applied)),
  };
  return {
    ...totals,
    byType: mergeRerollTypes(groups.flatMap((group) => group.rerolls.byType)),
    groups,
  };
}

export function mergeRerollTypes(items) {
  const byType = new Map();
  for (const item of items) {
    const current = byType.get(item.type) || { ...item, available: 0, applied: 0 };
    current.available += item.available;
    current.applied += item.applied;
    byType.set(item.type, current);
  }
  return [...byType.values()];
}

function adjustedProbabilityForRerolls(baseProbability, rerollTypes, target = null) {
  const p = clamp(baseProbability, 0, 1);
  const numericTarget = Number(target);
  const naturalOneCanSucceed = Number.isFinite(numericTarget) && numericTarget <= 1;
  const naturalSixCanSucceed = !Number.isFinite(numericTarget) || numericTarget <= 6;

  if (rerollTypes.includes(2)) return p * p;
  if (rerollTypes.includes(4) && naturalSixCanSucceed) return clamp(p - 1 / 6 + p / 6, 0, 1);
  if (rerollTypes.includes(1)) return 1 - (1 - p) ** 2;
  if (rerollTypes.includes(3) && !naturalOneCanSucceed) return clamp(p + p / 6, 0, 1);
  return p;
}

function labelRerollType(type) {
  if (type === 1) return "reroll failed dice";
  if (type === 2) return "reroll successful dice";
  if (type === 3) return "reroll failed natural 1s";
  if (type === 4) return "reroll successful natural 6s";
  return `reroll type ${type}`;
}
