const TYPE_PREFIX = "SOVL.";

export function analyzeReplay(text, title = "Uploaded replay") {
  const replay = JSON.parse(text);
  const events = values(replay.events);
  const players = [
    makePlayer(0, replay.player0Name || "Player 0"),
    makePlayer(1, replay.player1Name || "Player 1"),
  ];
  const units = [
    ...extractUnits(replay.player0List, players[0]),
    ...extractUnits(replay.player1List, players[1]),
  ].map((unit, globalId) => ({ ...unit, globalId }));
  const unitById = new Map(units.map((unit) => [unit.globalId, unit]));
  const rollGroups = [];
  const combats = [];
  const rangedAttacks = [];
  const disciplineTests = [];
  const activeEffects = [];

  events.forEach((event, eventIndex) => {
    const type = shortType(event?.$type);
    if (type === "BuffDebuffEvent") {
      activeEffects.push(analyzeActiveEffect(event, eventIndex, unitById));
    }

    if (type === "CombatContactEvent") {
      const combat = analyzeCombat(event, eventIndex, unitById);
      combats.push(combat);
      rollGroups.push(...combat.rollGroups);
    }

    if (type === "RangedSpecialAttackEvent" || type === "RangedUnitAttackEvent") {
      const ranged = analyzeRangedAttack(event, eventIndex, type, unitById);
      rangedAttacks.push(ranged);
      rollGroups.push(...ranged.rollGroups);
    }

    if (type === "UnitBreakTestEvent") {
      const test = analyzeDiscipline(event, eventIndex, unitById);
      disciplineTests.push(test);
      rollGroups.push(test.rollGroup);
    }
  });

  const flattenedRolls = rollGroups.flatMap((group) =>
    group.rolls.map((roll) => ({
      ...roll,
      playerId: group.playerId,
      expectedSuccess: roll.expectedSuccess,
      successVariance: roll.successVariance,
    })),
  );
  for (const player of players) {
    const playerRolls = flattenedRolls.filter((roll) => roll.playerId === player.id);
    player.rolls = playerRolls.length;
    player.successes = playerRolls.filter((roll) => roll.success).length;
    player.expectedSuccesses = sum(playerRolls.map((roll) => roll.expectedSuccess));
    player.successStdDev = Math.sqrt(sum(playerRolls.map((roll) => roll.successVariance)));
    player.successDelta = player.successes - player.expectedSuccesses;
    player.successZ = player.successStdDev ? player.successDelta / player.successStdDev : 0;
    player.successPValue = twoTailedNormalP(player.successZ);
    player.rollTotal = sum(playerRolls.map((roll) => roll.result));
    player.expectedRollTotal = playerRolls.length * 3.5;
    player.rollStdDev = Math.sqrt(playerRolls.length * (35 / 12));
    player.rollDelta = player.rollTotal - player.expectedRollTotal;
    player.rollZ = player.rollStdDev ? player.rollDelta / player.rollStdDev : 0;
    player.rollPValue = twoTailedNormalP(player.rollZ);
    player.averageRoll = playerRolls.length ? player.rollTotal / playerRolls.length : 0;
    player.faceCounts = [1, 2, 3, 4, 5, 6].map(
      (face) => playerRolls.filter((roll) => roll.result === face).length,
    );
    player.faceChiSquare = chiSquareUniformD6(player.faceCounts);
    player.facePValue = chiSquareDf5UpperTail(player.faceChiSquare);
    player.luckLevel = classifyLuck(player.successPValue, player.successZ);
  }

  const favor = comparePlayerLuck(players);
  const rerolls = summarizeRerolls(rollGroups);
  const unlikelyWins = summarizeUnlikelyWins(combats);

  return {
    title,
    players,
    favor,
    units,
    unitById,
    events,
    combats,
    rangedAttacks,
    disciplineTests,
    activeEffects,
    rerolls,
    unlikelyWins,
    rollGroups: rollGroups.sort((a, b) => Math.abs(b.successDelta) - Math.abs(a.successDelta)),
    totalDice: flattenedRolls.length,
  };
}

