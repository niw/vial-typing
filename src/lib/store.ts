// アプリ全体の再描画通知。状態はモジュール別の可変オブジェクトに持ち、
// 変更後に invalidate() を呼ぶと購読中のReactコンポーネントが再描画される
type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

export function invalidate() {
  version++;
  for (const listener of [...listeners]) listener();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion() {
  return version;
}

// 画面共通のUI状態（ステータスピル・読み取りログ・ドロップ表示）
export const ui = {
  status: { cls: "", text: "キーボード未読込" },
  log: [] as string[],
  dropVisible: false,
};

export function setStatus(cls: string, text: string) {
  ui.status = { cls, text };
  invalidate();
}
