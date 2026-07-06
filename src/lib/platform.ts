// 実行環境の判定。Tauri(WKWebView)内かどうかを __TAURI_INTERNALS__ の有無で見る。
// これを見てTauri専用モジュールを動的importするので、webバンドルには@tauri-apps/*が入らない
export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
