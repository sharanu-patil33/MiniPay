import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { saveSession } from "../session";

export default function Signup() {
  const navigate = useNavigate();
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", password: "", bank_id: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/banks")
      .then((res) => setBanks(res.data))
      .catch(() => setError("Could not load the bank list. Is the backend running?"));
  }, []);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", {
        ...form,
        bank_id: Number(form.bank_id),
      });
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

        <label>Your bank</label>
        <select name="bank_id" value={form.bank_id} onChange={update} required>
          <option value="" disabled>Select your bank</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

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

        <button type="submit" disabled={loading || banks.length === 0}>
          {loading ? "Creating..." : "Sign up"}
        </button>

        <p className="hint">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}