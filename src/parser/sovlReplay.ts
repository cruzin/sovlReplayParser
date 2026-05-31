import {
  binomialDistribution,
  chiSquareDf5UpperTail,
  chiSquareUniformD6,
  classifyLuck,
  compareDistributions,
  probability2d6AtMost,
  probabilityForD6Target,
  twoTailedNormalP,
} from "./probability";
import { analyzeRollArray, mergeRerollTypes, normalizeRoll, summarizeRerolls, summarizeRollRerolls } from "./rerolls";
import {
  comparePlayerLuck,
  summarizeSpellImpact,
  summarizeSwingEvents,
  summarizeUnlikelyWins,
  summarizeUnitFates,
} from "./summaries";
import { clamp, formatPercent, shortType, splitIdentifier, stripUnityRichText, sum, titleCase, unknownUnit, values } from "./utils";

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
  hydratePlayerLuck(players, flattenedRolls);
  const halfwayEventIndex = Math.floor(events.length / 2);
  const firstHalfLuck = analyzeSegmentLuck(players, rollGroups, 0, halfwayEventIndex, "First half");
  const latterHalfLuck = analyzeSegmentLuck(players, rollGroups, halfwayEventIndex, events.length, "Latter half");

  const favor = comparePlayerLuck(players);
  const rerolls = summarizeRerolls(rollGroups);
  const unlikelyWins = summarizeUnlikelyWins(combats);
  const unitFates = summarizeUnitFates(units, events, combats, rangedAttacks, disciplineTests);
  const swingEvents = summarizeSwingEvents(combats, disciplineTests, rollGroups);
  const spellImpact = summarizeSpellImpact(activeEffects, rollGroups);

  return {
    title,
    players,
    favor,
    firstHalfLuck,
    latterHalfLuck,
    units,
    unitById,
    events,
    combats,
    rangedAttacks,
    disciplineTests,
    activeEffects,
    rerolls,
    unlikelyWins,
    unitFates,
    swingEvents,
    spellImpact,
    rollGroups: rollGroups.sort((a, b) => Math.abs(b.successDelta) - Math.abs(a.successDelta)),
    totalDice: flattenedRolls.length,
  };
}

export function analyzeReplayBatch(replayInputs, title = "Bulk replay analysis") {
  const analyses = replayInputs.map((input) => analyzeReplay(input.text, input.name));
  const playersByName = new Map();
  const firstHalfPlayersByName = new Map();
  const latterHalfPlayersByName = new Map();

  for (const analysis of analyses) {
    for (const player of analysis.players) {
      const key = normalizePlayerKey(player.name);
      const current = playersByName.get(key) || makeAggregatePlayer(player.name);
      addPlayerToAggregate(current, player);
      playersByName.set(key, current);
    }

    for (const player of analysis.firstHalfLuck.players) {
      const key = normalizePlayerKey(player.name);
      const current = firstHalfPlayersByName.get(key) || makeAggregatePlayer(player.name);
      addPlayerToAggregate(current, player);
      firstHalfPlayersByName.set(key, current);
    }

    for (const player of analysis.latterHalfLuck.players) {
      const key = normalizePlayerKey(player.name);
      const current = latterHalfPlayersByName.get(key) || makeAggregatePlayer(player.name);
      addPlayerToAggregate(current, player);
      latterHalfPlayersByName.set(key, current);
    }
  }

  const players = [...playersByName.values()].map(finalizeAggregatePlayer).sort((a, b) => b.rolls - a.rolls);
  const favor = compareAggregatePlayerLuck(players);
  const firstHalfPlayers = [...firstHalfPlayersByName.values()]
    .map(finalizeAggregatePlayer)
    .sort((a, b) => b.rolls - a.rolls);
  const firstHalfLuck = {
    label: "First half",
    totalDice: sum(firstHalfPlayers.map((player) => player.rolls)),
    games: analyses.length,
    players: firstHalfPlayers,
    favor: compareAggregatePlayerLuck(firstHalfPlayers),
  };
  const latterHalfPlayers = [...latterHalfPlayersByName.values()]
    .map(finalizeAggregatePlayer)
    .sort((a, b) => b.rolls - a.rolls);
  const latterHalfLuck = {
    label: "Latter half",
    totalDice: sum(latterHalfPlayers.map((player) => player.rolls)),
    games: analyses.length,
    players: latterHalfPlayers,
    favor: compareAggregatePlayerLuck(latterHalfPlayers),
  };
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
    firstHalfLuck,
    latterHalfLuck,
    totals,
    rerolls,
    games,
  };
}

function addPlayerToAggregate(current, player) {
  current.games += 1;
  current.rolls += player.rolls;
  current.successes += player.successes;
  current.expectedSuccesses += player.expectedSuccesses;
  current.successVariance += player.successStdDev ** 2;
  current.rollTotal += player.rollTotal;
  current.expectedRollTotal += player.expectedRollTotal;
  current.rollVariance += player.rollStdDev ** 2;
  current.faceCounts = current.faceCounts.map((count, index) => count + player.faceCounts[index]);
}

function hydratePlayerLuck(players, flattenedRolls) {
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
    player.faceCounts = [1, 2, 3, 4, 5, 6].map((face) => playerRolls.filter((roll) => roll.result === face).length);
    player.faceChiSquare = chiSquareUniformD6(player.faceCounts);
    player.facePValue = chiSquareDf5UpperTail(player.faceChiSquare);
    player.luckLevel = classifyLuck(player.successPValue, player.successZ);
  }
}

function analyzeSegmentLuck(sourcePlayers, rollGroups, startEventIndex, endEventIndex, label) {
  const players = sourcePlayers.map((player) => makePlayer(player.id, player.name));
  const segmentGroups = rollGroups.filter(
    (group) => group.eventIndex >= startEventIndex && group.eventIndex < endEventIndex,
  );
  const rolls = segmentGroups.flatMap((group) =>
    group.rolls.map((roll) => ({
      ...roll,
      playerId: group.playerId,
      expectedSuccess: roll.expectedSuccess,
      successVariance: roll.successVariance,
    })),
  );
  hydratePlayerLuck(players, rolls);
  return {
    label,
    startEventIndex,
    endEventIndex,
    rollGroups: segmentGroups.length,
    totalDice: rolls.length,
    players,
    favor: comparePlayerLuck(players),
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
    eventIndex,
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
    eventIndex,
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
