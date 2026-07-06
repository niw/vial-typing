// 現在の状態（キーマップ・練習記録・設定）をファイルへ書き出し／読み戻す。
// localStorageはオリジンごとに分離される（web版とTauri版・別ブラウザで非共有）ため、
// 端末やブラウザをまたいで状態を移すバックアップ手段として使う
import { engine } from "./engine";
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

// 将来の形式変更に備え、読み込んだバックアップを現行バージョンへ移行する。
// 未知の新しいバージョンは取り込まない（古い版のアプリで壊れた復元をしないため）
function migrateBackup(data: BackupFile): BackupFile | null {
  const version = typeof data.version === "number" ? data.version : 1; // version未指定は初期形式(1)扱い
  if (version > BACKUP_VERSION) return null;
  // 形式が変わったらここでversionを見て段階的に変換する（例: if (version < 2) { ...; data.version = 2; }）
  return data;
}

// 現在の状態をJSON文字列にまとめる
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

// ダウンロードファイル名: vial-typing-<キーボード名>-YYYYMMDD.json
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

// 現在の状態をファイルとしてダウンロードさせる
export function downloadBackup() {
  const blob = new Blob([exportBackup()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus("ok", "✓ 現在の状態をファイルに保存しました");
}

// バックアップファイルの内容を取り込む（復元は現在のキーマップと練習記録を置き換える）
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
  // 練習記録を置き換えて既存の記録が消えるときだけ確認する（誤操作での消失防止）
  const willReplaceRecords = !!(data.guided && Array.isArray(data.guided.results));
  if (willReplaceRecords && guided.results.length) {
    if (!confirm("現在の練習記録を、ファイルの内容で置き換えます。よろしいですか？")) return false;
  }
  const restored: string[] = [];
  // 設定を先に反映する: レイヤー固定などをキーマップ適用時のレイヤー数チェックに乗せるため
  if (data.settings && typeof data.settings === "object") {
    settingsImport(data.settings);
    // 設定変更に伴う再計算: キー案内キャッシュ破棄・ローマ字表更新・日本語コース再構築
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
  engine.idle(); // 新しいキーマップ・設定を反映して走行を仕切り直す
  // 表示は適用順に依らず一定の並びにする
  const label = ["キーマップ", "練習記録", "設定"].filter((part) => restored.includes(part)).join("・");
  setStatus("ok", "✓ " + label + "を復元しました");
  return true;
}

// ドロップ/ファイル選択の振り分け: バックアップなら復元、それ以外は .vil / vial.json として読む
export function loadFileText(text: string, name: string) {
  if (parseBackup(text)) importBackup(text);
  else loadVilText(text, name);
}
