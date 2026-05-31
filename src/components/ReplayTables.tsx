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
