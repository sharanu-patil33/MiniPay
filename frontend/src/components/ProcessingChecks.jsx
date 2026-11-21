import { useEffect, useState } from "react";

const ORDER = [
  ["amount", "Amount"],
  ["location", "Location"],
  ["velocity", "Velocity"],
  ["behavior", "Behavior"],
  ["merchant", "Merchant"],
  ["device_ip", "Device / IP"],
];

function level(score) {
  if (score >= 60) return "high";
  if (score >= 35) return "mid";
  return "low";
}

// Six lanes run side by side while the payment is checked.
// When `done` becomes true, each lane turns into its real result, one after another.
export default function ProcessingChecks({ checks, done, decision, riskScore, onComplete }) {
  const [shown, setShown] = useState(0);
  const hasChecks = !!(checks && checks.length);
  const total = hasChecks ? ORDER.length : 0;

  useEffect(() => {
    if (!done) return undefined;
    const finished = shown >= total;
    const timer = setTimeout(
      () => {
        if (finished) {
          if (onComplete) onComplete();
        } else {
          setShown((n) => n + 1);
        }
      },
      finished ? 900 : 280
    );
    return () => clearTimeout(timer);
  }, [done, shown, total, onComplete]);

  const allDone = done && hasChecks && shown >= ORDER.length;

  let headText = "Running 6 fraud checks at the same time";
  if (done && !hasChecks) headText = "Payment could not be processed";
  else if (done && !allDone) headText = "Collecting results...";
  else if (allDone) headText = `All 6 checks finished · risk score ${riskScore}`;

  return (
    <div className="threads">
      <div className="threads-head">
        {allDone ? <span className={`badge ${decision}`}>{decision}</span> : <span className="spinner" />}
        <span>{headText}</span>
      </div>

      {!(done && !hasChecks) &&
        ORDER.map(([key, label], i) => {
          const result = checks ? checks.find((c) => c.check_name === key) : null;
          const revealed = done && hasChecks && i < shown && result;

          if (!revealed) {
            return (
              <div className="thread" key={key}>
                <div className="thread-top">
                  <span className="thread-name">{label}</span>
                  <span className="thread-tag">
                    Thread {i + 1} · running <span className="spinner" />
                  </span>
                </div>
                <div className="lane running" style={{ "--d": `${i * 0.18}s` }} />
              </div>
            );
          }

          const lv = level(result.score);
          return (
            <div className="thread revealed" key={key}>
              <div className="thread-top">
                <span className="thread-name">{label}</span>
                <span className={`thread-score ${lv}`}>{Math.round(result.score)} / 100</span>
              </div>
              <div className="lane">
                <div className={`fill grow ${lv}`} style={{ "--w": `${result.score}%` }} />
              </div>
              <div className="thread-tag">
                {result.thread_name} · {result.duration_ms ?? 0} ms
              </div>
              <div className="hint small">{result.reason}</div>
            </div>
          );
        })}
    </div>
  );
}