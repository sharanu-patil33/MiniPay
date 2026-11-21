import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import api, { getErrorMessage } from "../api";
import { decodeQrFromFile } from "../qr";

export default function Scan() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const busyRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState("");

  // Looks the scanned code up and opens the amount screen for that user
  const handleCode = useCallback(
    async (text) => {
      try {
        const res = await api.get(`/users/by-code/${encodeURIComponent(text)}`);
        navigate("/send", { state: { receiver: res.data } });
        return true;
      } catch (err) {
        setError(err?.response ? getErrorMessage(err) : "This QR code is not a MiniPay code");
        return false;
      }
    },
    [navigate]
  );

  const handleRef = useRef(handleCode);
  handleRef.current = handleCode;

  useEffect(() => {
    let stream = null;
    let frame = null;
    let stopped = false;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, {
          inversionAttempts: "dontInvert",
        });
        if (code && code.data) {
          busyRef.current = true;
          handleRef.current(code.data).then((ok) => {
            // After a bad code, wait a moment before scanning again
            if (!ok) setTimeout(() => (busyRef.current = false), 2000);
          });
        }
      }
      frame = requestAnimationFrame(tick);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not available in this browser. Upload a QR image instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setCameraOn(true);
        tick();
      } catch {
        setError("Could not open the camera (permission denied or no camera). Upload a QR image instead.");
      }
    };

    start();

    return () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const text = await decodeQrFromFile(file);
      await handleCode(text);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="subhead">
          <h2>Scan QR</h2>
          <button className="secondary small" onClick={() => navigate("/dashboard")}>
            Back
          </button>
        </div>

        <div className="scanner">
          <video ref={videoRef} playsInline muted />
          {cameraOn && (
            <>
              <div className="scan-frame" />
              <div className="scan-line" />
            </>
          )}
          {!cameraOn && !error && <div className="scanner-wait">Starting camera...</div>}
        </div>

        <p className="hint small" style={{ textAlign: "center" }}>
          Point the camera at a MiniPay QR code.
        </p>

        {error && <p className="error">{error}</p>}

        <div className="or">or</div>
        <label className="file-button">
          Upload a QR code image
          <input type="file" accept="image/*" onChange={handleUpload} hidden />
        </label>

        <button className="secondary" onClick={() => navigate("/send")}>
          Search by name or number instead
        </button>
      </div>
    </div>
  );
}