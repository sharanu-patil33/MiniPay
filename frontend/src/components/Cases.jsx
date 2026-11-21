import { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../api";
import RiskBreakdown from "./RiskBreakdown";
import { formatMoney, formatTime } from "../utils";

export default function Cases({ showBank = false }) {
  const [cases, setCases] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/ops/cases");
      setCases(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (id) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/ops/cases/${id}`);
      setDetail(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  if (!cases && error) return <p className="error">{error}</p>;
  if (!cases) return <p className="hint">Loading cases...</p>;

  return (
    <div>
      <div className="section-head">
        <h3>Flagged cases</h3>
        <button className="secondary small" onClick={load}>Refresh</button>
      </div>

      {error && <p className="error">{error}</p>}
      {cases.length === 0 && <p className="hint">No cases yet.</p>}

      {cases.map((c) => (
        <div className="case" key={c.case_id}>
          <div className="case-head" onClick={() => toggle(c.case_id)}>
            <div>
              <strong>
                #{c.transaction_id} · {c.sender_name} to {c.receiver_name}
              </strong>
              <div className="hint small">
                {formatMoney(c.amount)} · {formatTime(c.created_at)} · payment {c.txn_status} · case {c.case_status}
                {showBank && c.bank_name ? ` · ${c.bank_name}` : ""}
              </div>
              <div className="hint small">Assigned to: {c.assigned_to || "Unassigned"}</div>
            </div>
            <span className={`badge ${c.decision}`}>{c.decision}</span>
          </div>

          {openId === c.case_id && (
            <div className="case-body">
              <p className="hint small">{c.reason}</p>
              {loadingDetail && <p className="hint">Loading...</p>}
              {detail && detail.case_id === c.case_id && (
                <RiskBreakdown
                  checks={detail.checks}
                  riskScore={detail.risk_score}
                  decision={detail.decision}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}