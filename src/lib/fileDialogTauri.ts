// Only dynamically imported under Tauri. Picks a path via the OS-native save/open dialog (plugin-dialog),
// then delegates the actual file I/O to Rust-side custom commands (read/write_text_file).
// The caller (fileDialog.ts) only imports this module when isTauri, so it never lands in the web bundle.
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { t } from "./i18n";

const FILTERS = [{ name: t("fileDialog.backupFilter"), extensions: ["json"] }];

// pick a path via the OS save dialog and write it out on the Rust side. returns false if cancelled
export async function tauriSaveTextFile(defaultName: string, contents: string): Promise<boolean> {
  const path = await save({ defaultPath: defaultName, filters: FILTERS });
  if (!path) return false;
  await invoke("write_text_file", { path, contents });
  return true;
}

// pick a file via the OS open dialog and read it on the Rust side. returns null if cancelled
export async function tauriOpenTextFile(): Promise<{ name: string; text: string } | null> {
  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  if (typeof path !== "string") return null;
  const text = await invoke<string>("read_text_file", { path });
  return { name: path.split(/[/\\]/).pop() || "backup.json", text };
}
