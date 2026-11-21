import { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api";
import { formatMoney } from "../../utils";

const EMPTY = { name: "", phone: "", password: "", bank_id: "" };

export default function UsersPanel({ onChanged }) {
  const [banks, setBanks] = useState([]);
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [resetId, setResetId] = useState(null);
  const [resetValue, setResetValue] = useState("");

  const load = useCallback(async () => {
    try {
      const [banksRes, usersRes] = await Promise.all([
        api.get("/admin/banks"),
        api.get("/admin/users"),
      ]);
      setBanks(banksRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      const res = await api.post("/admin/users", { ...form, bank_id: Number(form.bank_id) });
      setOk(`User ${res.data.name} created (code ${res.data.user_code}).`);
      setForm(EMPTY);
      await load();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const saveReset = async (user) => {
    setError("");
    setOk("");
    try {
      await api.post(`/admin/users/${user.id}/reset-password`, { new_password: resetValue });
      setOk(`Password reset for ${user.name}. Give them the new password.`);
      setResetId(null);
      setResetValue("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <h3>Create a user</h3>
      <form className="row-form" onSubmit={create}>
        <div className="field">
          <label>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            minLength={2}
            required
          />
        </div>
        <div className="field">
          <label>Phone (10 digits)</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            inputMode="numeric"
            maxLength={10}
            pattern="\d{10}"
            title="Enter a 10 digit phone number"
            required
          />
        </div>
        <div className="field">
          <label>Bank</label>
          <select
            value={form.bank_id}
            onChange={(e) => setForm({ ...form, bank_id: e.target.value })}
            required
          >
            <option value="" disabled>Select bank</option>
            {banks
              .filter((b) => b.is_active)
              .map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
          </select>
        </div>
        <div className="field">
          <label>Password (min 6)</label>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={6}
            autoComplete="off"
            required
          />
        </div>
        <button type="submit">Create</button>
      </form>

      {error && <p className="error">{error}</p>}
      {ok && <div className="notice ok">{ok}</div>}

      <h3>Users</h3>
      {!users && <p className="hint">Loading...</p>}
      {users && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Code</th>
                <th>Bank</th>
                <th>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.phone}</td>
                  <td>{u.user_code}</td>
                  <td>{u.bank_name || "-"}</td>
                  <td>{formatMoney(u.balance)}</td>
                  <td>
                    {resetId !== u.id ? (
                      <button
                        className="secondary small"
                        onClick={() => {
                          setResetId(u.id);
                          setResetValue("");
                        }}
                      >
                        Reset password
                      </button>
                    ) : (
                      <div className="actions">
                        <input
                          value={resetValue}
                          onChange={(e) => setResetValue(e.target.value)}
                          placeholder="New password (min 6)"
                          minLength={6}
                          autoComplete="off"
                        />
                        <button
                          className="small"
                          disabled={resetValue.length < 6}
                          onClick={() => saveReset(u)}
                        >
                          Save
                        </button>
                        <button className="secondary small" onClick={() => setResetId(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}