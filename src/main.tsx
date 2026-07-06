// 共通スタイルを最初に読み込み、各コンポーネントのCSSより先にバンドルされる順序を固定する
import "./styles/base.css";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import { guidedLoad, guidedRebuildStats, guidedUpdateKeys } from "./lib/guided";
import { restoreSavedKeymap } from "./lib/kb";

// 起動処理: 履歴と保存済みキーマップを読み込んでから描画する
guidedLoad();
guidedRebuildStats();
guidedUpdateKeys();
restoreSavedKeymap(); // 前回のレイアウト+キーマップがあれば自動復元

createRoot(document.getElementById("root")!).render(<App />);
