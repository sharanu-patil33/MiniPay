import { Navigate, Route, Routes } from "react-router-dom";
import "./home.css";
import "./staff.css";
import "./pin.css";
import LoadingBar from "./components/LoadingBar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import SendMoney from "./pages/SendMoney";
import SetPin from "./pages/SetPin";
import Flagged from "./pages/Flagged";
import Admin from "./pages/Admin";
import AdminSection from "./pages/AdminSection";
import Ops from "./pages/Ops";
import OpsSection from "./pages/OpsSection";
import Scan from "./pages/Scan";
import Balance from "./pages/Balance";
import History from "./pages/History";
import Profile from "./pages/Profile";
import { getSession, homePathFor } from "./session";

// Only the listed roles may open the page; everyone else is sent to their own home page.
function Protected({ roles, children }) {
  const { token, role } = getSession();
  if (!token) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to={homePathFor(role)} replace />;
  return children;
}

function Home() {
  const { token, role } = getSession();
  return <Navigate to={token ? homePathFor(role) : "/login"} replace />;
}

const USER = ["USER"];
const OPS = ["OPS"];
const ADMIN = ["ADMIN"];

function App() {
  return (
    <>
      <LoadingBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/dashboard" element={<Protected roles={USER}><Dashboard /></Protected>} />
        <Route path="/scan" element={<Protected roles={USER}><Scan /></Protected>} />
        <Route path="/send" element={<Protected roles={USER}><SendMoney /></Protected>} />
        <Route path="/pin" element={<Protected roles={USER}><SetPin /></Protected>} />
        <Route path="/balance" element={<Protected roles={USER}><Balance /></Protected>} />
        <Route path="/history" element={<Protected roles={USER}><History /></Protected>} />
        <Route path="/flagged" element={<Protected roles={USER}><Flagged /></Protected>} />
        <Route path="/profile" element={<Protected roles={USER}><Profile /></Protected>} />

        <Route path="/ops" element={<Protected roles={OPS}><Ops /></Protected>} />
        <Route path="/ops/:section" element={<Protected roles={OPS}><OpsSection /></Protected>} />

        <Route path="/admin" element={<Protected roles={ADMIN}><Admin /></Protected>} />
        <Route path="/admin/:section" element={<Protected roles={ADMIN}><AdminSection /></Protected>} />

        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

export default App;