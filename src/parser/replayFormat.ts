import { splitIdentifier, titleCase, values } from "./utils";

const eventTypes = {
  turn: "TurnStartEvent",
  combat_contact: "CombatContactEvent",
  ranged: "RangedUnitAttackEvent",
  break_test: "UnitBreakTestEvent",
  rally_test: "UnitRallyTestEvent",
  spell: "BuffDebuffEvent",
  destroyed: "UnitDestroyedEvent",
  heal: "UnitHealEvent",
};

// Adapt compact v2 events once so legacy summaries keep the same event indices.
export function normalizeReplay(replay) {
  if (!replay || typeof replay !== "object") throw new Error("Invalid replay object.");
  if (replay.formatVersion != null && replay.formatVersion !== 2) {
    throw new Error(`Unsupported replay format version ${replay.formatVersion}.`);
  }
  const header = replay.header ?? replay;
  if (!header.player0List || !header.player1List || !replay.events) {
    throw new Error("Replay is missing army lists or events.");
  }
  return {
    ...replay,
    ...header,
    events: values(replay.events).map((event) => {
      if (!event.t) return event;
      return {
        ...event,
        $type: eventTypes[event.t] ?? event.t,
        ...(event.t === "combat_contact" ? { uID1: event.unitID1, uID2: event.unitID2 } : {}),
        ...(event.t === "spell" ? {
          unitID: event.casterUnitID,
          spellName: titleCase(splitIdentifier(event.effectID || "Unknown effect")),
        } : {}),
        ...(event.t === "heal" ? { healAmount: event.amount } : {}),
      };
    }),
  };
}

export function summarizeRecordedData(replay, players, unitById) {
  const events = values(replay.events);
  const outcome = replay.outcome ?? [...events].reverse().find((event) => event.t === "game_end")?.outcome;
  let turn = 0;
  const objectiveScores = [];
  const healing = [];
  const selfDamage = [];
  const eventCounts = new Map<string, number>();
  for (const [eventIndex, event] of events.entries()) {
    if (event.t === "turn") turn = event.turn;
    if (event.t) eventCounts.set(event.t, (eventCounts.get(event.t) ?? 0) + 1);
    if (event.t === "objectives_scored") {
      objectiveScores.push({ eventIndex, turn, playerId: event.player, playerName: players[event.player]?.name ?? "Unknown player", points: event.points });
    }
    if (event.t === "heal" || event.t === "self_damage") {
      const item = { eventIndex, turn, unit: unitById.get(event.unitID), amount: event.amount ?? event.wounds, onCharacter: Boolean(event.onCharacter), restoreModels: Boolean(event.restoreModels), rolls: values(event.rolls) };
      (event.t === "heal" ? healing : selfDamage).push(item);
    }
  }
  const concededPlayer = events.find((event) => event.t === "concede")?.player;
  return {
    formatVersion: replay.formatVersion ?? null,
    gameVersion: replay.gameVersion ?? null,
    balanceVersion: replay.balanceVersion ?? null,
    recordedUtc: replay.recordedUtc ?? null,
    mapId: replay.mapID ?? null,
    scenarioCode: replay.scenario ?? null,
    startingPositions: values(replay.startingPositions),
    outcome: outcome ? {
      ...outcome,
      winnerName: players[outcome.winnerPlayerID]?.name ?? null,
      concededPlayerName: players[concededPlayer]?.name ?? null,
    } : null,
    objectiveScores,
    healing,
    selfDamage,
    eventCounts: [...eventCounts].map(([type, count]) => ({ type, count })),
  };
}
