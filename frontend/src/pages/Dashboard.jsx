import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [qr, setQr] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, qrRes] = await Promise.all([
          api.get("/auth/me"),
          api.get("/auth/me/qr"),
        ]);
        setMe(meRes.data);
        setQr(qrRes.data);
      } catch (err) {
        if (err?.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        } else {
          setError("Could not load your account.");
        }
      }
    };
    load();
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("token");
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
          <strong>₹{me.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
        </div>

        <p className="hint">Phone: {me.phone}</p>
        <p className="hint">
          Your MiniPay code: <strong>{me.user_code}</strong>
        </p>

        <img className="qr" src={qr.qr_image} alt="Your MiniPay QR code" />
        <p className="hint">Others can scan this QR to pay you.</p>

        <button disabled title="Coming in the next step">Send money (coming soon)</button>
        <button className="secondary" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}