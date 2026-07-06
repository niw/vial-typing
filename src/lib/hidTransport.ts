// HIDトランスポートの抽象。プロトコル処理(hid.ts)はこのインターフェース越しに動くので、
// ブラウザ(WebHID)とTauri(Rust hidapi)を実行時に差し替えられる
export interface HidConnection {
  label: string; // ログ・ステータス表示に使うデバイス名
  vendorId?: number;
  productId?: number;
  command(bytes: number[], timeoutMs: number): Promise<Uint8Array>; // 32B送信→応答1レポート待ち
  close(): Promise<void>;
}

export interface HidTransport {
  available: boolean; // この環境でHIDが使えるか
  open(): Promise<HidConnection | null>; // デバイスを選択して接続。キャンセル時はnull
}

// Tauri(WKWebView)内かどうか。ここでのみTauri実装を動的importするので、
// webバンドルには@tauri-apps/apiが一切含まれない
const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function getHidTransport(): Promise<HidTransport> {
  if (isTauri()) {
    const { tauriHidTransport } = await import("./hidTauri");
    return tauriHidTransport;
  }
  const { webHidTransport } = await import("./hidWeb");
  return webHidTransport;
}
