import { splitIdentifier, values } from "./utils";

type FactionSummary = {
  id: string;
  name: string;
  initials: string;
  iconUrl: string | null;
};

const factionById = new Map(
  [
    ["AbyssalDemons", "Abyssal Demons"],
    ["AbyssalLegions", "Abyssal Legions"],
    ["DarkbornElves", "Darkborn Elves"],
    ["DeadNations", "Dead Nations"],
    ["DeepwoodGuardians", "Deepwood Guardians"],
    ["DwarfHolds", "Dwarf Holds"],
    ["ElvenConclaves", "Elven Conclaves"],
    ["EmpiresOfMen", "Empires of Men"],
    ["GoatmenRaiders", "Goatmen Raiders"],
    ["GreenskinTribes", "Greenskin Tribes"],
    ["KnightsOfAvalon", "Knights of Avalon"],
    ["RatkinClans", "Ratkin Clans"],
    ["ReptilianKingdoms", "Reptilian Kingdoms"],
  ].map(([id, name]) => [id, toFactionSummary(id, name)]),
);

const factionTypeFallback = new Map([
  [1, "EmpiresOfMen"],
  [5, "DeadNations"],
  [9, "RatkinClans"],
  [10, "DeepwoodGuardians"],
  [13, "KnightsOfAvalon"],
]);

const unitIdHints = [
  { factionId: "RatkinClans", patterns: [/^ratkin/i, /^doomBell$/i] },
  { factionId: "DeepwoodGuardians", patterns: [/^deepwood/i, /^dryads?$/i, /^treant/i] },
  { factionId: "EmpiresOfMen", patterns: [/^imperial/i, /^footKnights$/i, /^gryphon$/i] },
  { factionId: "KnightsOfAvalon", patterns: [/^unicorn$/i, /^hippogryph$/i, /^peasants?$/i] },
  { factionId: "DeadNations", patterns: [/^skeleton/i, /^dreadKnights$/i, /^zombie/i, /^wight/i, /^vampire/i] },
  { factionId: "DarkbornElves", patterns: [/^darkborn/i, /^darkPegasus$/i] },
  { factionId: "DwarfHolds", patterns: [/^dwarf/i, /^dwarven/i, /^rune/i, /^slayer/i] },
  { factionId: "ElvenConclaves", patterns: [/^elven/i, /^highborn/i, /^phoenix/i, /^silver/i] },
  { factionId: "GoatmenRaiders", patterns: [/^goat/i, /^minotaur/i, /^centaur/i, /^beast/i] },
  { factionId: "GreenskinTribes", patterns: [/^orc/i, /^goblin/i, /^troll/i, /^wyvern/i] },
  { factionId: "ReptilianKingdoms", patterns: [/^reptilian/i, /^saur/i, /^skink/i, /^krox/i, /^steg/i] },
  { factionId: "AbyssalDemons", patterns: [/^demon/i, /^demonic/i, /^hell/i] },
  { factionId: "AbyssalLegions", patterns: [/^abyssal/i, /^chosen/i, /^chaos/i] },
];

export function inferFactionFromList(list): FactionSummary {
  const counts = new Map<string, number>();
  for (const unitId of extractListUnitIds(list)) {
    const factionId = inferFactionIdFromUnitId(unitId);
    if (!factionId) continue;
    counts.set(factionId, (counts.get(factionId) ?? 0) + 1);
  }

  const inferredId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (inferredId) return factionById.get(inferredId) ?? unknownFaction();

  const fallbackId = factionTypeFallback.get(Number(list?.factionType));
  if (fallbackId) return factionById.get(fallbackId) ?? unknownFaction();

  return unknownFaction();
}

function inferFactionIdFromUnitId(unitId) {
  return unitIdHints.find((hint) => hint.patterns.some((pattern) => pattern.test(String(unitId || ""))))?.factionId ?? null;
}

function extractListUnitIds(list) {
  const sections = [list?.characters, list?.battleLine, ...values(list?.armyListSections)];
  return sections.flatMap((section) =>
    values(section?.entries).flatMap((entry) => [entry?.unitID, entry?.character?.unitID].filter(Boolean)),
  );
}

function unknownFaction() {
  return toFactionSummary("unknown", "Unknown Faction");
}

function toFactionSummary(id, name) {
  return {
    id,
    name,
    initials: initialsForName(name),
    iconUrl: null,
  };
}

function initialsForName(name) {
  return splitIdentifier(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}
