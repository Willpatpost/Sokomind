let updateAvailable = false;
const listeners = new Set<() => void>();

function publish(): void {
  for (const listener of listeners) listener();
}

export function notifyUpdateAvailable(): void {
  if (updateAvailable) return;
  updateAvailable = true;
  publish();
}

export function subscribeToUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUpdateSnapshot(): boolean {
  return updateAvailable;
}
