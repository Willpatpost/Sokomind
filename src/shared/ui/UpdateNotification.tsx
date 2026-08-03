import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getUpdateSnapshot,
  subscribeToUpdate,
} from "../sw-update-store";
import styles from "./UpdateNotification.module.css";

const AUTO_DISMISS_MS = 30_000;

function UpdateBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  return (
    <aside
      className={styles.banner}
      role="status"
      aria-live="polite"
    >
      <span className={styles.message}>
        A new version of Sokomind is available.
      </span>
      <button
        className={styles.reload}
        onClick={() => location.reload()}
      >
        Reload
      </button>
      <button
        className={styles.dismiss}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update notification"
      >
        &times;
      </button>
    </aside>
  );
}

export function UpdateNotification() {
  const updateAvailable = useSyncExternalStore(
    subscribeToUpdate,
    getUpdateSnapshot,
    getUpdateSnapshot,
  );

  if (!updateAvailable) return null;

  return <UpdateBanner />;
}
