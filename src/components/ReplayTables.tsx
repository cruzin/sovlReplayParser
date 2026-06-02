import { formatNumber, formatPercent, signed } from "./format";

export function UnitRoster({ units }) {
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

export function CombatTable({ combats }) {
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

export function RollGroups({ groups }) {
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

export function UnlikelyWinsSummary({ summary }) {
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

export function TurnByTurnRecap({ turns, players }) {
  if (!turns.length) return <p className="empty">No melee combats after turn 1 were found in this replay.</p>;
  return (
    <div className="turn-recap-list">
      {turns.map((turn) => (
        <section className="turn-recap" key={turn.turn}>
          <div className="turn-recap-heading">
            <div>
              <h3>Turn {turn.turn}</h3>
              <span>
                {turn.combats.length} grouped combat{turn.combats.length === 1 ? "" : "s"} from {turn.totalCombats} contact
                {turn.totalCombats === 1 ? "" : "s"}
              </span>
            </div>
            <strong className={turn.favor.favoredPlayerId == null ? "" : `player-${turn.favor.favoredPlayerId}`}>
              {turn.favor.label}
            </strong>
          </div>
          <div className="turn-favor-counts">
            <span>
              Favored {turn.combatFavorCounts.player1Name}: <strong>{turn.combatFavorCounts.player1}</strong>
            </span>
            <span>
              Even: <strong>{turn.combatFavorCounts.even}</strong>
            </span>
            <span>
              Favored {turn.combatFavorCounts.player2Name}: <strong>{turn.combatFavorCounts.player2}</strong>
            </span>
          </div>
          <div className="turn-combat-list">
            {turn.combats.map((combat) => (
              <TurnCombat combat={combat} players={players} key={combat.id} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TurnCombat({ combat, players }) {
  const [playerA, playerB] = players;
  const statsA = combat.players[playerA.id];
  const statsB = combat.players[playerB.id];
  const winner = combat.winningPlayerId == null ? null : players.find((player) => player.id === combat.winningPlayerId);
  const outcomeText = winner
    ? `${winner.name} ${combat.outcome.toLowerCase()} (${formatPercent(combat.winnerChance)} pre-roll)`
    : combat.outcome;
  return (
    <article className="turn-combat-card">
      <div className="turn-combat-main">
        <div className="turn-side">
          <strong>{formatUnitNames(combat.unitsByPlayer[playerA.id])}</strong>
          <span>{playerA.name}</span>
          <CommanderLine commanders={combat.commandersByPlayer[playerA.id]} />
          <ActiveEffectLine effects={combat.activeEffectsByPlayer[playerA.id]} />
          <SpecialRuleLine rules={combat.specialRulesByPlayer[playerA.id]} />
        </div>
        <div className="turn-center">
          <div className="turn-versus">vs</div>
          <span>
            {playerA.name} {formatPercent(statsA?.winChance ?? 0.5)} / {playerB.name}{" "}
            {formatPercent(statsB?.winChance ?? 0.5)}
          </span>
          <strong className={combat.winningPlayerId == null ? "" : `player-${combat.winningPlayerId}`}>
            {outcomeText}
          </strong>
          <span className={combat.swing >= 0 ? "positive" : "negative"}>Swing {signed(combat.swing, 2)}</span>
        </div>
        <div className="turn-side">
          <strong>{formatUnitNames(combat.unitsByPlayer[playerB.id])}</strong>
          <span>{playerB.name}</span>
          <CommanderLine commanders={combat.commandersByPlayer[playerB.id]} />
          <ActiveEffectLine effects={combat.activeEffectsByPlayer[playerB.id]} />
          <SpecialRuleLine rules={combat.specialRulesByPlayer[playerB.id]} />
        </div>
      </div>
      <div className="turn-combat-stats">
        <span>
          Expected wounds: {formatNumber(statsA?.expectedWounds ?? 0, 2)} -{" "}
          {formatNumber(statsB?.expectedWounds ?? 0, 2)}
        </span>
        <span>
          Actual wounds: {statsA?.actualWounds ?? 0} - {statsB?.actualWounds ?? 0}
        </span>
      </div>
    </article>
  );
}

function CommanderLine({ commanders = [] }) {
  if (!commanders.length) return null;
  return (
    <span className="commander-line">
      Commander{commanders.length === 1 ? "" : "s"}:{" "}
      {commanders.map(formatCommander).join(", ")}
    </span>
  );
}

function ActiveEffectLine({ effects = [] }) {
  if (!effects.length) return null;
  return (
    <span className="active-effect-line">
      Active:{" "}
      {effects
        .map((effect) => `${effect.name} on ${effect.targetName}${effect.casterName ? ` by ${effect.casterName}` : ""}`)
        .join(", ")}
    </span>
  );
}

function formatCommander(commander) {
  const loadout = commander.magicItems?.length ? ` - ${commander.magicItems.map(formatKnownRuleId).join(", ")}` : "";
  return `${commander.name} (${commander.unit.name}${loadout})`;
}

function formatKnownRuleId(id) {
  const known = {
    flametounge: "Flametongue",
    unaturalPower: "Unnatural Power",
  };
  if (known[id]) return known[id];
  return String(id || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SpecialRuleLine({ rules = [] }) {
  if (!rules.length) return null;
  return <span className="special-rule-line">{rules.map((rule) => rule.label).join(", ")}</span>;
}

function formatUnitNames(units = []) {
  if (!units.length) return "No units";
  return units.map((unit) => unit.name).join(", ");
}

export function DisciplineTable({ tests }) {
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
