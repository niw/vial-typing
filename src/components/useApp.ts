import { useSyncExternalStore } from "react";
import { getVersion, subscribe } from "../lib/store";

// Hook that re-renders on the store's invalidate() (App subscribes to it and re-renders the whole tree)
export function useAppState() {
  return useSyncExternalStore(subscribe, getVersion);
}
