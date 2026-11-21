export function saveSession(data) {
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("role", data.role || "USER");
  localStorage.setItem("name", data.name || "");
  localStorage.setItem("bank_name", data.bank_name || "");
}

export function getSession() {
  return {
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role") || "USER",
    name: localStorage.getItem("name") || "",
    bankName: localStorage.getItem("bank_name") || "",
  };
}

export function clearSession() {
  ["token", "role", "name", "bank_name"].forEach((k) => localStorage.removeItem(k));
}

export function homePathFor(role) {
  if (role === "ADMIN") return "/admin";
  if (role === "OPS") return "/ops";
  return "/dashboard";
}