export function analyzeReplayBatch(replayInputs, title = "Bulk replay analysis") {
  const analyses = replayInputs.map((input) => analyzeReplay(input.text, input.name));
  const playersByName = new Map();

  for (const analysis of analyses) {
    for (const player of analysis.players) {
      const key = normalizePlayerKey(player.name);
      const current = playersByName.get(key) || makeAggregatePlayer(player.name);
      current.games += 1;
      current.rolls += player.rolls;
      current.successes += player.successes;
      current.expectedSuccesses += player.expectedSuccesses;
      current.successVariance += player.successStdDev ** 2;
      current.rollTotal += player.rollTotal;
      current.expectedRollTotal += player.expectedRollTotal;
      current.rollVariance += player.rollStdDev ** 2;
      current.faceCounts = current.faceCounts.map((count, index) => count + player.faceCounts[index]);
      playersByName.set(key, current);
    }
  }

  const players = [...playersByName.values()].map(finalizeAggregatePlayer).sort((a, b) => b.rolls - a.rolls);
  const favor = compareAggregatePlayerLuck(players);
  const totals = {
    games: analyses.length,
    events: sum(analyses.map((analysis) => analysis.events.length)),
    units: sum(analyses.map((analysis) => analysis.units.length)),
    combats: sum(analyses.map((analysis) => analysis.combats.length)),
    rangedAttacks: sum(analyses.map((analysis) => analysis.rangedAttacks.length)),
    totalDice: sum(analyses.map((analysis) => analysis.totalDice)),
    activeEffects: sum(analyses.map((analysis) => analysis.activeEffects.length)),
    flaggedFights: sum(analyses.map((analysis) => analysis.unlikelyWins.totalFlagged)),
  };
  const rerolls = {
    available: sum(analyses.map((analysis) => analysis.rerolls.available)),
    applied: sum(analyses.map((analysis) => analysis.rerolls.applied)),
    byType: mergeRerollTypes(analyses.flatMap((analysis) => analysis.rerolls.byType)),
  };
  const games = analyses.map((analysis) => ({
    title: analysis.title,
    players: analysis.players,
    favor: analysis.favor,
    totalDice: analysis.totalDice,
    combats: analysis.combats.length,
    flaggedFights: analysis.unlikelyWins.totalFlagged,
    events: analysis.events.length,
  }));

  return {
    title,
    mode: "batch",
    analyses,
    players,
    favor,
    totals,
    rerolls,
    games,
  };
}

function makeAggregatePlayer(name) {
  return {
    name,
    games: 0,
    rolls: 0,
    successes: 0,
    expectedSuccesses: 0,
    successVariance: 0,
    rollTotal: 0,
    expectedRollTotal: 0,
    rollVariance: 0,
    faceCounts: [0, 0, 0, 0, 0, 0],
  };
}

function finalizeAggregatePlayer(player) {
  const successStdDev = Math.sqrt(player.successVariance);
  const successDelta = player.successes - player.expectedSuccesses;
  const successZ = successStdDev ? successDelta / successStdDev : 0;
  const rollStdDev = Math.sqrt(player.rollVariance);
  const rollDelta = player.rollTotal - player.expectedRollTotal;
  const rollZ = rollStdDev ? rollDelta / rollStdDev : 0;
  const faceChiSquare = chiSquareUniformD6(player.faceCounts);
  return {
    ...player,
    successStdDev,
    successDelta,
    successZ,
    successPValue: twoTailedNormalP(successZ),
    rollStdDev,
    rollDelta,
    rollZ,
    rollPValue: twoTailedNormalP(rollZ),
    averageRoll: player.rolls ? player.rollTotal / player.rolls : 0,
    faceChiSquare,
    facePValue: chiSquareDf5UpperTail(faceChiSquare),
    luckLevel: classifyLuck(twoTailedNormalP(successZ), successZ),
  };
}

function compareAggregatePlayerLuck(players) {
  if (players.length < 2) return null;
  const [a, b] = [...players].sort((left, right) => Math.abs(right.successDelta) - Math.abs(left.successDelta));
  const diff = a.successDelta - b.successDelta;
  const stdDev = Math.sqrt(a.successStdDev ** 2 + b.successStdDev ** 2);
  const z = stdDev ? diff / stdDev : 0;
  const pValue = twoTailedNormalP(z);
  const favored = diff >= 0 ? a : b;
  return {
    favoredPlayerName: favored.name,
    successDeltaDifference: Math.abs(diff),
    z,
    pValue,
    level: classifyLuck(pValue, z),
  };
}

function mergeRerollTypes(items) {
  const byType = new Map();
  for (const item of items) {
    const current = byType.get(item.type) || { ...item, available: 0, applied: 0 };
    current.available += item.available;
    current.applied += item.applied;
    byType.set(item.type, current);
  }
  return [...byType.values()];
}

function normalizePlayerKey(name) {
  return String(name || "Unknown player").trim().toLowerCase();
}

function makePlayer(id, name) {
  return {
    id,
    name,
    rolls: 0,
    successes: 0,
    expectedSuccesses: 0,
    successDelta: 0,
    rollTotal: 0,
    expectedRollTotal: 0,
    rollDelta: 0,
    averageRoll: 0,
  };
}

