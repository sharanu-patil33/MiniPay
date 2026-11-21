import { Navigate, useNavigate, useParams } from "react-router-dom";
import Cases from "../components/Cases";
import StaffAccount from "../components/StaffAccount";

const SECTIONS = {
  cases: { title: "Flagged cases", render: () => <Cases /> },
  account: { title: "My account", render: () => <StaffAccount /> },
};

export default function OpsSection() {
  const { section } = useParams();
  const navigate = useNavigate();
  const config = SECTIONS[section];

  if (!config) return <Navigate to="/ops" replace />;

  return (
    <div className="page top" key={section}>
      <div className="card wide">
        <div className="subhead">
          <h2>{config.title}</h2>
          <button className="secondary small" onClick={() => navigate("/ops")}>
            Back
          </button>
        </div>
        {config.render()}
      </div>
    </div>
  );
}