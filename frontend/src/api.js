import axios from "axios";
import { clearSession } from "./session";

const api = axios.create({ baseURL: "http://localhost:8000" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token expired or the account was deactivated, go back to the login page.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err?.config?.url || "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/signup");
    if (err?.response?.status === 401 && !isAuthCall) {
      clearSession();
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    return Promise.reject(err);
  }
);

export function getErrorMessage(err) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
    const msg = (first.msg || "Invalid value").replace(/^Value error, /, "");
    return field && field !== "body" ? `${field}: ${msg}` : msg;
  }
  if (err?.response) return "Something went wrong. Please try again.";
  return "Cannot reach the server. Is the backend running?";
}

export default api;