function extractUnits(list, player) {
  const sections = [list?.characters, list?.battleLine, ...values(list?.armyListSections)];
  return sections.flatMap((section) =>
    values(section?.entries).map((entry) => ({
      playerId: player.id,
      playerName: player.name,
      localId: null,
      section: section?.sectionName || "Unknown",
      unitType: titleCase(splitIdentifier(entry?.unitID || "unknown unit")),
      sourceId: entry?.unitID || "",
      name: entry?.flavourName || titleCase(splitIdentifier(entry?.unitID || "Unknown unit")),
      count: Number(entry?.count || 0),
      hasCharacter: Boolean(entry?.hasCharacter),
    })),
  );
}

function analyzeActiveEffect(event, eventIndex, unitById) {
  const caster = unitById.get(event.unitID) || unknownUnit(event.unitID);
  const targets = values(event.targets).map((targetId) => unitById.get(targetId) || unknownUnit(targetId));
  return {
    id: `effect-${eventIndex}`,
    eventIndex,
    name: event.spellName || "Unknown effect",
    caster,
    targets,
    targetNames: targets.map((unit) => unit.name),
  };
}

function analyzeCombat(event, eventIndex, unitById) {
  const unitA = unitById.get(event.uID1) || unknownUnit(event.uID1);
  const unitB = unitById.get(event.uID2) || unknownUnit(event.uID2);
  const stepA = analyzeCombatStep(event.stepOne, unitA, unitB, eventIndex, "A");
  const stepB = analyzeCombatStep(event.stepTwo, unitB, unitA, eventIndex, "B");
  const expectedA = stepA.expectedWounds;
  const expectedB = stepB.expectedWounds;
  const actualA = Number(event.stepOne?.woundsCaused || 0);
  const actualB = Number(event.stepTwo?.woundsCaused || 0);
  const winChanceA = compareDistributions(stepA.woundDistribution, stepB.woundDistribution);
  const expectedMarginA = expectedA - expectedB;
  const actualMarginA = actualA - actualB;
  const winner = actualMarginA > 0 ? unitA : actualMarginA < 0 ? unitB : null;
  const winnerPreRollChance = winner ? (winner.globalId === unitA.globalId ? winChanceA : 1 - winChanceA) : 0.5;
  const underdogWon = Boolean(winner && winnerPreRollChance < 0.4);
  const highSwing = Math.abs(actualMarginA - expectedMarginA) >= 2;
  const edgeLabel = `${unitA.name} ${formatPercent(winChanceA)} / ${unitB.name} ${formatPercent(1 - winChanceA)}`;

  return {
    id: `combat-${eventIndex}`,
    unitA,
    unitB,
    expectedA,
    expectedB,
    actualA,
    actualB,
    expectedMarginA,
    actualMarginA,
    swing: actualMarginA - expectedMarginA,
    winner,
    winnerPreRollChance,
    underdogWon,
    highSwing,
    edgeLabel,
    rollGroups: [...stepA.rollGroups, ...stepB.rollGroups],
  };
}

function analyzeCombatStep(step, attacker, defender, eventIndex, side) {
  const toHit = analyzeCombatRoll(step?.toHit, attacker, `${attacker.name} attacks ${defender.name}`, eventIndex, side, "hit");
  const save = analyzeCombatRoll(step?.save, defender, `${defender.name} saves vs ${attacker.name}`, eventIndex, side, "save");
  const attacks = toHit.rolls.length;
  const pHit = toHit.expectedPerRoll;
  const pSave = save.expectedPerRoll;
  const pWound = pHit * (1 - pSave);
  return {
    expectedWounds: attacks * pWound,
    woundDistribution: binomialDistribution(attacks, pWound),
    rollGroups: [toHit, save].filter((group) => group.rolls.length),
  };
}

function analyzeCombatRoll(roll, unit, label, eventIndex, side, phase) {
  const baseProbability = probabilityForD6Target(roll?.target);
  const rolls = values(roll?.rolls).map((item) => normalizeRoll(item, baseProbability, roll?.target));
  const expectedPerRoll = rolls.length ? sum(rolls.map((item) => item.expectedSuccess)) / rolls.length : baseProbability;
  const successes = rolls.filter((item) => item.success).length;
  const expectedSuccesses = sum(rolls.map((item) => item.expectedSuccess));
  return {
    id: `combat-${eventIndex}-${side}-${phase}`,
    label,
    playerId: unit.playerId,
    playerName: unit.playerName,
    unitName: unit.name,
    phase,
    target: roll?.target ?? null,
    targetLabel: roll?.target > 0 ? `${roll.target}+` : "special",
    rolls,
    successes,
    expectedSuccesses,
    expectedPerRoll,
    successDelta: successes - expectedSuccesses,
    rerolls: summarizeRollRerolls(rolls),
    preRollText: stripUnityRichText(roll?.preRollText || ""),
  };
}

