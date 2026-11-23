
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api, { getErrorMessage } from "../api";
import { saveSession } from "../session";

export default function Signup() {
  const navigate = useNavigate();

  const [banks, setBanks] = useState([]);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    bank_id: "",
    pin: "",
    confirmPin: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Load available banks.
  useEffect(() => {
    api
      .get("/banks")
      .then((res) => setBanks(res.data))
      .catch(() =>
        setError("Could not load the bank list. Is the backend running?")
      );
  }, []);

  const update = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.bank_id) {
      setError("Please select your bank.");
      return;
    }

    if (!/^(?:\d{4}|\d{6})$/.test(form.pin)) {
      setError("Payment PIN must contain exactly 4 or 6 digits.");
      return;
    }

    if (form.pin !== form.confirmPin) {
      setError("Payment PINs do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/signup", {
        name: form.name.trim(),
        phone: form.phone,
        password: form.password,
        bank_id: Number(form.bank_id),
        pin: form.pin,
      });

      // Save the session using your existing authentication helper.
      saveSession(res.data);

      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <form className="card" onSubmit={submit}>
        <h1>MiniPay</h1>
        <h2>Create account</h2>

        <label>Name</label>
        <input
          name="name"
          value={form.name}
          onChange={update}
          minLength={2}
          maxLength={100}
          required
        />

        <label>Phone number</label>
        <input
          name="phone"
          value={form.phone}
          onChange={update}
          inputMode="numeric"
          maxLength={10}
          pattern="\d{10}"
          title="Enter a 10 digit phone number"
          required
        />

        <label>Your bank</label>
        <select
          name="bank_id"
          value={form.bank_id}
          onChange={update}
          required
        >
          <option value="" disabled>
            Select your bank
          </option>

          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <label>Password (min 6 characters)</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={update}
          minLength={6}
          maxLength={64}
          required
        />

        <label>Payment PIN (4 or 6 digits)</label>
        <input
          name="pin"
          type="password"
          value={form.pin}
          onChange={(e) =>
            setForm({
              ...form,
              pin: e.target.value.replace(/\D/g, "").slice(0, 6),
            })
          }
          inputMode="numeric"
          pattern="(\d{4}|\d{6})"
          maxLength={6}
          placeholder="Create your payment PIN"
          autoComplete="new-password"
          required
        />

        <label>Confirm payment PIN</label>
        <input
          name="confirmPin"
          type="password"
          value={form.confirmPin}
          onChange={(e) =>
            setForm({
              ...form,
              confirmPin: e.target.value.replace(/\D/g, "").slice(0, 6),
            })
          }
          inputMode="numeric"
          pattern="(\d{4}|\d{6})"
          maxLength={6}
          placeholder="Re-enter your payment PIN"
          autoComplete="new-password"
          required
        />

        <p className="hint">
          Your payment PIN will be required whenever you send money.
        </p>

        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          disabled={loading || banks.length === 0}
        >
          {loading ? "Creating..." : "Sign up"}
        </button>

        <p className="hint">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
