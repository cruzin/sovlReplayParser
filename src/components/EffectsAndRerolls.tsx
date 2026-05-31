import { formatRerollExamples, summarizeTargets } from "./format";

export function EffectsAndRerolls({ effects, rerolls }) {
  const notableEffects = effects.filter((effect) =>
    ["Doom Bell", "Primal Fury"].some((name) => effect.name.toLowerCase().includes(name.toLowerCase())),
  );
  const shownEffects = notableEffects.length ? notableEffects : effects;

  return (
    <div className="effect-stack">
      <RerollSummary rerolls={rerolls} />

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

export function BulkRerolls({ rerolls, totals }) {
  return (
    <div className="effect-stack">
      <RerollSummary rerolls={rerolls} />
      <div className="bulk-note">
        <strong>{totals.activeEffects}</strong>
        <span> active effects and buffs parsed across the full batch.</span>
      </div>
    </div>
  );
}

function RerollSummary({ rerolls }) {
  return (
    <>
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
    </>
  );
}
