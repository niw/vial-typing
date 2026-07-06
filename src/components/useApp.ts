import { useSyncExternalStore } from "react";
import { getVersion, subscribe } from "../lib/store";

// ストアの invalidate() で再描画するためのフック（Appが購読し、ツリー全体を再描画する）
export function useAppState() {
  return useSyncExternalStore(subscribe, getVersion);
}
