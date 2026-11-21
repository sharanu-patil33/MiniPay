import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { getSession } from "../session";

const ACTIONS = [
  { path: "/scan", icon: "📷", label: "Scan QR", hint: "Pay by scanning a MiniPay QR code", primary: true },
  { path: "/send", icon: "💸", label: "Send money", hint: "Search by name or phone number" },
  { path: "/balance", icon: "👛", label: "Check balance", hint: "See how much you have" },
  { path: "/history", icon: "🧾", label: "Transactions", hint: "Your payment history" },
  { path: "/flagged", icon: "🛡️", label: "Flagged transactions", hint: "Payments our fraud checks held" },
  { path: "/profile", icon: "👤", label: "Profile", hint: "Your details and your QR code" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [name, setName] = useState(getSession().name);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => setName(res.data.name))
      .catch(() => {});
  }, []);

  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <div className="home">
      <header className="home-top">
        <div className="brand">MiniPay</div>
        <button className="avatar-btn" onClick={() => navigate("/profile")} title="Profile">
          {initial}
        </button>
      </header>

      <main className="home-main">
        <section className="hero">
          <span className="hero-badge">Fast payments · Live fraud protection</span>
          <h1 className="hero-title">Welcome to MiniPay</h1>
          <p>Hello, {name || "there"}. Send money in seconds. Every payment is checked by six fraud checks running at the same time.</p>
          <div className="hero-pills">
            <span>Amount</span>
            <span>Location</span>
            <span>Velocity</span>
            <span>Behavior</span>
            <span>Merchant</span>
            <span>Device / IP</span>
          </div>
        </section>

        <aside className="actions-panel">
          <h3>What would you like to do?</h3>
          {ACTIONS.map((a) => (
            <button
              key={a.path}
              className={`action ${a.primary ? "primary" : ""}`}
              onClick={() => navigate(a.path)}
            >
              <span className="action-icon">{a.icon}</span>
              <span>
                {a.label}
                <small>{a.hint}</small>
              </span>
            </button>
          ))}
        </aside>
      </main>
    </div>
  );
}