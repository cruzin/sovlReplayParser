import { splitIdentifier } from "./utils";

type FactionSummary = {
  id: string;
  name: string;
  initials: string;
  iconUrl: string | null;
};

// From cruzin/sovlTools, page branch, assets/factions.json.
const factionIcons = {
  AbyssalDemons: "AbyssalDemonPlaceHolder.png",
  AbyssalLegions: "AbyssalChampion.png",
  DarkbornElves: "DarkbornPriestess.png",
  DeadNations: "VampireKnight.png",
  DeepwoodGuardians: "TreantElder.png",
  DwarfHolds: "DwarfForeman.png",
  ElvenConclaves: "ConclaveElfNoble.png",
  EmpiresOfMen: "ImperialCaptain.png",
  GoatmenRaiders: "MinotaurLord.png",
  GreenskinTribes: "GoblinShaman.png",
  KnightsOfAvalon: "Maiden.png",
  RatkinClans: "RatkinWarlock.png",
  ReptilianKingdoms: "NewtPriest.png",
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

const factionTypeByCode = new Map([
  [1, "EmpiresOfMen"],
  [2, "GreenskinTribes"],
  [3, "DwarfHolds"],
  [4, "ElvenConclaves"],
  [5, "DeadNations"],
  [6, "GoatmenRaiders"],
  [7, "AbyssalLegions"],
  [8, "ReptilianKingdoms"],
  [9, "RatkinClans"],
  [10, "DeepwoodGuardians"],
  [11, "DarkbornElves"],
  [12, "AbyssalDemons"],
  [13, "KnightsOfAvalon"],
]);

export function factionFromList(list): FactionSummary {
  const recordedId = factionTypeByCode.get(Number(list?.factionType));
  return recordedId ? factionById.get(recordedId) ?? unknownFaction() : unknownFaction();
}

function unknownFaction() {
  return toFactionSummary("unknown", "Unknown Faction");
}

function toFactionSummary(id, name) {
  return {
    id,
    name,
    initials: initialsForName(name),
    iconUrl: factionIcons[id] ? `${import.meta.env.BASE_URL}faction-icons/${factionIcons[id]}` : null,
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
