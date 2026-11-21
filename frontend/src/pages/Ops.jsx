import { useEffect, useState } from "react";
import api from "../api";
import HomeShell from "../components/HomeShell";
import { getSession } from "../session";

export default function Ops() {
  const { name, bankName } = getSession();
  const [openCount, setOpenCount] = useState(null);

  useEffect(() => {
    api
      .get("/ops/cases", { params: { status: "OPEN" } })
      .then((res) => setOpenCount(res.data.length))
      .catch(() => {});
  }, []);

  const actions = [
    {
      path: "/ops/cases",
      icon: "shield",
      label: "Flagged cases",
      hint: "Payments assigned to you for review",
      primary: true,
      count: openCount != null ? `${openCount} open` : undefined,
    },
    {
      path: "/ops/account",
      icon: "user",
      label: "My account",
      hint: "Your details and password",
    },
  ];

  const stats = (
    <div className="hero-stats">
      <div className="hero-stat">
        <span>Your bank</span>
        <strong>{bankName || "-"}</strong>
      </div>
      <div className="hero-stat">
        <span>Open cases</span>
        <strong>{openCount ?? "-"}</strong>
      </div>
    </div>
  );

  return (
    <HomeShell
      name={name}
      badge="Bank operations"
      intro={`Hello, ${name || "there"}. Review the flagged payments of ${bankName || "your bank"} that were assigned to you and check the six fraud checks behind each one.`}
      heroExtra={stats}
      heading="What would you like to do?"
      actions={actions}
      profilePath="/ops/account"
    />
  );
}