
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import api, { getErrorMessage } from "../api";
import RiskBreakdown from "../components/RiskBreakdown";
import { formatMoney, getDeviceId, getLocation } from "../utils";

function decodeQrFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const maxSize = 1000;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      URL.revokeObjectURL(url);

      if (result) resolve(result.data);
      else reject(new Error("No QR code found in this image"));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image"));
    };

    img.src = url;
  });
}

export default function SendMoney() {
  const navigate = useNavigate();
  const keyRef = useRef(null);

  const [step, setStep] = useState("choose");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [receiver, setReceiver] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [result, setResult] = useState(null);

  // Search users as the user types.
  useEffect(() => {
    const q = query.trim();

    if (q.length < 2) {
      setResults([]);
      setSearchError("");
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");

      try {
        const res = await api.get("/users/search", { params: { q } });
        if (!cancelled) setResults(res.data);
      } catch (err) {
        if (err?.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        } else if (!cancelled) {
          setSearchError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, navigate]);

  const chooseReceiver = (user) => {
    setReceiver(user);
    setAmount("");
    setNote("");
    setPin("");
    setConfirmPin("");
    setPayError("");
    keyRef.current = null;
    setStep("amount");
  };

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";

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

  const validateAmount = () => {
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setPayError("Enter a valid amount (up to 2 decimal places)");
      return false;
    }

    if (Number(amount) > 100000) {
      setPayError("The maximum per payment is ₹1,00,000");
      return false;
    }

    return true;
  };

  const continueToPin = () => {
    setPayError("");

    if (!validateAmount()) return;

    setPin("");
    setConfirmPin("");
    setStep("pin");
  };

  // Sends the payment after PIN verification.
  const submitPayment = async (paymentPin) => {
    setPayError("");

    if (!keyRef.current) {
      keyRef.current = crypto.randomUUID();
    }

    setPaying(true);

    try {
      const loc = await getLocation();

      const payload = {
        receiver_id: receiver.id,
        amount: Number(amount),
        note: note.trim() || null,
        idempotency_key: keyRef.current,
        device_id: getDeviceId(),
        pin: paymentPin,
      };

      if (loc) {
        payload.latitude = loc.latitude;
        payload.longitude = loc.longitude;
      }

      const res = await api.post("/payments", payload);

      keyRef.current = null;
      setResult(res.data);
      setStep("result");
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      // Existing accounts may not have a payment PIN yet.
      if (
        status === 403 &&
        typeof detail === "string" &&
        detail.toLowerCase().includes("pin not set")
      ) {
        setPin(paymentPin);
        setConfirmPin("");
        setPayError("");
        setStep("setup-pin");
      } else if (
        status === 401 &&
        detail === "Incorrect payment PIN"
      ) {
        setPayError("Incorrect PIN. Please try again.");
      } else if (status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setPayError(getErrorMessage(err));
      }
    } finally {
      setPaying(false);
    }
  };

  const confirmPayment = async () => {
    setPayError("");

    if (!/^(?:\d{4}|\d{6})$/.test(pin)) {
      setPayError("Enter a valid 4-digit or 6-digit PIN.");
      return;
    }

    await submitPayment(pin);
  };

  // Sets a PIN for an existing account that does not have one.
  const setupPin = async () => {
    setPayError("");

    if (!/^(?:\d{4}|\d{6})$/.test(pin)) {
      setPayError("Your PIN must contain exactly 4 or 6 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setPayError("The PINs do not match.");
      return;
    }

    setPaying(true);

    try {
      await api.post("/auth/set-pin", { pin });

      // The newly created PIN is also used to authorize this payment.
      await submitPayment(pin);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setPayError(getErrorMessage(err));
      }
    } finally {
      setPaying(false);
    }
  };

  const reset = () => {
    setStep("choose");
    setQuery("");
    setResults([]);
    setReceiver(null);
    setAmount("");
    setNote("");
    setPin("");
    setConfirmPin("");
    setResult(null);
    setPayError("");
    keyRef.current = null;
  };

  // ---------- Payment result screen ----------
  if (step === "result" && result) {
    const completed = result.status === "COMPLETED";
    const blocked = result.status === "BLOCKED";
    const review = completed && result.decision === "REVIEW";

    const iconClass = blocked ? "bad" : review ? "warn" : completed ? "ok" : "bad";
    const icon = blocked || review ? "!" : completed ? "✓" : "✕";

    return (
      <div className="page">
        <div className="card">
          <div className={`status-icon ${iconClass}`}>{icon}</div>
          <h2 style={{ textAlign: "center" }}>{result.message}</h2>

          {blocked && (
            <div className="notice bad">
              This payment was flagged as suspicious and blocked. No money was
              deducted from your account.
            </div>
          )}

          {review && (
            <div className="notice warn">
              The payment went through, but it was flagged for review.
            </div>
          )}

          <div className="balance">
            <span>Amount</span>
            <strong>{formatMoney(result.amount)}</strong>
          </div>

          <p className="hint">To: <strong>{result.receiver_name}</strong></p>
          <p className="hint">Status: {result.status}</p>
          <p className="hint">Transaction ID: {result.transaction_id}</p>
          <p className="hint">Your balance: {formatMoney(result.current_balance)}</p>

          <RiskBreakdown
            checks={result.checks}
            riskScore={result.risk_score}
            decision={result.decision}
          />

          <button onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>

          {(blocked || review) && (
            <button className="secondary" onClick={() => navigate("/flagged")}>
              View flagged transactions
            </button>
          )}

          <button className="secondary" onClick={reset}>
            Send another payment
          </button>
        </div>
      </div>
    );
  }

  // ---------- Payment PIN screen ----------
  if (step === "pin" && receiver) {
    return (
      <div className="page">
        <div className="card">
          <h1>MiniPay</h1>
          <h2>Confirm payment</h2>

          <div className="user-item selected">
            <div className="avatar">
              {receiver.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{receiver.name}</strong>
              <div className="hint">
                {receiver.phone_masked} · {receiver.user_code}
              </div>
            </div>
          </div>

          <div className="balance">
            <span>Payment amount</span>
            <strong>{formatMoney(Number(amount))}</strong>
          </div>

          <label>Enter your payment PIN</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
              setPayError("");
            }}
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 4 or 6 digit PIN"
            autoComplete="off"
            autoFocus
          />

          {payError && <p className="error">{payError}</p>}

          <button onClick={confirmPayment} disabled={paying}>
            {paying ? "Verifying PIN..." : "Confirm and Pay"}
          </button>

          <button
            className="secondary"
            onClick={() => {
              setPin("");
              setPayError("");
              setStep("amount");
            }}
            disabled={paying}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ---------- First-time PIN setup screen ----------
  if (step === "setup-pin" && receiver) {
    return (
      <div className="page">
        <div className="card">
          <h1>MiniPay</h1>
          <h2>Create payment PIN</h2>

          <p className="hint">
            You haven't created a payment PIN yet. Set one up to authorize
            this payment and future payments.
          </p>

          <label>Create a 4-digit or 6-digit PIN</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
              setPayError("");
            }}
            inputMode="numeric"
            maxLength={6}
            placeholder="Create payment PIN"
            autoComplete="new-password"
            autoFocus
          />

          <label>Confirm payment PIN</label>
          <input
            type="password"
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6));
              setPayError("");
            }}
            inputMode="numeric"
            maxLength={6}
            placeholder="Re-enter payment PIN"
            autoComplete="new-password"
          />

          {payError && <p className="error">{payError}</p>}

          <button onClick={setupPin} disabled={paying}>
            {paying ? "Setting up PIN..." : "Set PIN and Continue"}
          </button>

          <button
            className="secondary"
            onClick={() => {
              setPin("");
              setConfirmPin("");
              setPayError("");
              setStep("amount");
            }}
            disabled={paying}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ---------- Amount screen ----------
  if (step === "amount" && receiver) {
    return (
      <div className="page">
        <div className="card">
          <h1>MiniPay</h1>
          <h2>Send money</h2>

          <div className="user-item selected">
            <div className="avatar">
              {receiver.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{receiver.name}</strong>
              <div className="hint">
                {receiver.phone_masked} · {receiver.user_code}
              </div>
            </div>
          </div>

          <label>Amount (₹)</label>
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setPayError("");
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

          <button onClick={continueToPin} disabled={paying}>
            Continue
          </button>

          <button
            className="secondary"
            onClick={() => setStep("choose")}
            disabled={paying}
          >
            Change receiver
          </button>
        </div>
      </div>
    );
  }

  // ---------- Choose receiver screen ----------
  return (
    <div className="page">
      <div className="card">
        <h1>MiniPay</h1>
        <h2>Send money</h2>

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
          <input
            type="file"
            accept="image/*"
            onChange={handleQrUpload}
            hidden
          />
        </label>

        {searchError && <p className="error">{searchError}</p>}
        {searching && <p className="hint">Searching...</p>}

        {!searching && query.trim().length >= 2 &&
          results.length === 0 && !searchError && (
            <p className="hint">
              No users found. Phone numbers must be typed in full (10 digits).
            </p>
          )}

        <div className="user-list">
          {results.map((u) => (
            <button
              key={u.id}
              className="user-item"
              onClick={() => chooseReceiver(u)}
            >
              <div className="avatar">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: "left" }}>
                <strong>{u.name}</strong>
                <div className="hint">
                  {u.phone_masked} · {u.user_code}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          className="secondary"
          onClick={() => navigate("/dashboard")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
