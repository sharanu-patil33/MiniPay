import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    axios
      .get("http://localhost:8000/health")
      .then((res) =>
        setStatus(`Backend: ${res.data.status}, DB: ${res.data.database}`)
      )
      .catch(() => setStatus("Backend not reachable"));
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>MiniPay</h1>
      <p>{status}</p>
    </div>
  );
}

export default App;