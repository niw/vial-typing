// App-wide redraw notification. State lives in per-module mutable objects;
// calling invalidate() after a change re-renders subscribed React components
import { DEFAULT_STATUS_TEXT } from "./defaultKeyboard";

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

export function invalidate() {
  version++;
  for (const listener of [...listeners]) listener();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion() {
  return version;
}

// Shared UI state (status pill, read log, drop overlay visibility)
export const ui = {
  status: { cls: "", text: DEFAULT_STATUS_TEXT },
  log: [] as string[],
  dropVisible: false,
};

export function setStatus(cls: string, text: string) {
  ui.status = { cls, text };
  invalidate();
}
