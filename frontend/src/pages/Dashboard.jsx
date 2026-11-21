import { useEffect, useState } from "react";
import api from "../api";
import HomeShell from "../components/HomeShell";
import { getSession } from "../session";

const ACTIONS = [
  { path: "/scan", icon: "scan", label: "Scan QR", hint: "Pay by scanning a MiniPay QR code", primary: true },
  { path: "/send", icon: "send", label: "Send money", hint: "Search by name or phone number" },
  { path: "/balance", icon: "wallet", label: "Check balance", hint: "See how much you have" },
  { path: "/history", icon: "receipt", label: "Transactions", hint: "Your payment history" },
  { path: "/flagged", icon: "shield", label: "Flagged transactions", hint: "Payments our fraud checks held" },
  { path: "/profile", icon: "user", label: "Profile", hint: "Your details and your QR code" },
];

export default function Dashboard() {
  const [name, setName] = useState(getSession().name);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => setName(res.data.name))
      .catch(() => {});
  }, []);

  const pills = (
    <div className="hero-pills">
      <span>Amount</span>
      <span>Location</span>
      <span>Velocity</span>
      <span>Behavior</span>
      <span>Merchant</span>
      <span>Device / IP</span>
    </div>
  );

  return (
    <HomeShell
      name={name}
      badge="Fast payments · Live fraud protection"
      intro={`Hello, ${name || "there"}. Send money in seconds. Every payment is checked by six fraud checks running at the same time.`}
      heroExtra={pills}
      heading="What would you like to do?"
      actions={ACTIONS}
      profilePath="/profile"
    />
  );
}