function analyzeRangedAttack(event, eventIndex, type, unitById) {
  const attacker = unitById.get(event.unitID) || unknownUnit(event.unitID);
  const targetId = event.target ?? event.targetUnitID;
  const resolvedDefender = unitById.get(targetId) || unknownUnit(targetId);
  const hitGroup = analyzeRollArray({
    id: `ranged-${eventIndex}-hit`,
    label: event.attackText || `${attacker.name} shoots ${resolvedDefender.name}`,
    playerId: attacker.playerId,
    playerName: attacker.playerName,
    unitName: attacker.name,
    phase: type,
    target: event.toHit,
    rolls: values(event.toHitRolls),
  });
  const saveGroup = analyzeRollArray({
    id: `ranged-${eventIndex}-save`,
    label: `${resolvedDefender.name} saves`,
    playerId: resolvedDefender.playerId,
    playerName: resolvedDefender.playerName,
    unitName: resolvedDefender.name,
    phase: "save",
    target: event.toSave,
    rolls: values(event.saveRolls),
  });
  return {
    id: `ranged-${eventIndex}`,
    attacker,
    defender: resolvedDefender,
    wounds: Number(event.wounds || 0),
    rollGroups: [hitGroup, saveGroup].filter((group) => group.rolls.length),
  };
}

function analyzeDiscipline(event, eventIndex, unitById) {
  const unit = unitById.get(event.unitID) || unknownUnit(event.unitID);
  const test = event.test || {};
  const rawRolls = values(test.rolls);
  const crumble = Boolean(test.crumble || rawRolls.some((roll) => roll?.isD3));
  const target = crumble ? null : clamp(Number(test.unitDiscipline || 0) - Number(test.penalty || 0), 0, Number(test.unitDiscipline || 0));
  const probability = crumble ? null : probability2d6AtMost(target);
  const rolls = crumble
    ? []
    : rawRolls.map((roll, index) => ({
        ...normalizeRoll(roll, index === 0 ? probability : 0),
        success: index === 0 ? Boolean(test.success || test.autoSuccess) : false,
        expectedSuccess: index === 0 ? probability : 0,
        successVariance: index === 0 ? probability * (1 - probability) : 0,
      }));
  const displayRolls = rawRolls.map((roll) => normalizeRoll(roll, 0));
  const rollTotal = sum(rolls.map((roll) => roll.result));
  const success = Boolean(test.success || test.autoSuccess);
  const expectedPerRoll = probability;
  const expectedSuccesses = probability;
  const rollGroup = {
    id: `discipline-${eventIndex}`,
    label: `${unit.name} discipline test`,
    playerId: unit.playerId,
    playerName: unit.playerName,
    unitName: unit.name,
    phase: crumble ? "crumble" : "discipline",
    target,
    targetLabel: crumble ? "D3 crumble" : `2D6 <= ${target}`,
    rolls,
    successes: success ? 1 : 0,
    expectedSuccesses: crumble ? 0 : expectedSuccesses,
    expectedPerRoll: crumble ? 0 : expectedPerRoll,
    successDelta: crumble ? 0 : (success ? 1 : 0) - expectedSuccesses,
    rerolls: summarizeRollRerolls(rolls),
  };
  return {
    id: `discipline-${eventIndex}`,
    unit,
    rollTotal: crumble ? sum(displayRolls.map((roll) => roll.result)) : rollTotal,
    displayRolls,
    target,
    probability,
    success,
    crumble,
    unitDiscipline: Number(test.unitDiscipline || 0),
    penalty: Number(test.penalty || 0),
    rankBonusModifier: Number(test.rankBonusModifier || 0),
    rollGroup,
  };
}

