import { formatNumber, signed, summarizeTargets } from "./format";

export function UnitFate({ fates }) {
  return (
    <div className="fate-list">
      {fates.slice(0, 12).map((unit) => (
        <div className="fate-row" key={unit.globalId}>
          <div>
            <strong>{unit.name}</strong>
            <span>
              {unit.playerName} - {unit.status} - est. {formatNumber(unit.estimatedRemaining, 1)}/
              {unit.startingModels} models
            </span>
          </div>
          <div className="fate-stats">
            <span>caused {formatNumber(unit.woundsCaused, 1)}</span>
            <span>taken {formatNumber(unit.woundsTaken, 1)}</span>
            <strong className={unit.performanceSwing >= 0 ? "positive" : "negative"}>
              {signed(unit.performanceSwing, 1)}
            </strong>
          </div>
          {unit.notes.length > 0 && <p>{unit.notes.slice(0, 2).join("; ")}</p>}
        </div>
      ))}
    </div>
  );
}

export function SwingEvents({ events }) {
  if (!events.length) return <p className="empty">No large swing events found by the current thresholds.</p>;
  return (
    <div className="swing-list">
      {events.slice(0, 14).map((event) => (
        <div className="swing-row" key={event.id}>
          <div>
            <strong>{event.type}</strong>
            <span>
              #{event.eventIndex} - {event.title}
            </span>
            <small>{event.detail}</small>
          </div>
          <strong className={event.swing >= 0 ? "positive" : "negative"}>{signed(event.swing, 1)}</strong>
        </div>
      ))}
    </div>
  );
}

export function SpellImpact({ impacts }) {
  if (!impacts.length) return <p className="empty">No spell or buff events found.</p>;
  return (
    <div className="impact-list">
      {impacts.slice(0, 18).map((impact) => (
        <div className="impact-row" key={impact.id}>
          <div>
            <strong>{impact.name}</strong>
            <span>
              #{impact.eventIndex} - {impact.caster.name} to {summarizeTargets(impact.targetNames)}
            </span>
            <small>{impact.ruleText}</small>
          </div>
          <div className="impact-stats">
            <span>{impact.relatedRollGroups} roll groups</span>
            <span>{impact.rerollsApplied}/{impact.rerollsAvailable} rerolls</span>
            <span>{impact.tags?.join(", ")}</span>
            <strong className={impact.successDelta >= 0 ? "positive" : "negative"}>
              {signed(impact.successDelta, 1)}
            </strong>
          </div>
          {impact.notableGroups.length > 0 && (
            <p>
              {impact.notableGroups
                .map((group) => `${group.unitName} ${signed(group.successDelta, 1)} (${group.impactReason})`)
                .join("; ")}
            </p>
          )}
          {impact.estimate && <p>{impact.estimate.summary}</p>}
        </div>
      ))}
    </div>
  );
}
