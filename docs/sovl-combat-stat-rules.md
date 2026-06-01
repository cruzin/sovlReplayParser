# SOVL Combat Stat Rules

Source: <https://perwahl.github.io/SOVLRules/docs/GameLoop/CombatPhase.html>

This note summarizes how SOVL uses Skill, Power, and Defense during melee combat, with parser-relevant formulas.

## Combat Flow

Each melee engagement is resolved as a group of units in base contact. The rough order is:

1. Engaged units make attack rolls.
2. Defenders roll damage saves for successful attacks.
3. Casualties are removed and combat score is calculated.
4. The losing side takes break tests.

Attacks are simultaneous within the engagement.

## Attack Rolls: Skill vs Skill

Attack rolls compare the attacker's Skill against the defender's Skill.

| Attacker Skill vs Defender Skill | Attack succeeds on |
| --- | --- |
| Attacker Skill is higher | `3+` |
| Attacker Skill is equal or lower | `4+` |

Parser formula:

```ts
function attackTarget(attackerSkill: number, defenderSkill: number) {
  return attackerSkill > defenderSkill ? 3 : 4;
}
```

The replay combat roll text often stores this as display text, for example:

```text
Skill 3 VS Skill 4
```

The same roll object also stores the already-resolved `target`, so the parser can both trust the replay target and extract the stat comparison for explanation.

## Damage Saves: Power vs Defense

Damage saves compare the attacker's Power against the defender's Defense. This is a defender save roll, so a lower target is better for the defender.

| Attacker Power vs Defender Defense | Damage save succeeds on |
| --- | --- |
| Power is higher by more than 2 | `6+` |
| Power is higher by 1 or 2 | `5+` |
| Power equals Defense | `4+` |
| Power is lower by 1 or 2 | `3+` |
| Power is lower by more than 2 | `2+` |

Parser formula:

```ts
function damageSaveTarget(power: number, defense: number) {
  const diff = power - defense;
  if (diff > 2) return 6;
  if (diff > 0) return 5;
  if (diff === 0) return 4;
  if (diff < -2) return 2;
  return 3;
}
```

Replay combat roll text often stores this as display text, for example:

```text
Power 6 VS Defense 7
```

As with Skill, the replay also stores the resolved `target` on the roll object.

## Combat Score

After attacks and saves are resolved, each side's combat score is calculated from:

- wounds caused
- flank bonuses
- rear bonuses

The side with the highest combat score wins the combat. Units on the losing side take discipline tests.

## Break Tests

The losing side rolls discipline tests. A successful test is at or below:

```text
unit discipline + rank bonus - combat score difference
```

The current parser already treats discipline as a `2D6 <= target` roll for non-crumble tests.

## Parser Notes

- Unit list entries do not appear to expose a clean full stat block for Skill, Power, and Defense.
- Combat event roll objects do expose the resolved target number.
- Combat event roll objects also include rich-text `preRollText` containing the compared stats.
- Useful extracted examples:
  - `Skill 3 VS Skill 4`, target `4+`
  - `Skill 4 VS Skill 3`, target `3+`
  - `Power 6 VS Defense 7`, target `3+`
- These text fields can be parsed to explain why a target number was used, but the numeric `target` in the replay should remain the source of truth for probability calculations.

