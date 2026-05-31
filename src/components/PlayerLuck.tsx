import { formatNumber, formatPValue, signed } from "./format";

export function PlayerLuck({ players, favor, firstHalf = null, latterHalf = null }) {
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
          <div className="expectation-list" aria-label="Player successes over or under expectation">
            {players.map((player) => (
              <div key={player.id ?? player.name}>
                <span>{player.name}</span>
                <span className="expectation-result">
                  <strong className={player.successDelta >= 0 ? "positive" : "negative"}>
                    {signed(player.successDelta, 1)} - z {formatNumber(player.successZ, 2)} - p{" "}
                    {formatPValue(player.successPValue)}
                  </strong>
                  <SignificanceBadge player={player} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {firstHalf && <SegmentLuck segment={firstHalf} />}
      {latterHalf && <SegmentLuck segment={latterHalf} />}
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
              <span className={player.successPValue < 0.05 ? "badge warning has-tooltip" : "badge has-tooltip"} tabIndex={0}>
                {player.luckLevel}
                <span className="tooltip" role="tooltip">
                  Classification based on the success-roll p-value. Normal noise means this result is not rare enough
                  to flag under the current parser assumptions.
                </span>
              </span>
            </div>
            <div className="bar-track has-tooltip" tabIndex={0} aria-label={`${player.name} success swing bar`}>
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

function SegmentLuck({ segment }) {
  return (
    <div className="segment-banner">
      <span>{segment.label} only</span>
      <strong>
        {segment.favor?.favoredPlayerName ?? "No clear favorite"}
        <small>
          {" "}
          - {segment.totalDice} dice
          {Number.isFinite(segment.startEventIndex)
            ? ` from event ${segment.startEventIndex}+`
            : ` across ${segment.games ?? "all"} games`}
        </small>
      </strong>
      {segment.favor && (
        <p>
          Difference {formatNumber(segment.favor.successDeltaDifference, 1)} successes over expectation - z{" "}
          {formatNumber(segment.favor.z, 2)} - p {formatPValue(segment.favor.pValue)} - {segment.favor.level}
        </p>
      )}
      <div className="expectation-list" aria-label="Latter half player successes over or under expectation">
        {segment.players.map((player) => (
          <div key={player.id ?? player.name}>
            <span>{player.name}</span>
            <span className="expectation-result">
              <strong className={player.successDelta >= 0 ? "positive" : "negative"}>
                {signed(player.successDelta, 1)} - z {formatNumber(player.successZ, 2)} - p{" "}
                {formatPValue(player.successPValue)}
              </strong>
              <SignificanceBadge player={player} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignificanceBadge({ player }) {
  const significant = player.successPValue < 0.05;
  const direction = player.successDelta >= 0 ? "hot" : "cold";
  const label = significant ? `Unusual ${direction}` : "Normal";
  return (
    <span className={significant ? `mini-badge ${direction}` : "mini-badge"}>
      {label}
    </span>
  );
}

function InfoLabel({ text, tip }: { text: string; tip: string }) {
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
