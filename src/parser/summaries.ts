import { classifyLuck, twoTailedNormalP } from "./probability";
import { getSpellEffect, isKnownSpellEffect, shouldIgnoreSpellImpact } from "./spellEffects";
import { formatDecimal, formatPercent, shortType, sum, titleCase } from "./utils";

export function comparePlayerLuck(players) {
  const [a, b] = players;
  if (!a || !b) return null;
  const diff = a.successDelta - b.successDelta;
  const stdDev = Math.sqrt(a.successStdDev ** 2 + b.successStdDev ** 2);
  const z = stdDev ? diff / stdDev : 0;
  const pValue = twoTailedNormalP(z);
  const favored = diff >= 0 ? a : b;
  return {
    favoredPlayerId: favored.id,
    favoredPlayerName: favored.name,
    successDeltaDifference: Math.abs(diff),
    z,
    pValue,
    level: classifyLuck(pValue, z),
  };
}

export function summarizeUnlikelyWins(combats) {
  const highSwingFights = combats
    .filter((combat) => combat.highSwing)
    .sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing));
  const underdogWins = combats
    .filter((combat) => combat.underdogWon)
    .sort((a, b) => a.winnerPreRollChance - b.winnerPreRollChance);
  const combined = [...new Map([...underdogWins, ...highSwingFights].map((combat) => [combat.id, combat])).values()].sort(
    (a, b) => Math.abs(b.swing) - Math.abs(a.swing),
  );
  return {
    highSwingCount: highSwingFights.length,
    underdogWinCount: underdogWins.length,
    totalFlagged: combined.length,
    fights: combined,
  };
}

export function summarizeUnitFates(units, events, combats, rangedAttacks, disciplineTests) {
  const fates = new Map<any, any>(
    units.map((unit) => [
      unit.globalId,
      {
        ...unit,
        startingModels: unit.count || 0,
        estimatedRemaining: unit.count || 0,
        woundsCaused: 0,
        expectedWoundsCaused: 0,
        woundsTaken: 0,
        expectedWoundsTaken: 0,
        rangedWoundsCaused: 0,
        rangedWoundsTaken: 0,
        crumbleLosses: 0,
        breakTests: 0,
        failedBreakTests: 0,
        rallies: 0,
        heals: 0,
        destroyed: false,
        destroyedReason: "",
        notes: [],
      },
    ]),
  );

  for (const combat of combats) {
    const fateA = fates.get(combat.unitA.globalId);
    const fateB = fates.get(combat.unitB.globalId);
    if (fateA) {
      fateA.woundsCaused += combat.actualA;
      fateA.expectedWoundsCaused += combat.expectedA;
      fateA.woundsTaken += combat.actualB;
      fateA.expectedWoundsTaken += combat.expectedB;
    }
    if (fateB) {
      fateB.woundsCaused += combat.actualB;
      fateB.expectedWoundsCaused += combat.expectedB;
      fateB.woundsTaken += combat.actualA;
      fateB.expectedWoundsTaken += combat.expectedA;
    }
  }

  for (const attack of rangedAttacks) {
    const attacker = fates.get(attack.attacker.globalId);
    const defender = fates.get(attack.defender.globalId);
    if (attacker) attacker.rangedWoundsCaused += attack.wounds;
    if (defender) {
      defender.rangedWoundsTaken += attack.wounds;
      defender.woundsTaken += attack.wounds;
    }
  }

  for (const test of disciplineTests) {
    const fate = fates.get(test.unit.globalId);
    if (!fate) continue;
    if (test.crumble) {
      fate.crumbleLosses += test.rollTotal;
      fate.woundsTaken += test.rollTotal;
      fate.notes.push(`Crumble ${test.rollTotal}`);
    } else {
      fate.breakTests += 1;
      if (!test.success) {
        fate.failedBreakTests += 1;
        fate.notes.push(`Failed discipline ${test.rollTotal}/${test.target}`);
      }
    }
  }

  events.forEach((event, eventIndex) => {
    const fate = fates.get(event.unitID);
    if (!fate) return;
    const type = shortType(event?.$type);
    if (type === "UnitDestroyedEvent") {
      fate.destroyed = true;
      fate.destroyedReason = event.reason || "destroyed";
      fate.estimatedRemaining = 0;
      fate.notes.push(`Destroyed #${eventIndex}: ${fate.destroyedReason}`);
    }
    if (type === "UnitRallyEvent") {
      fate.rallies += 1;
      fate.notes.push(`Rallied #${eventIndex}`);
    }
    if (type === "UnitHealEvent") {
      const amount = Number(event.healAmount || event.restoreModels || 0);
      fate.heals += amount;
      fate.notes.push(`Healed ${amount}`);
    }
  });

  for (const fate of fates.values()) {
    if (!fate.destroyed) {
      fate.estimatedRemaining = Math.max(0, fate.startingModels + fate.heals - fate.woundsTaken);
    }
    fate.netWoundSwing = fate.woundsCaused - fate.woundsTaken;
    fate.expectedNetWoundSwing = fate.expectedWoundsCaused - fate.expectedWoundsTaken;
    fate.performanceSwing = fate.netWoundSwing - fate.expectedNetWoundSwing;
    fate.status = fate.destroyed ? "Destroyed" : fate.failedBreakTests ? "Failed discipline" : "Survived";
  }

  return [...fates.values()].sort((a, b) => Math.abs(b.performanceSwing) - Math.abs(a.performanceSwing));
}

