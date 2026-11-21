import { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api";

const EMPTY = { name: "", username: "", password: "", bank_id: "" };

export default function StaffPanel({ onChanged }) {
  const [banks, setBanks] = useState([]);
  const [staff, setStaff] = useState(null);
  const [filterBank, setFilterBank] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [resetId, setResetId] = useState(null);
  const [resetValue, setResetValue] = useState("");

  const loadBanks = useCallback(async () => {
    try {
      const res = await api.get("/admin/banks");
      setBanks(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const res = await api.get("/admin/staff", {
        params: filterBank ? { bank_id: filterBank } : {},
      });
      setStaff(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [filterBank]);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const activeBanks = banks.filter((b) => b.is_active);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setCreated(null);
    try {
      const res = await api.post("/admin/staff", {
        ...form,
        bank_id: Number(form.bank_id),
      });
      setCreated({
        username: res.data.username,
        password: form.password,
        bank: res.data.bank_name,
      });
      setForm(EMPTY);
      await loadStaff();
      await loadBanks();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const toggle = async (member) => {
    setError("");
    setOk("");
    try {
      await api.patch(`/admin/staff/${member.id}`, { is_active: !member.is_active });
      await loadStaff();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const saveReset = async (member) => {
    setError("");
    setOk("");
    try {
      await api.post(`/admin/staff/${member.id}/reset-password`, { new_password: resetValue });
      setOk(`Password reset for ${member.username}. Give them the new password.`);
      setResetId(null);
      setResetValue("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <h3>Create a bank operations team member</h3>
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
          <label>Bank</label>
          <select
            value={form.bank_id}
            onChange={(e) => setForm({ ...form, bank_id: e.target.value })}
            required
          >
            <option value="" disabled>Select bank</option>
            {activeBanks.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Username (login)</label>
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_.\-]+"
            title="Letters, digits, dot, dash or underscore. It must contain a letter."
            autoComplete="off"
            required
          />
        </div>
        <div className="field">
          <label>Password (min 8)</label>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            autoComplete="off"
            required
          />
        </div>
        <button type="submit">Create</button>
      </form>

      {created && (
        <div className="notice ok">
          Created. Give these login details to the team member:
          <br />
          <strong>Username:</strong> {created.username} &nbsp; <strong>Password:</strong>{" "}
          {created.password} &nbsp; <strong>Bank:</strong> {created.bank}
          <br />
          Ask them to change the password after their first login. It is not shown again.
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {ok && <div className="notice ok">{ok}</div>}

      <div className="section-head">
        <h3>Team</h3>
        <select value={filterBank} onChange={(e) => setFilterBank(e.target.value)}>
          <option value="">All banks</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {!staff && <p className="hint">Loading...</p>}
      {staff && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Bank</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.username}</td>
                  <td>{s.role === "ADMIN" ? "Admin" : "Ops"}</td>
                  <td>{s.bank_name || "All banks"}</td>
                  <td>
                    <span className={`pill ${s.is_active ? "on" : "off"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    {s.role === "OPS" && resetId !== s.id && (
                      <div className="actions">
                        <button className="secondary small" onClick={() => toggle(s)}>
                          {s.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="secondary small"
                          onClick={() => {
                            setResetId(s.id);
                            setResetValue("");
                          }}
                        >
                          Reset password
                        </button>
                      </div>
                    )}
                    {s.role === "OPS" && resetId === s.id && (
                      <div className="actions">
                        <input
                          value={resetValue}
                          onChange={(e) => setResetValue(e.target.value)}
                          placeholder="New password (min 8)"
                          minLength={8}
                          autoComplete="off"
                        />
                        <button
                          className="small"
                          disabled={resetValue.length < 8}
                          onClick={() => saveReset(s)}
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