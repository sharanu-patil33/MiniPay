import { useEffect, useState } from "react";
import api from "../api";
import HomeShell from "../components/HomeShell";
import { getSession } from "../session";

const STATS = [
  ["banks", "Banks"],
  ["users", "Users"],
  ["ops_members", "Ops members"],
  ["transactions", "Transactions"],
  ["flagged_cases", "Flagged cases"],
  ["open_cases", "Open cases"],
];

export default function Admin() {
  const { name } = getSession();
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api
      .get("/admin/overview")
      .then((res) => setOverview(res.data))
      .catch(() => {});
  }, []);

  const o = overview;

  const actions = [
    {
      path: "/admin/staff",
      icon: "🧑‍💼",
      label: "Operations team",
      hint: "Create bank ops logins and reset passwords",
      primary: true,
      count: o?.ops_members,
    },
    {
      path: "/admin/banks",
      icon: "🏦",
      label: "Banks",
      hint: "Add banks, turn them on or off",
      count: o?.banks,
    },
    {
      path: "/admin/users",
      icon: "👥",
      label: "Users",
      hint: "Create users and reset passwords",
      count: o?.users,
    },
    {
      path: "/admin/cases",
      icon: "🛡️",
      label: "Flagged cases",
      hint: "Flagged payments from every bank",
      count: o ? `${o.open_cases} open` : undefined,
    },
    {
      path: "/admin/account",
      icon: "👤",
      label: "My account",
      hint: "Your details and password",
    },
  ];

  const stats = o && (
    <div className="hero-stats">
      {STATS.map(([key, label]) => (
        <div className="hero-stat" key={key}>
          <span>{label}</span>
          <strong>{o[key]}</strong>
        </div>
      ))}
    </div>
  );

  return (
    <HomeShell
      name={name}
      badge="Admin console"
      intro={`Hello, ${name || "admin"}. You manage the banks, their operations teams and the users, and you can see every flagged payment.`}
      heroExtra={stats}
      heading="What would you like to manage?"
      actions={actions}
      profilePath="/admin/account"
    />
  );
}