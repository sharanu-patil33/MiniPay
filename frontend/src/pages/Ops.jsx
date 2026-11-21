import StaffBar from "../components/StaffBar";
import Cases from "../components/Cases";
import ChangePassword from "../components/ChangePassword";
import { getSession } from "../session";

export default function Ops() {
  const { name, bankName } = getSession();

  return (
    <div className="page top">
      <div className="card wide">
        <StaffBar title="Bank operations" subtitle={bankName} />
        <h2>Welcome, {name}</h2>
        <p className="hint">
          You see the flagged payments of {bankName || "your bank"} that were assigned to you.
          Open a case to see the six fraud checks.
        </p>

        <Cases />

        <details className="flag-item">
          <summary>My account</summary>
          <ChangePassword />
        </details>
      </div>
    </div>
  );
}