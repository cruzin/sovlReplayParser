const SPELL_EFFECTS = [
  {
    key: "blood-frenzy",
    names: ["blood frenzy"],
    text: "Target unit loses D3 wounds and gets +1 Attack this turn. This is extra attacks, not the Frenzy reroll rule.",
    tags: ["+1 Attack", "extra attacks", "D3 self-wounds"],
    windowEvents: 80,
    affects(effect, group) {
      return isTarget(effect, group.unitName) && group.phase === "hit"
        ? "target unit made attack rolls after Blood Frenzy +1 Attack"
        : "";
    },
    estimate(effect) {
      const frontRows = effect.targets
        .map((unit) => ({
          unitName: unit.name,
          frontRowModels: Math.min(Number(unit.width || 0), Number(unit.count || 0)) || null,
          width: Number(unit.width || 0) || null,
          count: Number(unit.count || 0) || null,
        }))
        .filter((item) => item.frontRowModels);
      return {
        summary: frontRows.length
          ? `Estimated extra attacks from +1 Attack: ${frontRows
              .map((item) => `${item.unitName} +${item.frontRowModels}`)
              .join(", ")}`
          : "Could not estimate front row width from target unit data.",
        frontRows,
      };
    },
  },
  {
    key: "hex-of-ruin",
    names: ["hex of ruin"],
    text: "Target unit has -2 Defense for one turn.",
    tags: ["-2 Defense"],
    windowEvents: 80,
    affects(effect, group) {
      return isTarget(effect, group.unitName) && group.phase === "save"
        ? "target unit made damage saves while affected by -2 Defense"
        : "";
    },
  },
  {
    key: "primal-fury",
    names: ["primal fury"],
    text: "Target unit has +1 Power and rerolls missed Attack Rolls for one turn.",
    tags: ["+1 Power", "reroll missed attacks"],
    windowEvents: 80,
    affects(effect, group) {
      if (isTarget(effect, group.unitName) && group.phase === "hit") {
        return "target unit made attack rolls with reroll-missed-attacks buff";
      }
      if (isTarget(effect, group.opposingUnitName) && group.phase === "save") {
        return "enemy rolled damage saves against the target unit's +1 Power attacks";
      }
      return "";
    },
  },
  {
    key: "doom-bell",
    names: ["doom bell"],
    text: "All your units have Frenzy (reroll failed Attack Rolls) this turn. Activate once per battle.",
    tags: ["army-wide Frenzy", "reroll failed attacks"],
    windowEvents: 80,
    affects(effect, group) {
      return group.playerId === effect.caster.playerId && group.phase === "hit"
        ? "friendly unit made attack rolls during Doom Bell Frenzy rerolls"
        : "";
    },
  },
  {
    key: "divine-favour",
    names: ["divine favour", "divine favor"],
    text: "Target unit gets +1 Skill and rerolls failed Discipline tests for one turn.",
    tags: ["+1 Skill", "reroll failed discipline"],
    windowEvents: 80,
    affects(effect, group) {
      if (isTarget(effect, group.unitName) && group.phase === "hit") {
        return "target unit made attack rolls with +1 Skill";
      }
      if (isTarget(effect, group.unitName) && group.phase === "discipline") {
        return "target unit made a discipline test with reroll support";
      }
      return "";
    },
  },
];

const IGNORED_EFFECT_NAMES = new Set(["reposition", "full steam", "unholy vigour"]);

export function getSpellEffect(name) {
  const normalized = normalizeSpellName(name);
  return SPELL_EFFECTS.find((effect) => effect.names.includes(normalized)) ?? {
    key: normalized || "unknown-effect",
    names: [normalized],
    text: "No rule definition mapped yet.",
    tags: ["heuristic"],
    windowEvents: null,
    estimate: null,
    affects(effect, group) {
      return isTarget(effect, group.unitName) || group.unitName === effect.caster.name
        ? "unit was involved shortly after this effect"
        : "";
    },
  };
}

export function shouldIgnoreSpellImpact(name) {
  return IGNORED_EFFECT_NAMES.has(normalizeSpellName(name));
}

export function isKnownSpellEffect(name) {
  const normalized = normalizeSpellName(name);
  return SPELL_EFFECTS.some((effect) => effect.names.includes(normalized));
}

function isTarget(effect, unitName) {
  return effect.targetNames.some((targetName) => normalizeUnitName(targetName) === normalizeUnitName(unitName));
}

function normalizeSpellName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeUnitName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}
