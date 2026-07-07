// Detects the runtime environment: whether we're inside Tauri (WKWebView) by checking for __TAURI_INTERNALS__.
// Tauri-only modules are dynamically imported based on this, so @tauri-apps/* never lands in the web bundle.
export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
