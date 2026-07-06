// Tauri時のみ動的importされる。OSネイティブの保存/開くダイアログ(plugin-dialog)で
// パスを選び、実際のファイルI/OはRust側の独自コマンド(read/write_text_file)へ委譲する。
// このモジュールがwebバンドルに入らないよう、呼び出し側(fileDialog.ts)はisTauri時のみimportする
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

const FILTERS = [{ name: "Vial Typing バックアップ", extensions: ["json"] }];

// OS保存ダイアログでパスを選び、Rust側で書き出す。キャンセルでfalse
export async function tauriSaveTextFile(defaultName: string, contents: string): Promise<boolean> {
  const path = await save({ defaultPath: defaultName, filters: FILTERS });
  if (!path) return false;
  await invoke("write_text_file", { path, contents });
  return true;
}

// OS開くダイアログでファイルを選び、Rust側で読み込む。キャンセルでnull
export async function tauriOpenTextFile(): Promise<{ name: string; text: string } | null> {
  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  if (typeof path !== "string") return null;
  const text = await invoke<string>("read_text_file", { path });
  return { name: path.split(/[/\\]/).pop() || "backup.json", text };
}
