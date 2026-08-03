import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getUpdateSnapshot,
  subscribeToUpdate,
} from "../sw-update-store";
import styles from "./UpdateNotification.module.css";

const AUTO_DISMISS_MS = 30_000;

export function UpdateNotification() {
  const updateAvailable = useSyncExternalStore(
    subscribeToUpdate,
    getUpdateSnapshot,
    getUpdateSnapshot,
  );

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!updateAvailable) {
      setDismissed(false);
      return;
    }
    const timer = window.setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [updateAvailable]);

  if (!updateAvailable || dismissed) return null;

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