export function summarizeSwingEvents(combats, disciplineTests, rollGroups) {
  const combatEvents = combats
    .filter((combat) => combat.highSwing || combat.underdogWon)
    .map((combat) => ({
      id: `swing-${combat.id}`,
      eventIndex: Number(combat.id.replace("combat-", "")),
      type: combat.underdogWon ? "Underdog win" : "Combat swing",
      title: `${combat.unitA.name} vs ${combat.unitB.name}`,
      detail: `${combat.actualA}-${combat.actualB} wounds, expected ${formatDecimal(combat.expectedA)}-${formatDecimal(combat.expectedB)}`,
      swing: combat.swing,
      playerName: combat.winner?.playerName || "No winner",
    }));
  const rollEvents = rollGroups
    .filter((group) => Math.abs(group.successDelta) >= 2)
    .map((group) => ({
      id: `swing-${group.id}`,
      eventIndex: group.eventIndex,
      type: `${titleCase(group.phase)} rolls`,
      title: group.label,
      detail: `${group.successes}/${group.rolls.length} successes vs ${formatDecimal(group.expectedSuccesses)} expected`,
      swing: group.successDelta,
      playerName: group.playerName,
    }));
  const disciplineEvents = disciplineTests
    .filter((test) => !test.crumble && ((test.success && test.probability < 0.35) || (!test.success && test.probability > 0.65)))
    .map((test) => ({
      id: `swing-${test.id}`,
      eventIndex: Number(test.id.replace("discipline-", "")),
      type: "Discipline swing",
      title: test.unit.name,
      detail: `${test.success ? "Passed" : "Failed"} ${test.rollTotal} needing ${test.target} (${formatPercent(test.probability)})`,
      swing: test.success ? 1 - test.probability : -test.probability,
      playerName: test.unit.playerName,
    }));

  return [...combatEvents, ...rollEvents, ...disciplineEvents]
    .sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))
    .slice(0, 30);
}

export function summarizeSpellImpact(activeEffects, rollGroups) {
  const visibleEffects = activeEffects.filter((effect) => !shouldIgnoreSpellImpact(effect.name));
  return visibleEffects.map((effect, index) => {
    const definition = getSpellEffect(effect.name);
    const nextEffectIndex = visibleEffects[index + 1]?.eventIndex ?? Infinity;
    const windowEnd = definition.windowEvents
      ? effect.eventIndex + definition.windowEvents
      : Math.min(nextEffectIndex, effect.eventIndex + 40);
    const relatedGroups = rollGroups
      .filter((group) => group.eventIndex > effect.eventIndex && group.eventIndex <= windowEnd)
      .map((group) => ({ group, reason: definition.affects(effect, group) }))
      .filter((item) => item.reason);
    const groups = relatedGroups.map((item) => item.group);
    return {
      ...effect,
      known: isKnownSpellEffect(effect.name),
      ruleText: definition.text,
      tags: definition.tags,
      estimate: definition.estimate?.(effect) ?? null,
      windowEnd,
      relatedRollGroups: groups.length,
      successDelta: sum(groups.map((group) => group.successDelta)),
      rerollsApplied: sum(groups.map((group) => group.rerolls?.applied || 0)),
      rerollsAvailable: sum(groups.map((group) => group.rerolls?.available || 0)),
      notableGroups: relatedGroups
        .filter(({ group }) => Math.abs(group.successDelta) >= 1 || group.rerolls?.available)
        .map(({ group, reason }) => ({ ...group, impactReason: reason }))
        .slice(0, 4),
    };
  });
}
