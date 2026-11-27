import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";

const digits = (value) => value.replace(/\D/g, "").slice(0, 6);

export default function SetPin() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const next = routerLocation.state?.next || "/dashboard";
  const backState = routerLocation.state?.backState || null;

  const [hasPin, setHasPin] = useState(null);
  const [form, setForm] = useState({ password: "", pin: "", confirm: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/pin/status")
      .then((res) => setHasPin(res.data.has_pin))
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^(\d{4}|\d{6})$/.test(form.pin)) {
      setError("The PIN must be exactly 4 or 6 digits");
      return;
    }
    if (form.pin !== form.confirm) {
      setError("The two PINs do not match");
      return;
    }

    setSaving(true);
    try {
      await api.post("/pin/set", { password: form.password, pin: form.pin });
      navigate(next, { replace: true, state: backState });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <form className="card" onSubmit={submit}>
        <h1>MiniPay</h1>
        <h2>{hasPin ? "Change your PIN" : "Set your PIN"}</h2>
        <p className="pin-note">
          Your PIN is needed to send money and to see your balance. Confirm it with your account
          password.
        </p>

        <label>Account password</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="current-password"
          required
        />

        <label>New PIN (4 or 6 digits)</label>
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={form.pin}
          onChange={(e) => setForm({ ...form, pin: digits(e.target.value) })}
          placeholder="••••"
          required
        />

        <label>Confirm PIN</label>
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: digits(e.target.value) })}
          placeholder="••••"
          required
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save PIN"}
        </button>
        <button type="button" className="secondary" onClick={() => navigate("/dashboard")}>
          Cancel
        </button>
      </form>
    </div>
  );
}