import { useNavigate } from "react-router-dom";
import { clearSession } from "../session";

export default function StaffBar({ title, subtitle }) {
  const navigate = useNavigate();

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="staffbar">
      <div>
        <h1>MiniPay</h1>
        <div className="hint">
          {title}
          {subtitle ? ` · ${subtitle}` : ""}
        </div>
      </div>
      <button className="secondary small" onClick={logout}>Log out</button>
    </div>
  );
}