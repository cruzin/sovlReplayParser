import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  ChevronsUpDown,
  Crosshair,
  Dice5,
  Files,
  FileUp,
  Moon,
  Swords,
  Sun,
  Trophy,
  Users,
  WandSparkles,
} from "lucide-react";
import { analyzeReplay, analyzeReplayBatch } from "./parser/sovlReplay";
import { BulkAnalysis } from "./components/BulkAnalysis";
import { EffectsAndRerolls } from "./components/EffectsAndRerolls";
import { SpellImpact, SwingEvents, UnitFate } from "./components/InsightPanels";
import { Metric, Panel, PanelHeading } from "./components/Panel";
import { PlayerLuck } from "./components/PlayerLuck";
import {
  CombatTable,
  DisciplineTable,
  RollGroups,
  TurnByTurnRecap,
  UnitRoster,
  UnlikelyWinsSummary,
} from "./components/ReplayTables";

const sampleManifestUrl = `${import.meta.env.BASE_URL}samples/manifest.json`;
const themeStorageKey = "sovl-replay-theme";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  try {
    const savedTheme = localStorage.getItem(themeStorageKey);
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch {
    // Private or restricted browser contexts can block storage access.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const isBatch = analysis?.mode === "batch";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The theme still applies for the current session if storage is unavailable.
    }
  }, [theme]);

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
      setError(`Could not parse ${sample.name}: ${(err as Error).message}`);
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
      setError(`Could not parse uploaded replay: ${(err as Error).message}`);
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
      setError(`Could not parse bulk replay upload: ${(err as Error).message}`);
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
          <button
            className="theme-toggle"
            type="button"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
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
      {analysis && !loading && !isBatch && <SingleReplayAnalysis analysis={analysis} />}
    </main>
  );
}

function SingleReplayAnalysis({ analysis }) {
  return (
    <>
      <section className="metric-grid">
        <Metric icon={<Users />} label="Units" value={analysis.units.length} />
        <Metric icon={<Swords />} label="Combats" value={analysis.combats.length} />
        <Metric icon={<Crosshair />} label="Ranged attacks" value={analysis.rangedAttacks.length} />
        <Metric icon={<Dice5 />} label="Tracked dice" value={analysis.totalDice} />
        <Metric icon={<WandSparkles />} label="Active effects" value={analysis.activeEffects.length} />
        <Metric icon={<Trophy />} label="Unlikely fights" value={analysis.unlikelyWins.totalFlagged} />
      </section>

      <Panel title="Turn By Turn Recap" icon={<Swords />}>
        <TurnByTurnRecap turns={analysis.turnRecaps} players={analysis.players} />
      </Panel>

      <section className="two-column">
        <Panel title="Player Luck" icon={<BarChart3 />}>
          <PlayerLuck
            players={analysis.players}
            favor={analysis.favor}
            firstHalf={analysis.firstHalfLuck}
            latterHalf={analysis.latterHalfLuck}
          />
        </Panel>
        <Panel title="Effects And Rerolls" icon={<WandSparkles />}>
          <EffectsAndRerolls effects={analysis.activeEffects} rerolls={analysis.rerolls} />
        </Panel>
      </section>

      <section className="two-column">
        <Panel title="Unit Fate" icon={<Users />}>
          <UnitFate fates={analysis.unitFates} />
        </Panel>
        <Panel title="Swing Events" icon={<Trophy />}>
          <SwingEvents events={analysis.swingEvents} />
        </Panel>
      </section>

      <Panel title="Spell / Buff Impact" icon={<WandSparkles />}>
        <SpellImpact impacts={analysis.spellImpact} />
      </Panel>

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
  );
}
