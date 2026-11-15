export function formatMoney(value) {
  return "₹" + Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

// The backend sends UTC times without a "Z", so add it before converting to local time.
export function formatTime(value) {
  if (!value) return "";
  const hasZone = /Z|[+-]\d\d:\d\d$/.test(value);
  const date = new Date(hasZone ? value : value + "Z");
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}