function analyzeRollArray({ id, label, playerId, playerName, unitName, phase, target, rolls }) {
  const baseProbability = probabilityForD6Target(target);
  const normalized = rolls.map((roll) => normalizeRoll(roll, baseProbability, target));
  const expectedPerRoll = normalized.length
    ? sum(normalized.map((item) => item.expectedSuccess)) / normalized.length
    : baseProbability;
  const successes = normalized.filter((item) => item.success).length;
  const expectedSuccesses = sum(normalized.map((item) => item.expectedSuccess));
  return {
    id,
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

function normalizeRoll(roll, baseSuccessProbability = 0.5, target = null) {
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

function summarizeRollRerolls(rolls) {
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

function summarizeRerolls(rollGroups) {
  const groups = rollGroups.filter((group) => group.rerolls?.available || group.rerolls?.applied);
  const totals = {
    available: sum(groups.map((group) => group.rerolls.available)),
    applied: sum(groups.map((group) => group.rerolls.applied)),
  };
  const byType = new Map();
  for (const group of groups) {
    for (const item of group.rerolls.byType) {
      const current = byType.get(item.type) || { ...item, available: 0, applied: 0 };
      current.available += item.available;
      current.applied += item.applied;
      byType.set(item.type, current);
    }
  }
  return {
    ...totals,
    byType: [...byType.values()],
    groups,
  };
}

function values(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node;
  if (Array.isArray(node.$values)) return node.$values;
  if (node.$values && typeof node.$values === "object") return Object.values(node.$values);
  return [];
}

function shortType(type) {
  return String(type || "")
    .replace(TYPE_PREFIX, "")
    .replace(", Assembly-CSharp", "");
}

function probabilityForD6Target(target) {
  const numeric = Number(target);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0.5;
  return clamp((7 - numeric) / 6, 0, 1);
}

function comparePlayerLuck(players) {
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

function summarizeUnlikelyWins(combats) {
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

function classifyLuck(pValue, z) {
  const direction = z >= 0 ? "hot" : "cold";
  if (pValue < 0.001) return `Extreme ${direction}`;
  if (pValue < 0.01) return `Very unusual ${direction}`;
  if (pValue < 0.05) return `Unusual ${direction}`;
  return "Within normal noise";
}

function twoTailedNormalP(z) {
  return clamp(2 * (1 - normalCdf(Math.abs(z))), 0, 1);
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * abs);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-abs * abs));
  return sign * y;
}

function chiSquareUniformD6(faceCounts) {
  const total = sum(faceCounts);
  if (!total) return 0;
  const expected = total / 6;
  return sum(faceCounts.map((count) => ((count - expected) ** 2) / expected));
}

function chiSquareDf5UpperTail(x) {
  if (x <= 0) return 1;
  return regularizedGammaQ(2.5, x / 2);
}

function regularizedGammaQ(a, x) {
  if (x < 0 || a <= 0) return Number.NaN;
  if (x === 0) return 1;
  if (x < a + 1) return 1 - regularizedGammaPSeries(a, x);
  return regularizedGammaQContinuedFraction(a, x);
}

function regularizedGammaPSeries(a, x) {
  let sumTerm = 1 / a;
  let sumValue = sumTerm;
  for (let n = 1; n < 100; n += 1) {
    sumTerm *= x / (a + n);
    sumValue += sumTerm;
    if (Math.abs(sumTerm) < Math.abs(sumValue) * 1e-12) break;
  }
  return sumValue * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function regularizedGammaQContinuedFraction(a, x) {
  const epsilon = 1e-12;
  const fpMin = 1e-30;
  let b = x + 1 - a;
  let c = 1 / fpMin;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 100; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpMin) d = fpMin;
    c = b + an / c;
    if (Math.abs(c) < fpMin) c = fpMin;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function logGamma(z) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  let x = 0.9999999999998099;
  const adjusted = z - 1;
  for (let i = 0; i < coefficients.length; i += 1) {
    x += coefficients[i] / (adjusted + i + 1);
  }
  const t = adjusted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (adjusted + 0.5) * Math.log(t) - t + Math.log(x);
}

function probability2d6AtMost(target) {
  let wins = 0;
  for (let a = 1; a <= 6; a += 1) {
    for (let b = 1; b <= 6; b += 1) {
      if (a + b <= target) wins += 1;
    }
  }
  return wins / 36;
}

function binomialDistribution(n, p) {
  const dist = [];
  for (let k = 0; k <= n; k += 1) {
    dist.push(combination(n, k) * p ** k * (1 - p) ** (n - k));
  }
  return dist;
}

function compareDistributions(a, b) {
  let win = 0;
  let tie = 0;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      const chance = a[i] * b[j];
      if (i > j) win += chance;
      if (i === j) tie += chance;
    }
  }
  return win + tie / 2;
}

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}

function unknownUnit(id) {
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

function stripUnityRichText(text) {
  return text.replace(/<[^>]+>/g, "").trim();
}

function splitIdentifier(value) {
  return String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
}

function titleCase(value) {
  return String(value)
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function sum(items) {
  return items.reduce((total, value) => total + (Number(value) || 0), 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}
