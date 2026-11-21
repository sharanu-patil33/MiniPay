import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { homePathFor, saveSession } from "../session";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", {
        identifier: form.identifier.trim(),
        password: form.password,
      });
      saveSession(res.data);
      navigate(homePathFor(res.data.role), { replace: true });
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
        <h2>Log in</h2>

        <label>Phone number or username</label>
        <input
          name="identifier"
          value={form.identifier}
          onChange={update}
          autoComplete="username"
          required
        />

        <label>Password</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={update}
          autoComplete="current-password"
          required
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p className="hint small">
          Customers log in with their phone number. Bank staff and admins use their username.
        </p>
        <p className="hint">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}