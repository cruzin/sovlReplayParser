import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  ChevronsUpDown,
  Crosshair,
  Dice5,
  Files,
  FileUp,
  Swords,
  Trophy,
  Users,
  WandSparkles,
} from "lucide-react";
import { analyzeReplay, analyzeReplayBatch } from "./parser/sovlReplay.js";
import "./styles.css";

const sampleManifestUrl = `${import.meta.env.BASE_URL}samples/manifest.json`;

function App() {
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isBatch = analysis?.mode === "batch";

  useEffect(() => {
    fetch(sampleManifestUrl)
      .then((response) => response.json())
      .then((items) => {
        setSamples(items);
        if (items[0]) loadSample(items[0]);
      })
      .catch(() => setError("Could not load the bundled replay manifest."));
  }, []);

  async function loadSample(sample) {
    setLoading(true);
    setError("");
    setSelectedSample(sample.file);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}samples/${sample.file}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      setAnalysis(analyzeReplay(text, sample.name));
    } catch (err) {
      setError(`Could not parse ${sample.name}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setSelectedSample("");
    try {
      const text = await file.text();
      setAnalysis(analyzeReplay(text, file.name));
    } catch (err) {
      setError(`Could not parse uploaded replay: ${err.message}`);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function onBulkUpload(event) {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setLoading(true);
    setError("");
    setSelectedSample("");
    try {
      const replayInputs = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          text: await file.text(),
        })),
      );
      setAnalysis(analyzeReplayBatch(replayInputs, `${files.length} replay bulk analysis`));
    } catch (err) {
      setError(`Could not parse bulk replay upload: ${err.message}`);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">SOVL Replay Analyzer</p>
          <h1>{analysis?.title ?? "Load a replay"}</h1>
          {analysis && !isBatch && (
            <p className="subtitle">
              {analysis.players[0]?.name ?? "Player 0"} vs {analysis.players[1]?.name ?? "Player 1"} -{" "}
              {analysis.events.length} events parsed
            </p>
          )}
          {isBatch && (
            <p className="subtitle">
              {analysis.totals.games} games - {analysis.players.length} players - {analysis.totals.totalDice} dice
              aggregated
            </p>
          )}
        </div>
        <div className="controls">
          <label className="select-wrap" title="Choose bundled replay">
            <ChevronsUpDown size={16} />
            <select
              value={selectedSample}
              onChange={(event) => {
                const sample = samples.find((item) => item.file === event.target.value);
                if (sample) loadSample(sample);
              }}
            >
              {samples.map((sample) => (
                <option key={sample.file} value={sample.file}>
                  {sample.name}
                </option>
              ))}
            </select>
          </label>
          <label className="upload-button" title="Upload SOVL replay">
            <FileUp size={17} />
            <span>Upload</span>
            <input type="file" accept=".SOVL,.sovl,.json,application/json" onChange={onUpload} />
          </label>
          <label className="upload-button" title="Upload several SOVL replays">
            <Files size={17} />
            <span>Bulk</span>
            <input type="file" accept=".SOVL,.sovl,.json,application/json" multiple onChange={onBulkUpload} />
          </label>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Parsing replay data...</div>}

      {analysis && !loading && isBatch && <BulkAnalysis analysis={analysis} />}

      {analysis && !loading && !isBatch && (
        <>
          <section className="metric-grid">
            <Metric icon={<Users />} label="Units" value={analysis.units.length} />
            <Metric icon={<Swords />} label="Combats" value={analysis.combats.length} />
            <Metric icon={<Crosshair />} label="Ranged attacks" value={analysis.rangedAttacks.length} />
            <Metric icon={<Dice5 />} label="Tracked dice" value={analysis.totalDice} />
            <Metric icon={<WandSparkles />} label="Active effects" value={analysis.activeEffects.length} />
            <Metric
              icon={<Trophy />}
              label="Unlikely fights"
              value={analysis.unlikelyWins.totalFlagged}
            />
          </section>

          <section className="two-column">
            <Panel title="Player Luck" icon={<BarChart3 />}>
              <PlayerLuck players={analysis.players} favor={analysis.favor} />
            </Panel>
            <Panel title="Effects And Rerolls" icon={<WandSparkles />}>
              <EffectsAndRerolls effects={analysis.activeEffects} rerolls={analysis.rerolls} />
            </Panel>
          </section>

          <section className="panel">
            <PanelHeading icon={<Users />} title="Units In Battle" />
            <UnitRoster units={analysis.units} />
          </section>

          <section className="panel">
            <PanelHeading icon={<Swords />} title="Unit Fights" />
            <UnlikelyWinsSummary summary={analysis.unlikelyWins} />
            <CombatTable combats={analysis.combats} />
          </section>

          <section className="two-column">
            <Panel title="Roll Groups" icon={<Dice5 />}>
              <RollGroups groups={analysis.rollGroups} />
            </Panel>
            <Panel title="Discipline Rolls" icon={<Activity />}>
              <DisciplineTable tests={analysis.disciplineTests} />
            </Panel>
          </section>
        </>
      )}
    </main>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <div className="metric-value">{value}</div>
        <div className="metric-label">{label}</div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="panel">
      <PanelHeading icon={icon} title={title} />
      {children}
    </section>
  );
}

function PanelHeading({ icon, title }) {
  return (
    <div className="panel-heading">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function BulkAnalysis({ analysis }) {
  return (
    <>
      <section className="metric-grid">
        <Metric icon={<Files />} label="Games" value={analysis.totals.games} />
        <Metric icon={<Users />} label="Players" value={analysis.players.length} />
        <Metric icon={<Swords />} label="Combats" value={analysis.totals.combats} />
        <Metric icon={<Crosshair />} label="Ranged attacks" value={analysis.totals.rangedAttacks} />
        <Metric icon={<Dice5 />} label="Tracked dice" value={analysis.totals.totalDice} />
        <Metric icon={<Trophy />} label="Unlikely fights" value={analysis.totals.flaggedFights} />
      </section>

      <section className="two-column">
        <Panel title="Aggregate Player Luck" icon={<BarChart3 />}>
          <PlayerLuck players={analysis.players} favor={analysis.favor} />
        </Panel>
        <Panel title="Bulk Rerolls" icon={<WandSparkles />}>
          <BulkRerolls rerolls={analysis.rerolls} totals={analysis.totals} />
        </Panel>
      </section>

      <section className="panel">
        <PanelHeading icon={<Files />} title="Games In Batch" />
        <BulkGameTable games={analysis.games} />
      </section>
    </>
  );
}

function BulkRerolls({ rerolls, totals }) {
  return (
    <div className="effect-stack">
      <div className="reroll-summary">
        <div>
          <span>Reroll-enabled dice</span>
          <strong>{rerolls.available}</strong>
        </div>
        <div>
          <span>Actually rerolled</span>
          <strong>{rerolls.applied}</strong>
        </div>
      </div>
      <div className="reroll-types">
        {rerolls.byType.length ? (
          rerolls.byType.map((item) => (
            <span className="chip" key={item.type}>
              {item.label}: {item.applied}/{item.available}
            </span>
          ))
        ) : (
          <p className="empty">No reroll metadata found across the uploaded games.</p>
        )}
      </div>
      <div className="bulk-note">
        <strong>{totals.activeEffects}</strong>
        <span> active effects and buffs parsed across the full batch.</span>
      </div>
    </div>
  );
}

function BulkGameTable({ games }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Replay</th>
            <th>Players</th>
            <th>Favored</th>
            <th>Dice</th>
            <th>Combats</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.title}>
              <td>
                <strong>{game.title}</strong>
                <span>{game.events} events</span>
              </td>
              <td>{game.players.map((player) => player.name).join(" vs ")}</td>
              <td>
                {game.favor ? (
                  <>
                    <strong>{game.favor.favoredPlayerName}</strong>
                    <span>
                      z {formatNumber(game.favor.z, 2)} - p {formatPValue(game.favor.pValue)}
                    </span>
                  </>
                ) : (
                  "n/a"
                )}
              </td>
              <td>{game.totalDice}</td>
              <td>{game.combats}</td>
              <td>{game.flaggedFights}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerLuck({ players, favor }) {
  return (
    <>
      {favor && (
        <div className="significance-banner">
          <span>Favored by success rolls</span>
          <strong>{favor.favoredPlayerName}</strong>
          <p>
            Difference {formatNumber(favor.successDeltaDifference, 1)} successes over expectation - z{" "}
            {formatNumber(favor.z, 2)} - p {formatPValue(favor.pValue)} - {favor.level}
          </p>
        </div>
      )}
      <p className="method-note">
        Expected successes now include replay-marked reroll modifiers. These fields flag outliers; they are evidence
        for review, not proof of cheating on their own.
      </p>
      <div className="player-grid">
        {players.map((player) => (
          <div className="player-card" key={player.id ?? player.name}>
            <div>
              <h3>{player.name}</h3>
              <p>
                {player.games ? `${player.games} games - ` : ""}
                {player.rolls} dice - avg {formatNumber(player.averageRoll, 2)}
              </p>
            </div>
            <div className="luck-line">
              <InfoLabel text="Successes" tip="Actual successful rolls compared with expected successful rolls after replay-marked reroll modifiers." />
              <strong>
                {player.successes}/{player.expectedSuccesses.toFixed(1)} ({signed(player.successDelta, 1)})
              </strong>
            </div>
            <div className="luck-line">
              <InfoLabel text="Significance" tip="z shows how many standard deviations this success result is from expected. p estimates how often a result this extreme happens by chance." />
              <strong>
                z {formatNumber(player.successZ, 2)} - p {formatPValue(player.successPValue)}
              </strong>
            </div>
            <div className="luck-line">
              <InfoLabel text="Raw roll delta" tip="Total rolled pips compared with fair D6 average. This ignores target numbers, so it is a broad dice-temperature check." />
              <strong>
                {signed(player.rollDelta, 1)} - p {formatPValue(player.rollPValue)}
              </strong>
            </div>
            <div className="luck-line">
              <InfoLabel text="D6 face pattern" tip="Checks whether the counts of 1s through 6s look unusually uneven for fair D6 dice. Low p means suspiciously uneven, not automatically cheating." />
              <strong>p {formatPValue(player.facePValue)}</strong>
            </div>
            <div className="badge-row">
              <span
                className={player.successPValue < 0.05 ? "badge warning has-tooltip" : "badge has-tooltip"}
                tabIndex={0}
              >
                {player.luckLevel}
                <span className="tooltip" role="tooltip">
                  Classification based on the success-roll p-value. Normal noise means this result is not rare enough
                  to flag under the current parser assumptions.
                </span>
              </span>
            </div>
            <div
              className="bar-track has-tooltip"
              tabIndex={0}
              aria-label={`${player.name} success swing bar`}
            >
              <div
                className={player.successDelta >= 0 ? "bar-positive" : "bar-negative"}
                style={{ width: `${Math.min(100, Math.abs(player.successDelta) * 8 + 8)}%` }}
              />
              <span className="tooltip" role="tooltip">
                Visual size of success delta: how far actual successes are from expected successes. Green is above
                expectation, red is below. It is scaled for readability, not a direct probability.
              </span>
            </div>
            <div className="face-grid" aria-label={`${player.name} D6 distribution`}>
              {player.faceCounts.map((count, index) => (
                <div className="face" key={index + 1}>
                  <span>{index + 1}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function InfoLabel({ text, tip }) {
  return (
    <span className="info-label" tabIndex={0}>
      {text}
      <span className="info-dot" aria-hidden="true">
        i
      </span>
      <span className="tooltip" role="tooltip">
        {tip}
      </span>
    </span>
  );
}

function EffectsAndRerolls({ effects, rerolls }) {
  const notableEffects = effects.filter((effect) =>
    ["Doom Bell", "Primal Fury"].some((name) => effect.name.toLowerCase().includes(name.toLowerCase())),
  );
  const shownEffects = notableEffects.length ? notableEffects : effects;

  return (
    <div className="effect-stack">
      <div className="reroll-summary">
        <div>
          <span>Reroll-enabled dice</span>
          <strong>{rerolls.available}</strong>
        </div>
        <div>
          <span>Actually rerolled</span>
          <strong>{rerolls.applied}</strong>
        </div>
      </div>

      <div className="reroll-types">
        {rerolls.byType.length ? (
          rerolls.byType.map((item) => (
            <span className="chip" key={item.type}>
              {item.label}: {item.applied}/{item.available}
            </span>
          ))
        ) : (
          <p className="empty">No reroll metadata found.</p>
        )}
      </div>

      <h3 className="mini-heading">Active Effects</h3>
      <div className="effect-list">
        {shownEffects.length ? (
          shownEffects.slice(0, 18).map((effect) => (
            <div className="effect-row" key={effect.id}>
              <div>
                <strong>{effect.name}</strong>
                <span>
                  #{effect.eventIndex} - {effect.caster.name} to {summarizeTargets(effect.targetNames)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="empty">No named buff or spell events found.</p>
        )}
      </div>

      <h3 className="mini-heading">Reroll Groups</h3>
      <div className="roll-list small-list">
        {rerolls.groups.slice(0, 16).map((group) => (
          <div className="roll-row" key={group.id}>
            <div>
              <strong>{group.label}</strong>
              <span>
                {group.playerName} - {group.unitName} - {group.rerolls.applied} rerolled
              </span>
            </div>
            <div className="roll-stats">
              <strong>{formatRerollExamples(group.rerolls.examples)}</strong>
              <span>{group.rerolls.byType.map((item) => item.label).join(", ")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnitRoster({ units }) {
  return (
    <div className="roster">
      {units.map((unit) => (
        <div className="unit-row" key={unit.globalId}>
          <span className={`side-dot side-${unit.playerId}`} />
          <div>
            <strong>{unit.name}</strong>
            <span>
              {unit.playerName} - {unit.section} - {unit.unitType}
              {unit.count ? ` - ${unit.count} model${unit.count === 1 ? "" : "s"}` : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CombatTable({ combats }) {
  if (!combats.length) return <p className="empty">No combat contacts found in this replay.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fight</th>
            <th>Expected wounds</th>
            <th>Actual wounds</th>
            <th>Pre-roll edge</th>
            <th>Roll swing</th>
          </tr>
        </thead>
        <tbody>
          {combats.map((combat) => (
            <tr key={combat.id}>
              <td>
                <strong>{combat.unitA.name}</strong>
                <span> vs {combat.unitB.name}</span>
              </td>
              <td>
                {formatNumber(combat.expectedA, 2)} - {formatNumber(combat.expectedB, 2)}
              </td>
              <td>
                {combat.actualA} - {combat.actualB}
              </td>
              <td>{combat.edgeLabel}</td>
              <td className={combat.swing >= 0 ? "positive" : "negative"}>{signed(combat.swing, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RollGroups({ groups }) {
  if (!groups.length) return <p className="empty">No D6 roll groups found.</p>;
  return (
    <div className="roll-list">
      {groups.slice(0, 40).map((group) => (
        <div className="roll-row" key={group.id}>
          <div>
            <strong>{group.label}</strong>
            <span>
              {group.playerName} - {group.unitName} - target {group.targetLabel}
              {group.rerolls?.applied ? ` - ${group.rerolls.applied} rerolled` : ""}
            </span>
          </div>
          <div className="roll-stats">
            <strong>
              {group.successes}/{group.rolls.length}
            </strong>
            <span>{signed(group.successDelta, 1)} vs exp.</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function UnlikelyWinsSummary({ summary }) {
  return (
    <div className="unlikely-summary">
      <div>
        <span>High swing fights</span>
        <strong>{summary.highSwingCount}</strong>
      </div>
      <div>
        <span>Underdog wins</span>
        <strong>{summary.underdogWinCount}</strong>
      </div>
      <div>
        <span>Flagged total</span>
        <strong>{summary.totalFlagged}</strong>
      </div>
      <p>
        Flags are based on expected wounds versus actual wounds. They are a triage list for review, not a rules-perfect
        verdict.
      </p>
      {summary.fights.length > 0 && (
        <div className="flagged-fights">
          {summary.fights.slice(0, 8).map((combat) => (
            <div className="flagged-fight" key={combat.id}>
              <strong>
                {combat.unitA.name} vs {combat.unitB.name}
              </strong>
              <span>
                swing {signed(combat.swing, 2)}
                {combat.winner ? ` - winner ${combat.winner.name} (${formatPercent(combat.winnerPreRollChance)})` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DisciplineTable({ tests }) {
  if (!tests.length) return <p className="empty">No discipline tests found.</p>;
  return (
    <div className="table-wrap compact">
      <table>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Roll</th>
            <th>Needed</th>
            <th>Chance</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => (
            <tr key={test.id}>
              <td>{test.unit.name}</td>
              <td>{test.crumble ? `D3: ${test.rollTotal}` : test.rollTotal}</td>
              <td>{test.crumble ? "Crumble" : test.target}</td>
              <td>{test.crumble ? "n/a" : formatPercent(test.probability)}</td>
              <td className={test.crumble || test.success ? "positive" : "negative"}>
                {test.crumble ? `Lose ${test.rollTotal}` : test.success ? "Pass" : "Fail"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

function signed(value, digits = 1) {
  const fixed = formatNumber(value, digits);
  return value > 0 ? `+${fixed}` : fixed;
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : "n/a";
}

function formatPValue(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (value < 0.001) return "<0.001";
  return value.toFixed(3);
}

function summarizeTargets(targetNames) {
  const unique = [...new Set(targetNames)];
  if (!unique.length) return "no listed targets";
  if (unique.length <= 3) return unique.join(", ");
  return `${unique.slice(0, 3).join(", ")} +${unique.length - 3} more`;
}

function formatRerollExamples(examples) {
  if (!examples.length) return "available";
  return examples
    .slice(0, 4)
    .map((example) => `${example.from}->${example.to}`)
    .join(", ");
}

createRoot(document.getElementById("root")).render(<App />);
