import { useEffect, useState } from "react";
import { subscribeLoading } from "../api";

// Thin animated bar at the top of the screen while any request is running.
export default function LoadingBar() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timer = null;

    const unsubscribe = subscribeLoading((busy) => {
      if (busy) {
        // Only show for requests slower than 150 ms, so quick ones do not flicker
        if (!timer) timer = setTimeout(() => setActive(true), 150);
      } else {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        setActive(false);
      }
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <div className={`loadbar ${active ? "active" : ""}`} />;
}