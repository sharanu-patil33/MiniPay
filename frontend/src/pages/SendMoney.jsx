import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import ProcessingChecks from "../components/ProcessingChecks";
import RiskBreakdown from "../components/RiskBreakdown";
import { decodeQrFromFile } from "../qr";
import { formatMoney, formatTime, getDeviceId, getLocation } from "../utils";

const MIN_ANIMATION_MS = 2500; // keep the six-thread screen up long enough to be seen
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SendMoney() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const preselected = routerLocation.state?.receiver || null; // set by the Scan QR page
  const keyRef = useRef(null); // idempotency key for the payment being attempted

  const [step, setStep] = useState(preselected ? "amount" : "choose"); // choose | amount | processing | result
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [receiver, setReceiver] = useState(preselected);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [payError, setPayError] = useState("");
  const [result, setResult] = useState(null);
  const [procDone, setProcDone] = useState(false);

  // Search as the user types (waits 400 ms after the last key press)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError("");
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await api.get("/users/search", { params: { q } });
        if (!cancelled) setResults(res.data);
      } catch (err) {
        if (!cancelled && err?.response?.status !== 401) setSearchError(getErrorMessage(err));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const chooseReceiver = (user) => {
    setReceiver(user);
    setAmount("");
    setNote("");
    setPayError("");
    keyRef.current = null;
    setStep("amount");
  };

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;

    setSearchError("");
    try {
      const text = await decodeQrFromFile(file);
      const res = await api.get(`/users/by-code/${encodeURIComponent(text)}`);
      chooseReceiver(res.data);
    } catch (err) {
      setSearchError(err?.response ? getErrorMessage(err) : err.message);
    }
  };

  const pay = async () => {
    setPayError("");

    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setPayError("Enter a valid amount (up to 2 decimal places)");
      return;
    }
    if (Number(amount) > 100000) {
      setPayError("The maximum per payment is ₹1,00,000");
      return;
    }

    // One key per payment attempt: a double click or a retry can never pay twice.
    if (!keyRef.current) keyRef.current = crypto.randomUUID();

    setResult(null);
    setProcDone(false);
    setStep("processing");
    const started = Date.now();

    try {
      const loc = await getLocation();
      const payload = {
        receiver_id: receiver.id,
        amount: Number(amount),
        note: note.trim() || null,
        idempotency_key: keyRef.current,
        device_id: getDeviceId(),
      };
      if (loc) {
        payload.latitude = loc.latitude;
        payload.longitude = loc.longitude;
      }

      const res = await api.post("/payments", payload);

      const remaining = MIN_ANIMATION_MS - (Date.now() - started);
      if (remaining > 0) await wait(remaining);

      keyRef.current = null;
      setResult(res.data);
      setProcDone(true); // the lanes now turn into the real results
    } catch (err) {
      setStep("amount");
      if (err?.response?.status !== 401) setPayError(getErrorMessage(err));
    }
  };

  const showResult = useCallback(() => setStep("result"), []);

  const reset = () => {
    setStep("choose");
    setQuery("");
    setResults([]);
    setReceiver(null);
    setAmount("");
    setNote("");
    setResult(null);
    setProcDone(false);
    setPayError("");
    keyRef.current = null;
  };

  // ---------- Screen 3: the six checks run ----------
  if (step === "processing" && receiver) {
    return (
      <div className="page">
        <div className="card">
          <h1>MiniPay</h1>
          <h2>Paying {receiver.name}</h2>
          <div className="balance">
            <span>Amount</span>
            <strong>{formatMoney(amount)}</strong>
          </div>
          <ProcessingChecks
            checks={result?.checks}
            done={procDone}
            decision={result?.decision}
            riskScore={result?.risk_score}
            onComplete={showResult}
          />
        </div>
      </div>
    );
  }

  // ---------- Screen 4: receipt ----------
  if (step === "result" && result) {
    const completed = result.status === "COMPLETED";
    const blocked = result.status === "BLOCKED";
    const review = completed && result.decision === "REVIEW";

    const iconClass = blocked ? "bad" : review ? "warn" : completed ? "ok" : "bad";
    const icon = blocked || review ? "!" : completed ? "✓" : "✕";
    const title = completed ? `Paid to ${result.receiver_name}` : result.message;

    return (
      <div className="page">
        <div className="card">
          <div className={`status-icon ${iconClass}`}>{icon}</div>
          <h2 style={{ textAlign: "center" }}>{title}</h2>
          <div className="receipt-amount">{formatMoney(result.amount)}</div>

          {blocked && (
            <div className="notice bad">
              This payment was flagged as suspicious and blocked. No money was deducted from
              your account.
            </div>
          )}
          {review && (
            <div className="notice warn">
              The payment went through, but it was flagged for review by your bank.
            </div>
          )}

          <div>
            <div className="row">
              <span>To</span>
              <span>{result.receiver_name}</span>
            </div>
            {receiver && (
              <div className="row">
                <span>Receiver details</span>
                <span>{receiver.phone_masked} · {receiver.user_code}</span>
              </div>
            )}
            {note.trim() && (
              <div className="row">
                <span>Note</span>
                <span>{note.trim()}</span>
              </div>
            )}
            <div className="row">
              <span>Date and time</span>
              <span>{formatTime(result.created_at)}</span>
            </div>
            <div className="row">
              <span>Transaction ID</span>
              <span>#{result.transaction_id}</span>
            </div>
            <div className="row">
              <span>Status</span>
              <span>{result.status}</span>
            </div>
            {result.decision && (
              <div className="row">
                <span>Fraud decision</span>
                <span>{result.decision} (score {result.risk_score})</span>
              </div>
            )}
            <div className="row">
              <span>Your balance</span>
              <span>{formatMoney(result.current_balance)}</span>
            </div>
          </div>

          <RiskBreakdown
            checks={result.checks}
            riskScore={result.risk_score}
            decision={result.decision}
          />

          <button onClick={() => navigate("/dashboard")}>Back to home</button>
          <button className="secondary" onClick={reset}>Send another payment</button>
          <button className="secondary" onClick={() => navigate("/history")}>
            View transactions
          </button>
          {(blocked || review) && (
            <button className="secondary" onClick={() => navigate("/flagged")}>
              View flagged transactions
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------- Screen 2: amount ----------
  if (step === "amount" && receiver) {
    return (
      <div className="page">
        <div className="card">
          <h1>MiniPay</h1>
          <h2>Send money</h2>

          <div className="user-item selected">
            <div className="avatar">{receiver.name.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{receiver.name}</strong>
              <div className="hint">{receiver.phone_masked} · {receiver.user_code}</div>
            </div>
          </div>

          <label>Amount (₹)</label>
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              keyRef.current = null;
            }}
            inputMode="decimal"
            placeholder="0.00"
            autoFocus
          />

          <label>Note (optional)</label>
          <input
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              keyRef.current = null;
            }}
            maxLength={255}
            placeholder="What is this for?"
          />

          {payError && <p className="error">{payError}</p>}

          <button onClick={pay}>Pay</button>
          <button className="secondary" onClick={() => setStep("choose")}>
            Change receiver
          </button>
        </div>
      </div>
    );
  }

  // ---------- Screen 1: choose receiver ----------
  return (
    <div className="page">
      <div className="card">
        <h1>MiniPay</h1>
        <h2>Send money</h2>

        <button onClick={() => navigate("/scan")}>Scan a QR code with the camera</button>

        <div className="or">or</div>

        <label>Search by name or full 10-digit phone number</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Bob or 9123456780"
          autoFocus
        />

        <div className="or">or</div>

        <label className="file-button">
          Upload a QR code image
          <input type="file" accept="image/*" onChange={handleQrUpload} hidden />
        </label>

        {searchError && <p className="error">{searchError}</p>}
        {searching && <p className="hint">Searching...</p>}

        {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && (
          <p className="hint">
            No users found. Phone numbers must be typed in full (10 digits).
          </p>
        )}

        <div className="user-list">
          {results.map((u) => (
            <button key={u.id} className="user-item" onClick={() => chooseReceiver(u)}>
              <div className="avatar">{u.name.charAt(0).toUpperCase()}</div>
              <div style={{ textAlign: "left" }}>
                <strong>{u.name}</strong>
                <div className="hint">{u.phone_masked} · {u.user_code}</div>
              </div>
            </button>
          ))}
        </div>

        <button className="secondary" onClick={() => navigate("/dashboard")}>Cancel</button>
      </div>
    </div>
  );
}