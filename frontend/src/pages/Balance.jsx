import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { formatMoney } from "../utils";

export default function Balance() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null); // { has_pin, locked_seconds }
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [shown, setShown] = useState(null); // { amount, bankName } after a correct PIN
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    api
      .get("/pin/status")
      .then((res) => setStatus(res.data))
      .catch((err) => {
        if (err?.response?.status !== 401) setError("Could not load this page. Please try again.");
      });
  }, []);

  // Count up from 0 to the real balance when it is revealed
  useEffect(() => {
    if (!shown) return undefined;

    const target = shown.amount;
    const reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(target);
      return undefined;
    }

    let frame;
    const start = performance.now();
    const duration = 900;
    setDisplay(0);

    const tick = () => {
      const p = Math.min(1, Math.max(0, (performance.now() - start) / duration));
      setDisplay(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^(\d{4}|\d{6})$/.test(pin)) {
      setError("Enter your 4 or 6 digit PIN");
      return;
    }

    setChecking(true);
    try {
      const res = await api.post("/pin/balance", { pin });
      const amount = Number(res.data?.balance);
      if (!Number.isFinite(amount)) {
        setError("Could not read your balance. Please try again.");
      } else {
        setShown({ amount, bankName: res.data.bank_name || null });
      }
    } catch (err) {
      if (err?.response?.status === 428) {
        setStatus({ has_pin: false, locked_seconds: 0 });
      } else {
        setError(getErrorMessage(err)); // for example: "Incorrect PIN. 2 attempts left."
      }
    } finally {
      setPin("");
      setChecking(false);
    }
  };

  const lockedMinutes = status ? Math.ceil(status.locked_seconds / 60) : 0;

  return (
    <div className="page">
      <div className="card">
        <div className="subhead">
          <h2>Check balance</h2>
          <button className="secondary small" onClick={() => navigate("/dashboard")}>
            Back
          </button>
        </div>

        {!status && !error && <p className="hint">Loading...</p>}
        {!status && error && <p className="error">{error}</p>}

        {status && !status.has_pin && (
          <>
            <div className="balance-big">
              <span>Account balance</span>
              <strong className="masked">₹ ••••••</strong>
            </div>
            <p className="hint">Set up your PIN first. It protects your balance and your payments.</p>
            <button onClick={() => navigate("/pin", { state: { next: "/balance" } })}>
              Set up PIN
            </button>
          </>
        )}

        {status && status.has_pin && shown && (
          <>
            <div className="balance-big">
              <span>{shown.bankName ? `${shown.bankName} · account balance` : "Account balance"}</span>
              <strong>{formatMoney(display)}</strong>
            </div>
            <button onClick={() => setShown(null)}>Hide balance</button>
            <button className="secondary" onClick={() => navigate("/send")}>
              Send money
            </button>
          </>
        )}

        {status && status.has_pin && !shown && (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="balance-big">
              <span>Account balance</span>
              <strong className="masked">₹ ••••••</strong>
            </div>

            {lockedMinutes > 0 && (
              <div className="lock-box">
                Your PIN is locked. Try again in about {lockedMinutes} minute(s).
              </div>
            )}

            <label>Enter your PIN to see your balance</label>
            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••"
              autoFocus
            />

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={checking}>
              {checking ? "Checking..." : "Check balance"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}