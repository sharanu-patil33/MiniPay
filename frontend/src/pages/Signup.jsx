import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", form);
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
        <input name="name" value={form.name} onChange={update} minLength={2} required />

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