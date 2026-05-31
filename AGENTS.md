# SOVL Replay Parser Agent Notes

This project is a React + Vite SPA that parses SOVL replay files in-browser and highlights dice luck, fight swings, rerolls, unit fate, spell/buff impact, and objective-control signals.

## Quick Start

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

If PowerShell cannot execute the local `.cmd` shims in the sandbox, run TypeScript through the bundled Node runtime:

```powershell
& "C:\Users\kjell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\node_modules\typescript\bin\tsc --noEmit
```

## App Structure

- `src/main.tsx` mounts the React app.
- `src/App.tsx` owns sample loading, upload handling, bulk upload handling, and the top-level dashboard layout.
- `src/components/Panel.tsx` contains shared dashboard wrappers.
- `src/components/PlayerLuck.tsx` shows player dice significance and hover explanations.
- `src/components/EffectsAndRerolls.tsx` shows active effects and reroll metadata.
- `src/components/InsightPanels.tsx` contains Unit Fate, Swing Events, and Spell / Buff Impact.
- `src/components/ReplayTables.tsx` contains unit, combat, roll group, unlikely fight, and discipline tables.
- `src/components/format.ts` contains UI formatting helpers.
- `src/styles.css` is still global CSS. Keep new styles grouped near related panel/list sections.

## Parser Structure

- `src/parser/sovlReplay.ts` is the parser orchestration layer. It parses replay JSON, extracts events, creates roll groups, hydrates player luck, and returns the analysis object consumed by the UI.
- `src/parser/probability.ts` contains probability/statistics helpers: D6 targets, 2D6 discipline chance, binomial combat distributions, z/p-value helpers, and chi-square face distribution checks.
- `src/parser/rerolls.ts` normalizes dice rolls, decodes reroll types, adjusts expected success probabilities, and summarizes reroll availability/application.
- `src/parser/summaries.ts` builds higher-level analysis: player luck comparison, unlikely fights, unit fates, swing events, spell/buff impact, objective timeline, and the currently hidden match-result inference.
- `src/parser/utils.ts` contains replay-shape helpers, event type cleanup, unknown units, text cleanup, and small formatting/math helpers.

## Important Domain Assumptions

- Replay unit IDs are treated as global IDs matching extracted army-list order.
- D6 targets are interpreted as `target+`.
- Discipline is interpreted as `2D6 <= unitDiscipline - penalty`, unless the test is detected as crumble.
- Undead-style crumble is detected when the break-test rolls are marked as D3 or the test has a crumble flag. These are shown as model losses, not pass/fail discipline.
- Reroll types currently mean:
  - `1`: reroll failed dice
  - `2`: reroll successful dice
  - `3`: reroll failed natural 1s
  - `4`: reroll successful natural 6s
- Spell/buff impact is heuristic. It links roll groups shortly after an effect to the caster/target names. Duplicate unit names can blur attribution.
- Objective Control was removed because the inferred state-code mapping was not reliable enough.
- Match Result inference was removed from the active analysis flow until the victory rules/data are better understood.

## Verification Checklist

Run these before handing off parser or UI changes:

```bash
npm run typecheck
npm run build
```

Parser sample sweep:

```powershell
& "C:\Users\kjell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --input-type=module -e "import fs from 'node:fs'; import path from 'node:path'; import { createServer } from 'vite'; const server = await createServer({ root: process.cwd(), configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: 'custom' }); try { const { analyzeReplay } = await server.ssrLoadModule('/src/parser/sovlReplay.ts'); for (const file of fs.readdirSync('public/samples').filter(f=>f.endsWith('.SOVL'))) { const a = analyzeReplay(fs.readFileSync(path.join('public/samples', file), 'utf8'), file); console.log(file, 'units', a.units.length, 'swings', a.swingEvents.length, 'spells', a.spellImpact.length, 'dice', a.totalDice); } } finally { await server.close(); }"
```

Expected bundled sample coverage currently includes:

- `260522-2031_Cruz_vs_darkfox.SOVL`
- `260522-2118_Cruz_vs_darkfox.SOVL`
- `260528-0110_ZakMcKracken_vs_ccc.SOVL`
- `260529-2336_Cruz_vs_demin132132.SOVL`

## Refactor Guidance

- Keep `sovlReplay.ts` as orchestration; move independent logic out rather than growing it again.
- Prefer adding new domain summaries to `summaries.ts` only if they combine existing parsed concepts. If they require new event decoding, add the low-level event parsing to `sovlReplay.ts` or a new parser module first.
- Keep UI components focused on rendering existing analysis data. Avoid adding replay parsing logic inside React components.
- Treat p-values and swing flags as review aids, not cheating proof. Preserve that language in UI copy.
