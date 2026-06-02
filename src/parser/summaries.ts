import { classifyLuck, compareDistributions, twoTailedNormalP } from "./probability";
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

export function summarizeTurnRecaps(combats, players, activeEffects = []) {
  const combatsByTurn = new Map<any, any[]>();
  for (const combat of combats) {
    if (!combat.turn || combat.turn <= 1) continue;
    const turnCombats = combatsByTurn.get(combat.turn) ?? [];
    turnCombats.push(combat);
    combatsByTurn.set(combat.turn, turnCombats);
  }

  return [...combatsByTurn.entries()]
    .sort(([turnA], [turnB]) => Number(turnA) - Number(turnB))
    .map(([turn, turnCombats]) => {
      const turnEffects = activeEffects.filter((effect) => effect.turn === turn);
      const combatGroups = groupConnectedCombats(turnCombats).map((group, index) =>
        summarizeTurnCombatGroup(group, turn, index, turnEffects),
      );
      const playerSummaries = players.map((player) => {
        const expectedWounds = sum(combatGroups.map((group) => group.players[player.id]?.expectedWounds ?? 0));
        const actualWounds = sum(combatGroups.map((group) => group.players[player.id]?.actualWounds ?? 0));
        const winChance = combatGroups.length
          ? sum(combatGroups.map((group) => group.players[player.id]?.winChance ?? 0)) / combatGroups.length
          : 0;
        return {
          id: player.id,
          name: player.name,
          expectedWounds,
          actualWounds,
          winChance,
        };
      });
      const favor = describeTurnFavor(playerSummaries);
      const combatFavorCounts = summarizeCombatFavorCounts(combatGroups, players);
      return {
        turn,
        combats: combatGroups,
        favor,
        combatFavorCounts,
        totalCombats: turnCombats.length,
      };
    })
    .filter((turn) => turn.combats.length);
}

function summarizeCombatFavorCounts(combatGroups, players) {
  const [a, b] = players;
  const counts = {
    player1: 0,
    even: 0,
    player2: 0,
    player1Name: a?.name ?? "Player 1",
    player2Name: b?.name ?? "Player 2",
  };
  if (!a || !b) return counts;

  for (const combat of combatGroups) {
    const chanceA = combat.players[a.id]?.winChance ?? 0.5;
    const chanceB = combat.players[b.id]?.winChance ?? 0.5;
    const difference = Math.abs(chanceA - chanceB);
    if (difference < 0.08) {
      counts.even += 1;
    } else if (chanceA > chanceB) {
      counts.player1 += 1;
    } else {
      counts.player2 += 1;
    }
  }

  return counts;
}

