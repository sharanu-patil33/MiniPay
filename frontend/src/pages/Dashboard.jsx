import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { clearSession } from "../session";
import { formatMoney, formatTime } from "../utils";

export default function Dashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [qr, setQr] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, qrRes, histRes] = await Promise.all([
          api.get("/auth/me"),
          api.get("/auth/me/qr"),
          api.get("/payments/history"),
        ]);
        setMe(meRes.data);
        setQr(qrRes.data);
        setHistory(histRes.data);
      } catch (err) {
        if (err?.response?.status !== 401) setError("Could not load your account.");
      }
    };
    load();
  }, [navigate]);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!me || !qr) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page">
      <div className="card">
        <h1>MiniPay</h1>
        <h2>Hello, {me.name}</h2>

        <div className="balance">
          <span>Balance</span>
          <strong>{formatMoney(me.balance)}</strong>
        </div>

        <button onClick={() => navigate("/send")}>Send money</button>
        <button className="secondary" onClick={() => navigate("/flagged")}>
          Flagged transactions
        </button>

        <p className="hint">Phone: {me.phone}</p>
        {me.bank_name && <p className="hint">Bank: {me.bank_name}</p>}
        <p className="hint">
          Your MiniPay code: <strong>{me.user_code}</strong>
        </p>

        <img className="qr" src={qr.qr_image} alt="Your MiniPay QR code" />
        <p className="hint" style={{ textAlign: "center" }}>
          Others can scan this QR to pay you.
        </p>

        <h3>Recent transactions</h3>
        {history.length === 0 && <p className="hint">No transactions yet.</p>}
        <div className="txn-list">
          {history.map((t) => {
            const moved = t.status === "COMPLETED"; // only completed payments moved money
            return (
              <div className="txn" key={t.id}>
                <div>
                  <strong>
                    {t.direction === "sent" ? "To " : "From "}
                    {t.other_party}
                  </strong>
                  <div className="hint">
                    {formatTime(t.created_at)} ·{" "}
                    <span className={moved ? "" : "tag bad"}>{t.status}</span>
                    {t.note ? ` · ${t.note}` : ""}
                  </div>
                </div>
                <div
                  className={
                    !moved ? "amt void" : t.direction === "sent" ? "amt out" : "amt in"
                  }
                >
                  {moved ? (t.direction === "sent" ? "-" : "+") : ""}
                  {formatMoney(t.amount)}
                </div>
              </div>
            );
          })}
        </div>

        <button className="secondary" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}