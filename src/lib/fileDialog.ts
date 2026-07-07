// Save/load text files. In the browser this uses a Blob download and <input type=file>;
// Tauri uses the OS's native save/open dialogs (plugin-dialog).
// WKWebView doesn't support Blob downloads, so under Tauri we swap in the native dialogs instead.
// The Tauri implementation is a dynamic import, so @tauri-apps/* never ends up in the web bundle
import { isTauri } from "./platform";

// Write contents out to a file. Returns true if saved, false if canceled
export async function saveTextFile(defaultName: string, contents: string): Promise<boolean> {
  if (isTauri()) {
    const { tauriSaveTextFile } = await import("./fileDialogTauri");
    return tauriSaveTextFile(defaultName, contents);
  }
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

// Pick a file via the OS's open dialog and return its contents (Tauri only; null if canceled).
// The browser uses <input type=file> instead, so this function is never called there
export async function openTextFileTauri(): Promise<{ name: string; text: string } | null> {
  const { tauriOpenTextFile } = await import("./fileDialogTauri");
  return tauriOpenTextFile();
}
