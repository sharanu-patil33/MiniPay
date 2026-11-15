const LABELS = {
  amount: "Amount",
  location: "Location",
  velocity: "Velocity",
  behavior: "Behavior",
  merchant: "Merchant",
  device_ip: "Device / IP",
};

function level(score) {
  if (score >= 60) return "high";
  if (score >= 35) return "mid";
  return "low";
}

export default function RiskBreakdown({ checks, riskScore, decision }) {
  if (!checks || checks.length === 0) return null;

  const slowest = Math.max(...checks.map((c) => c.duration_ms || 0));

  return (
    <div className="risk">
      <div className="risk-head">
        <strong>Fraud checks</strong>
        {riskScore != null && (
          <span className={`badge ${decision}`}>
            {decision} · {riskScore}
          </span>
        )}
      </div>

      <p className="hint small">
        {checks.length} checks ran at the same time (slowest took {slowest} ms)
      </p>

      {checks.map((c) => (
        <div className="check" key={c.check_name}>
          <div className="check-top">
            <span>{LABELS[c.check_name] || c.check_name}</span>
            <span>{Math.round(c.score)}</span>
          </div>
          <div className="bar">
            <div className={`fill ${level(c.score)}`} style={{ width: `${c.score}%` }} />
          </div>
          <div className="hint small">{c.reason}</div>
        </div>
      ))}
    </div>
  );
}