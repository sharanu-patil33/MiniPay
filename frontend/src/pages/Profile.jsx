import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { clearSession } from "../session";

export default function Profile() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [qr, setQr] = useState(null);
  const [pinStatus, setPinStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/auth/me"), api.get("/auth/me/qr"), api.get("/pin/status")])
      .then(([meRes, qrRes, pinRes]) => {
        setMe(meRes.data);
        setQr(qrRes.data);
        setPinStatus(pinRes.data);
      })
      .catch((err) => {
        if (err?.response?.status !== 401) setError("Could not load your profile.");
      });
  }, []);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="page">
      <div className="card">
        <div className="subhead">
          <h2>Profile</h2>
          <button className="secondary small" onClick={() => navigate("/dashboard")}>
            Back
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {!me && !error && <p className="hint">Loading...</p>}

        {me && qr && (
          <>
            <div className="profile-avatar">{me.name.charAt(0).toUpperCase()}</div>
            <h2 className="profile-name">{me.name}</h2>

            <div>
              <div className="row">
                <span>Phone</span>
                <span>{me.phone}</span>
              </div>
              <div className="row">
                <span>Bank</span>
                <span>{me.bank_name || "-"}</span>
              </div>
              <div className="row">
                <span>MiniPay code</span>
                <span>{me.user_code}</span>
              </div>
              <div className="row">
                <span>Payment PIN</span>
                <span>{pinStatus?.has_pin ? "Set" : "Not set"}</span>
              </div>
            </div>

            <button onClick={() => navigate("/pin", { state: { next: "/profile" } })}>
              {pinStatus?.has_pin ? "Change PIN" : "Set PIN"}
            </button>

            <img className="qr" src={qr.qr_image} alt="Your MiniPay QR code" />
            <p className="hint small" style={{ textAlign: "center" }}>
              Others can scan this QR to pay you. Right-click it to save the image.
            </p>

            <button className="secondary" onClick={logout}>Log out</button>
          </>
        )}
      </div>
    </div>
  );
}