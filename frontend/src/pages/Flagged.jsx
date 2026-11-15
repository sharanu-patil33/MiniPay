import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import RiskBreakdown from "../components/RiskBreakdown";
import { formatMoney, formatTime } from "../utils";

export default function Flagged() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [flaggedRes, alertsRes] = await Promise.all([
          api.get("/payments/flagged"),
          api.get("/payments/alerts"),
        ]);
        setItems(flaggedRes.data);
        setAlerts(alertsRes.data);
      } catch (err) {
        if (err?.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        } else {
          setError("Could not load flagged transactions.");
        }
      }
    };
    load();
  }, [navigate]);

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!items) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page">
      <div className="card">
        <h1>MiniPay</h1>
        <h2>Flagged transactions</h2>

        {items.length === 0 && (
          <p className="hint">Nothing has been flagged. All your payments looked normal.</p>
        )}

        {items.map((t) => (
          <details className="flag-item" key={t.transaction_id}>
            <summary>
              <div>
                <strong>To {t.receiver_name}</strong> · {formatMoney(t.amount)}
                <div className="hint small">
                  #{t.transaction_id} · {formatTime(t.created_at)} · {t.status}
                </div>
              </div>
              <span className={`badge ${t.decision}`}>{t.decision}</span>
            </summary>

            <p className="hint small">{t.reason}</p>
            <RiskBreakdown checks={t.checks} riskScore={t.risk_score} decision={t.decision} />
          </details>
        ))}

        {alerts.length > 0 && (
          <>
            <h3>Alerts</h3>
            {alerts.map((a) => (
              <div className="alert-item" key={a.id}>
                <div>{a.message}</div>
                <div className="hint small">{formatTime(a.created_at)}</div>
              </div>
            ))}
          </>
        )}

        <button onClick={() => navigate("/dashboard")}>Back to dashboard</button>
      </div>
    </div>
  );
}