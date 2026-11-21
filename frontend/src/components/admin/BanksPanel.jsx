import { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api";

export default function BanksPanel({ onChanged }) {
  const [banks, setBanks] = useState(null);
  const [form, setForm] = useState({ name: "", code: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin/banks");
      setBanks(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      await api.post("/admin/banks", form);
      setForm({ name: "", code: "" });
      setOk("Bank added");
      await load();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const toggle = async (bank) => {
    setError("");
    setOk("");
    try {
      await api.patch(`/admin/banks/${bank.id}`, { is_active: !bank.is_active });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <h3>Add a bank</h3>
      <form className="row-form" onSubmit={add}>
        <div className="field">
          <label>Bank name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            minLength={2}
            required
          />
        </div>
        <div className="field">
          <label>Short code (e.g. AXIS)</label>
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            minLength={2}
            maxLength={10}
            pattern="[A-Za-z0-9]+"
            title="Letters and digits only"
            required
          />
        </div>
        <button type="submit">Add bank</button>
      </form>

      {error && <p className="error">{error}</p>}
      {ok && <div className="notice ok">{ok}</div>}

      <h3>Banks</h3>
      <p className="hint small">
        An inactive bank cannot be chosen at signup or for new ops members. Its existing users
        and ops members keep working.
      </p>
      {!banks && <p className="hint">Loading...</p>}
      {banks && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Bank</th>
                <th>Code</th>
                <th>Users</th>
                <th>Ops members</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.code}</td>
                  <td>{b.users}</td>
                  <td>{b.ops_members}</td>
                  <td>
                    <span className={`pill ${b.is_active ? "on" : "off"}`}>
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="secondary small" onClick={() => toggle(b)}>
                      {b.is_active ? "Deactivate" : "Activate"}
                    </button>
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