// テキストファイルの保存/読み込み。ブラウザはBlobダウンロードと<input type=file>、
// TauriはOSネイティブの保存/開くダイアログ(plugin-dialog)を使う。
// WKWebViewはBlobダウンロード非対応なので、Tauri時はネイティブダイアログへ差し替える。
// Tauri実装は動的importなので、webバンドルに@tauri-apps/*は入らない
import { isTauri } from "./platform";

// 内容をファイルに書き出す。保存したらtrue、キャンセルでfalse
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

// OSの開くダイアログでファイルを選び内容を返す(Tauri専用。キャンセルでnull)。
// ブラウザは<input type=file>を使うのでこの関数は呼ばない
export async function openTextFileTauri(): Promise<{ name: string; text: string } | null> {
  const { tauriOpenTextFile } = await import("./fileDialogTauri");
  return tauriOpenTextFile();
}
