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

// One random id per browser, kept in localStorage. The fraud engine uses it
// to spot new devices and one device shared by many accounts.
export function getDeviceId() {
  try {
    let id = localStorage.getItem("device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("device_id", id);
    }
    return id;
  } catch {
    return null;
  }
}

// Asks the browser for the current position. Returns null if it is blocked,
// unavailable or too slow, and the fraud engine then scores the location as unknown.
export function getLocation(timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    );
  });
}