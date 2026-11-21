import { useState } from "react";
import api, { getErrorMessage } from "../api";

const EMPTY = { current_password: "", new_password: "", confirm: "" };

export default function ChangePassword() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    if (form.new_password !== form.confirm) {
      setError("The new passwords do not match");
      return;
    }
    try {
      await api.post("/auth/staff/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setOk("Password changed");
      setForm(EMPTY);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 6 }}>
      <h3>Change my password</h3>

      <label>Current password</label>
      <input
        name="current_password"
        type="password"
        value={form.current_password}
        onChange={update}
        autoComplete="current-password"
        required
      />

      <label>New password (min 8 characters)</label>
      <input
        name="new_password"
        type="password"
        value={form.new_password}
        onChange={update}
        minLength={8}
        autoComplete="new-password"
        required
      />

      <label>Confirm new password</label>
      <input
        name="confirm"
        type="password"
        value={form.confirm}
        onChange={update}
        minLength={8}
        autoComplete="new-password"
        required
      />

      {error && <p className="error">{error}</p>}
      {ok && <div className="notice ok">{ok}</div>}

      <button type="submit">Change password</button>
    </form>
  );
}