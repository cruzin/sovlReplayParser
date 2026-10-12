# Replay format v2 findings

Inspected all five supplied October 5, 2026 replays (formatVersion 2,
game versions 1.33.0-ci.48 and 1.33.1-ci.51).

## Supported changes

- Player names and army lists moved into `header`.
- Events use compact `t` tags instead of Unity `$type` strings.
- Combat contact IDs are `unitID1` / `unitID2`. These match army-list order;
  nested roll `unitID` values use a different ID space and must not replace them.
  Nested `rollerID` agrees with contact-based player ownership in these samples.
- `hasSecondStep` explicitly says whether the defender strikes back.
- Spells record `casterUnitID`, `casterIsCharacter`, `effectID`, and targets.
  Effect IDs are displayed as names; unrecognized rules retain heuristic impact copy.
- Healing uses `amount`; self damage uses `wounds`. Contextual D3 rolls remain
  excluded from dice luck. Rally tests now appear alongside discipline tests,
  but do not count as failed break tests in Unit Fate.
- Legacy replays remain supported and are retained in `tests/fixtures/legacy`.

## Newly exposed recorded data

The Recorded Match Data panel shows the explicit outcome (winner, scores, final
turn), concessions, objective scoring by player and turn, healing and self-damage
totals, deployment-position count, format/game/balance versions, UTC recording
timestamp, map ID, and scenario code. None of the outcome is inferred.

## Other available data and limits

- Starting positions include coordinates and quaternion rotations; movements
  include paths, final rotations, and numeric movement-kind codes. A future
  deployment/movement view can use these coordinates.
- Engagement boundaries identify participating units and characters. Contact
  steps include attacking-model indices, facings, charge bonus, and first-round
  flags. `combat_result` gives the engagement winner and score, which is distinct
  from the dashboard's contact-level wound comparison.
- `ability_used` records ranged weapons as well as spells. It is retained in
  the event list but not counted as another spell effect (avoids duplicate casts).
- `objective_state`, phase, destruction reason, scenario, and outcome reason use
  numeric codes. Their labels are not established by these files. Objective
  points are explicit, but objective ownership remains uninterpreted.
- Healing distinguishes restoring models from healing wounds and character
  targets. Unit Fate's remaining-model number remains an estimate; wounds are
  not universally equivalent to model losses.

Run `node scripts/test-replay-format.mjs` for new/legacy sample coverage,
roll ownership, D6 coverage, outcomes, and bulk aggregation checks.
