import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { formatMoney } from "../utils";

export default function Balance() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => setMe(res.data))
      .catch((err) => {
        if (err?.response?.status !== 401) setError("Could not load your balance.");
      });
  }, []);

  // Count up from 0 to the real balance when it is revealed
  useEffect(() => {
    if (!revealed || !me) return undefined;
    let frame;
    const start = performance.now();
    const duration = 900;

    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setDisplay(me.balance * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [revealed, me]);

  return (
    <div className="page">
      <div className="card">
        <div className="subhead">
          <h2>Check balance</h2>
          <button className="secondary small" onClick={() => navigate("/dashboard")}>
            Back
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {!me && !error && <p className="hint">Loading...</p>}

        {me && (
          <>
            <div className="balance-big">
              <span>{me.bank_name ? `${me.bank_name} · account balance` : "Account balance"}</span>
              {revealed ? (
                <strong>{formatMoney(display)}</strong>
              ) : (
                <strong className="masked">₹ ••••••</strong>
              )}
            </div>

            <button onClick={() => setRevealed((r) => !r)}>
              {revealed ? "Hide balance" : "Check balance"}
            </button>
            <button className="secondary" onClick={() => navigate("/send")}>
              Send money
            </button>
          </>
        )}
      </div>
    </div>
  );
}