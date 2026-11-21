import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import RiskBreakdown from "../components/RiskBreakdown";
import { formatMoney, formatTime } from "../utils";

export default function History() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api
      .get("/payments/history")
      .then((res) => setItems(res.data))
      .catch((err) => {
        if (err?.response?.status !== 401) setError(getErrorMessage(err));
      });
  }, []);

  const toggle = async (t) => {
    // Only payments you sent have a fraud breakdown
    if (t.direction !== "sent") return;
    if (openId === t.id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(t.id);
    setDetail(null);
    try {
      const res = await api.get(`/payments/${t.id}`);
      setDetail(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="subhead">
          <h2>Transactions</h2>
          <button className="secondary small" onClick={() => navigate("/dashboard")}>
            Back
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {!items && !error && <p className="hint">Loading...</p>}
        {items && items.length === 0 && <p className="hint">No transactions yet.</p>}
        {items && items.length > 0 && (
          <p className="hint small">Tap a payment you sent to see its fraud checks.</p>
        )}

        <div className="txn-list">
          {(items || []).map((t) => {
            const moved = t.status === "COMPLETED"; // only completed payments moved money
            return (
              <div key={t.id}>
                <div
                  className="txn"
                  onClick={() => toggle(t)}
                  style={{ cursor: t.direction === "sent" ? "pointer" : "default" }}
                >
                  <div>
                    <strong>
                      {t.direction === "sent" ? "To " : "From "}
                      {t.other_party}
                    </strong>
                    <div className="hint">
                      {formatTime(t.created_at)} ·{" "}
                      <span className={moved ? "" : "tag bad"}>{t.status}</span>
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div
                    className={
                      !moved ? "amt void" : t.direction === "sent" ? "amt out" : "amt in"
                    }
                  >
                    {moved ? (t.direction === "sent" ? "-" : "+") : ""}
                    {formatMoney(t.amount)}
                  </div>
                </div>

                {openId === t.id && (
                  <div style={{ marginBottom: 8 }}>
                    {!detail && <p className="hint">Loading...</p>}
                    {detail && detail.transaction_id === t.id && (
                      <>
                        <p className="hint small">
                          Transaction #{detail.transaction_id} · {detail.message}
                        </p>
                        {detail.checks.length > 0 ? (
                          <RiskBreakdown
                            checks={detail.checks}
                            riskScore={detail.risk_score}
                            decision={detail.decision}
                          />
                        ) : (
                          <p className="hint small">No fraud checks ran for this payment.</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}