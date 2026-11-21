import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import ChangePassword from "./ChangePassword";
import { clearSession } from "../session";

export default function StaffAccount() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/auth/staff/me")
      .then((res) => setMe(res.data))
      .catch((err) => {
        if (err?.response?.status !== 401) setError("Could not load your account.");
      });
  }, []);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  if (error) return <p className="error">{error}</p>;
  if (!me) return <p className="hint">Loading...</p>;

  return (
    <div className="account-box">
      <div className="profile-avatar">{me.name.charAt(0).toUpperCase()}</div>
      <h2 className="profile-name">{me.name}</h2>

      <div>
        <div className="row">
          <span>Username</span>
          <span>{me.username}</span>
        </div>
        <div className="row">
          <span>Role</span>
          <span>{me.role === "ADMIN" ? "Admin" : "Bank operations"}</span>
        </div>
        <div className="row">
          <span>Bank</span>
          <span>{me.bank_name || "All banks"}</span>
        </div>
      </div>

      <ChangePassword />

      <button className="secondary" onClick={logout}>Log out</button>
    </div>
  );
}