function groupConnectedCombats(combats) {
  const remaining = [...combats];
  const groups = [];

  while (remaining.length) {
    const group = [remaining.shift()];
    const unitIds = new Set(group.flatMap((combat) => [combat.unitA.globalId, combat.unitB.globalId]));
    let changed = true;

    while (changed) {
      changed = false;
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        const combat = remaining[index];
        if (unitIds.has(combat.unitA.globalId) || unitIds.has(combat.unitB.globalId)) {
          group.push(combat);
          unitIds.add(combat.unitA.globalId);
          unitIds.add(combat.unitB.globalId);
          remaining.splice(index, 1);
          changed = true;
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

function summarizeTurnCombatGroup(combats, turn, groupIndex, turnEffects = []) {
  const playerIds = [...new Set(combats.flatMap((combat) => [combat.unitA.playerId, combat.unitB.playerId]))].sort();
  const unitsByPlayer = new Map(playerIds.map((playerId) => [playerId, new Map()]));
  const commandersByPlayer = new Map(playerIds.map((playerId) => [playerId, new Map()]));
  const specialRulesByPlayer = new Map(playerIds.map((playerId) => [playerId, []]));
  const activeEffectsByPlayer = new Map(playerIds.map((playerId) => [playerId, new Map()]));
  const firstEventIndex = Math.min(...combats.map((combat) => combat.eventIndex));
  const lastEventIndex = Math.max(...combats.map((combat) => combat.eventIndex));
  const statsByPlayer = new Map(
    playerIds.map((playerId) => [
      playerId,
      {
        expectedWounds: 0,
        actualWounds: 0,
        woundDistribution: [1],
      },
    ]),
  );

  for (const combat of combats) {
    unitsByPlayer.get(combat.unitA.playerId)?.set(combat.unitA.globalId, combat.unitA);
    unitsByPlayer.get(combat.unitB.playerId)?.set(combat.unitB.globalId, combat.unitB);
    for (const commander of combat.commanders ?? []) {
      commandersByPlayer.get(commander.playerId)?.set(`${commander.unit.globalId}-${commander.sourceId}`, commander);
    }
    for (const rule of combat.specialRules ?? []) {
      specialRulesByPlayer.get(rule.playerId)?.push(rule);
    }
    addCombatSide(statsByPlayer.get(combat.unitA.playerId), combat.expectedA, combat.actualA, combat.woundDistributionA);
    addCombatSide(statsByPlayer.get(combat.unitB.playerId), combat.expectedB, combat.actualB, combat.woundDistributionB);
  }

  const unitIds = new Set([...unitsByPlayer.values()].flatMap((unitMap) => [...unitMap.keys()]));
  for (const effect of turnEffects) {
    if (effect.eventIndex > lastEventIndex) continue;
    const matchingTargets = effect.targets.filter((target) => unitIds.has(target.globalId));
    if (!matchingTargets.length) continue;
    for (const target of matchingTargets) {
      const playerEffects = activeEffectsByPlayer.get(target.playerId);
      playerEffects?.set(`${effect.id}-${target.globalId}`, {
        name: effect.name,
        casterName: effect.casterName,
        casterIsCharacter: effect.casterIsCharacter,
        targetName: target.name,
        beforeCombat: effect.eventIndex < firstEventIndex,
      });
    }
  }

  const [firstPlayerId, secondPlayerId] = playerIds;
  const firstStats = statsByPlayer.get(firstPlayerId);
  const secondStats = statsByPlayer.get(secondPlayerId);
  const firstWinChance =
    firstStats && secondStats ? compareDistributions(firstStats.woundDistribution, secondStats.woundDistribution) : 0.5;
  const actualMargin = (firstStats?.actualWounds ?? 0) - (secondStats?.actualWounds ?? 0);
  const expectedMargin = (firstStats?.expectedWounds ?? 0) - (secondStats?.expectedWounds ?? 0);
  const winningPlayerId = actualMargin > 0 ? firstPlayerId : actualMargin < 0 ? secondPlayerId : null;
  const winnerChance =
    winningPlayerId === firstPlayerId ? firstWinChance : winningPlayerId === secondPlayerId ? 1 - firstWinChance : 0.5;

  return {
    id: `turn-${turn}-combat-${groupIndex}`,
    turn,
    eventIndexes: combats.map((combat) => combat.eventIndex),
    unitsByPlayer: Object.fromEntries(
      playerIds.map((playerId) => [playerId, [...(unitsByPlayer.get(playerId)?.values() ?? [])]]),
    ),
    commandersByPlayer: Object.fromEntries(
      playerIds.map((playerId) => [playerId, [...(commandersByPlayer.get(playerId)?.values() ?? [])]]),
    ),
    specialRulesByPlayer: Object.fromEntries(playerIds.map((playerId) => [playerId, specialRulesByPlayer.get(playerId) ?? []])),
    activeEffectsByPlayer: Object.fromEntries(
      playerIds.map((playerId) => [playerId, [...(activeEffectsByPlayer.get(playerId)?.values() ?? [])]]),
    ),
    players: Object.fromEntries(
      playerIds.map((playerId) => {
        const stats = statsByPlayer.get(playerId);
        return [
          playerId,
          {
            expectedWounds: stats?.expectedWounds ?? 0,
            actualWounds: stats?.actualWounds ?? 0,
            winChance: playerId === firstPlayerId ? firstWinChance : 1 - firstWinChance,
          },
        ];
      }),
    ),
    expectedMargin,
    actualMargin,
    swing: actualMargin - expectedMargin,
    winningPlayerId,
    winnerChance,
    outcome: winningPlayerId == null ? "Draw by wounds" : "Won by wounds",
    combatCount: combats.length,
  };
}

function addCombatSide(stats, expectedWounds, actualWounds, distribution) {
  if (!stats) return;
  stats.expectedWounds += expectedWounds;
  stats.actualWounds += actualWounds;
  stats.woundDistribution = convolveDistributions(stats.woundDistribution, distribution || [1]);
}

function convolveDistributions(a, b) {
  const result = Array(a.length + b.length - 1).fill(0);
  for (let indexA = 0; indexA < a.length; indexA += 1) {
    for (let indexB = 0; indexB < b.length; indexB += 1) {
      result[indexA + indexB] += a[indexA] * b[indexB];
    }
  }
  return result;
}

function describeTurnFavor(players) {
  const [a, b] = players;
  if (!a || !b) return { label: "No player comparison", favoredPlayerName: null, difference: 0 };
  const difference = Math.abs(a.winChance - b.winChance);
  const favored = a.winChance >= b.winChance ? a : b;
  const label =
    difference < 0.08
      ? "Even turn"
      : difference < 0.18
        ? `${favored.name} slightly favored`
        : difference < 0.32
          ? `${favored.name} favored`
          : `${favored.name} very favored`;
  return {
    label,
    favoredPlayerId: difference < 0.08 ? null : favored.id,
    favoredPlayerName: difference < 0.08 ? null : favored.name,
    difference,
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
