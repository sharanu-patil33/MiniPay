import { Navigate, useNavigate, useParams } from "react-router-dom";
import Cases from "../components/Cases";
import StaffAccount from "../components/StaffAccount";
import BanksPanel from "../components/admin/BanksPanel";
import StaffPanel from "../components/admin/StaffPanel";
import UsersPanel from "../components/admin/UsersPanel";

const noop = () => {};

const SECTIONS = {
  staff: { title: "Operations team", render: () => <StaffPanel onChanged={noop} /> },
  banks: { title: "Banks", render: () => <BanksPanel onChanged={noop} /> },
  users: { title: "Users", render: () => <UsersPanel onChanged={noop} /> },
  cases: { title: "Flagged cases", render: () => <Cases showBank /> },
  account: { title: "My account", render: () => <StaffAccount /> },
};

export default function AdminSection() {
  const { section } = useParams();
  const navigate = useNavigate();
  const config = SECTIONS[section];

  if (!config) return <Navigate to="/admin" replace />;

  return (
    <div className="page top" key={section}>
      <div className="card wide">
        <div className="subhead">
          <h2>{config.title}</h2>
          <button className="secondary small" onClick={() => navigate("/admin")}>
            Back
          </button>
        </div>
        {config.render()}
      </div>
    </div>
  );
}