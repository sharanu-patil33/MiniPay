import { useEffect, useState } from "react";
import api from "../api";
import StaffBar from "../components/StaffBar";
import Cases from "../components/Cases";
import ChangePassword from "../components/ChangePassword";
import BanksPanel from "../components/admin/BanksPanel";
import StaffPanel from "../components/admin/StaffPanel";
import UsersPanel from "../components/admin/UsersPanel";
import { getSession } from "../session";

const TABS = [
  ["banks", "Banks"],
  ["staff", "Operations team"],
  ["users", "Users"],
  ["cases", "Flagged cases"],
  ["account", "My account"],
];

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
  const [tab, setTab] = useState("banks");
  const [overview, setOverview] = useState(null);
  const [version, setVersion] = useState(0);

  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    api
      .get("/admin/overview")
      .then((res) => setOverview(res.data))
      .catch(() => {});
  }, [version]);

  return (
    <div className="page top">
      <div className="card wide">
        <StaffBar title="Admin" subtitle={name} />

        {overview && (
          <div className="stats">
            {STATS.map(([key, label]) => (
              <div className="stat" key={key}>
                <span>{label}</span>
                <strong>{overview[key]}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="tabs">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              className={`tab ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "banks" && <BanksPanel onChanged={refresh} />}
        {tab === "staff" && <StaffPanel onChanged={refresh} />}
        {tab === "users" && <UsersPanel onChanged={refresh} />}
        {tab === "cases" && <Cases showBank />}
        {tab === "account" && <ChangePassword />}
      </div>
    </div>
  );
}