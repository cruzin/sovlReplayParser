# SOVL Replay Analyzer

React + Vite SPA for parsing SOVL replay JSON files and estimating where the dice swung.

Google sign-in grants access to the parser and hosted match statistics. The
browser sends compact summaries; original replay files remain local.

## Maintainer documentation

- [Statistics architecture and counting decisions](docs/statistics-architecture.md):
  payload, fingerprints, uploader inference, player slots, cache, and opponents-only rules.
- [Backend operational runbook](docs/statistics-backend.md): deployment,
  verification, and database troubleshooting queries.
- [Database inspection and backfills](docs/statistics-operations.md): coverage,
  uploader corrections, permissions, and release checks.
- [Supabase migration order and prerequisites](supabase/README.md).
- [Google OAuth setup](docs/authentication.md).
- [Replay format and compatibility findings](docs/replay-format-v2.md).
- [Agent instructions](AGENTS.md).

## Current first-pass features

- Bundles five current sample replays under `public/samples`; older files are in `tests/fixtures/legacy`.
- Lets users upload their own `.SOVL` replay in the browser.
- Extracts players, army units, combat contacts, ranged attacks, break tests, and D6 rolls.
- Estimates expected successes from replay target numbers.
- Estimates combat pre-roll edge from a simple binomial wound model.
- Shows per-player success delta, raw roll delta, D6 face distribution, z-scores, and p-values.
- Extracts named buff/spell events such as Doom Bell and Primal Fury.
- Shows reroll-enabled dice, actually rerolled dice, reroll examples, and reroll type summaries.

## Parser assumptions

This first pass is intentionally pragmatic:

- Unit numeric IDs are treated as deployment order: player 0 units followed by player 1 units.
- D6 target probabilities are inferred as `target+` on a D6.
- Reroll type `1` is treated as a beneficial failed-dice reroll.
- Reroll type `2` is treated as a forced successful-dice reroll.
- Reroll type `3` is treated as a beneficial reroll for failed natural 1s.
- Reroll type `4` is treated as a forced reroll for successful natural 6s.
- Discipline tests are treated as `2D6 <= discipline - penalty`, with D3 crumble kept separate.
- Combat win edge uses expected unsaved wounds from hit and save targets, not the full SOVL rulebook.

Those assumptions are good enough to compare luck in the supplied replays, but the parser is structured so rule-specific improvements can be added later.

## Reading significance

The app now reports z-scores and p-values for player luck. A low p-value means the result would be rare if the inferred target numbers and fair dice assumptions are correct. This is useful evidence for reviewing a replay, but it is not a standalone proof of cheating. Small samples, missing rule modifiers, replay bugs, or parser assumptions can all produce misleading outliers.

## Development

```bash
npm install
npm run dev
```

## GitHub Pages

The Vite base is set to `./`, so the built app can be served from a repository subpath.

```bash
npm run build
```
