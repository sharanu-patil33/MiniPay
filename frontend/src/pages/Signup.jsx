
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    pin: "",
    confirmPin: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");

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
        name: form.name,
        phone: form.phone,
        password: form.password,
        pin: form.pin,
      });

      localStorage.setItem("token", res.data.access_token);
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

        <label>Password (min 6 characters)</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={update}
          minLength={6}
          required
        />

        <label>Payment PIN (4 or 6 digits)</label>
        <input
          name="pin"
          type="password"
          value={form.pin}
          onChange={update}
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
          onChange={update}
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

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Sign up"}
        </button>

        <p className="hint">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
