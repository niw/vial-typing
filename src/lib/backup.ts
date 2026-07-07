// Writes the current state (keymap, practice records, settings) to a file and reads it back.
// Since localStorage is isolated per origin (not shared between the web and Tauri builds, or across browsers),
// this serves as a backup mechanism for moving state across devices/browsers
import { engine } from "./engine";
import { openTextFileTauri, saveTextFile } from "./fileDialog";
import { guided, guidedImport, guidedRefreshJpCourse, guidedResultsSnapshot } from "./guided";
import { loadVilText } from "./hid";
import { charCache, importKeymap, KB, keymapSnapshot } from "./kb";
import { applyRomajiStyle } from "./romaji";
import { settings, settingsImport, settingsSnapshot } from "./settings";
import { setStatus } from "./store";

const BACKUP_APP = "vial-typing";
const BACKUP_VERSION = 1;

interface BackupFile {
  app: string;
  kind: "backup";
  version: number;
  exportedAt: number;
  keymap: ReturnType<typeof keymapSnapshot>;
  guided: { results: ReturnType<typeof guidedResultsSnapshot> } | null;
  settings: ReturnType<typeof settingsSnapshot> | null;
}

function parseBackup(text: string): BackupFile | null {
  try {
    const data = JSON.parse(text);
    return data && data.app === BACKUP_APP && data.kind === "backup" ? data : null;
  } catch {
    return null;
  }
}

// Migrates a loaded backup to the current version, in case the format changes later.
// Unknown newer versions are rejected (to avoid a broken restore on an older app version)
function migrateBackup(data: BackupFile): BackupFile | null {
  const version = typeof data.version === "number" ? data.version : 1; // missing version is treated as the initial format (1)
  if (version > BACKUP_VERSION) return null;
  // When the format changes, branch on version here for stepwise conversion (e.g. if (version < 2) { ...; data.version = 2; })
  return data;
}

// Collects the current state into a JSON string
export function exportBackup(): string {
  const results = guidedResultsSnapshot();
  const backup: BackupFile = {
    app: BACKUP_APP,
    kind: "backup",
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    keymap: keymapSnapshot(),
    guided: results.length ? { results } : null,
    settings: settingsSnapshot(),
  };
  return JSON.stringify(backup);
}

// Download file name: vial-typing-<keyboard name>-YYYYMMDD.json
function backupFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const name = (KB.label || KB.name || "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return [BACKUP_APP, name, date].filter(Boolean).join("-") + ".json";
}

// Saves the current state to a file (browser: download, Tauri: OS save dialog)
export async function saveBackup(): Promise<void> {
  const saved = await saveTextFile(backupFileName(), exportBackup());
  if (saved) setStatus("ok", "✓ 現在の状態をファイルに保存しました");
}

// Imports the contents of a backup file (restoring replaces the current keymap and practice records)
export function importBackup(text: string): boolean {
  const raw = parseBackup(text);
  if (!raw) {
    setStatus("err", "このファイルはVial Typingのバックアップではありません");
    return false;
  }
  const data = migrateBackup(raw);
  if (!data) {
    setStatus("err", "このバックアップは新しいバージョンのVial Typingのものです。アプリを更新してください");
    return false;
  }
  // Only confirm when replacing practice records would erase existing ones (guards against accidental loss)
  const willReplaceRecords = !!(data.guided && Array.isArray(data.guided.results));
  if (willReplaceRecords && guided.results.length) {
    if (!confirm("現在の練習記録を、ファイルの内容で置き換えます。よろしいですか？")) return false;
  }
  const restored: string[] = [];
  // Apply settings first: so things like layer pinning are covered by the layer-count check when the keymap is applied
  if (data.settings && typeof data.settings === "object") {
    settingsImport(data.settings);
    // Recalculation triggered by the settings change: drop the key-hint cache, refresh the romaji table, rebuild the Japanese course
    charCache.clear();
    applyRomajiStyle(settings.romajiStyle);
    guidedRefreshJpCourse();
    restored.push("設定");
  }
  if (data.keymap && importKeymap(data.keymap)) restored.push("キーマップ");
  if (willReplaceRecords) {
    guidedImport(data.guided!.results);
    restored.push("練習記録");
  }
  if (!restored.length) {
    setStatus("err", "取り込める状態がバックアップにありませんでした");
    return false;
  }
  engine.idle(); // reset the run to reflect the new keymap/settings
  // Keep the display order stable regardless of application order
  const label = ["キーマップ", "練習記録", "設定"].filter((part) => restored.includes(part)).join("・");
  setStatus("ok", "✓ " + label + "を復元しました");
  return true;
}

// Dispatch for a dropped/selected file: restore if it's a backup, otherwise read it as .vil / vial.json
export function loadFileText(text: string, name: string) {
  if (parseBackup(text)) importBackup(text);
  else loadVilText(text, name);
}

// Tauri: pick a file via the OS open dialog and restore it (the browser uses <input type=file>)
export async function openBackupDialog(): Promise<void> {
  const file = await openTextFileTauri();
  if (file) loadFileText(file.text, file.name);
}
