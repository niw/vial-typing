import "./Header.css";
import { useRef } from "react";
import { downloadBackup, loadFileText } from "../lib/backup";
import { engine } from "../lib/engine";
import { connectHID } from "../lib/hid";
import { forgetSavedKeymap, hasSavedKeymap } from "../lib/kb";
import { ui } from "../lib/store";

export function Header() {
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  return (
    <header>
      <h1>
        Vial <span>Typing</span>
      </h1>
      <div className="sub">Vial対応キーボードのレイアウトとキーマップを読み取って練習</div>
      <div className="actions">
        <div id="status" className={ui.status.cls}>
          {ui.status.text}
        </div>
        <button type="button" id="btnConnect" className="primary" onClick={() => void connectHID()}>
          🔌 キーボードから読み取る
        </button>
        <button type="button" id="btnVil" onClick={() => fileRef.current?.click()}>
          📄 .vilを開く
        </button>
        <button
          type="button"
          id="btnSave"
          title="キーマップ・練習記録・設定をファイルに保存"
          onClick={() => downloadBackup()}
        >
          💾 保存
        </button>
        <button
          type="button"
          id="btnRestore"
          title="保存したキーマップ・練習記録・設定をファイルから復元"
          onClick={() => backupRef.current?.click()}
        >
          📂 復元
        </button>
        <button
          type="button"
          id="btnForget"
          title="保存したレイアウト・キーマップを消して未読込に戻す"
          hidden={!hasSavedKeymap()}
          onClick={() => {
            forgetSavedKeymap();
            engine.idle();
          }}
        >
          🗑 キーマップを消す
        </button>
      </div>
      <input
        type="file"
        id="vilFile"
        accept=".vil,application/json"
        hidden
        ref={fileRef}
        onChange={(e) => {
          const input = e.currentTarget;
          const f = input.files?.[0];
          if (f) f.text().then((t) => loadFileText(t, f.name));
          input.value = "";
        }}
      />
      <input
        type="file"
        id="backupFile"
        accept=".json,application/json"
        hidden
        ref={backupRef}
        onChange={(e) => {
          const input = e.currentTarget;
          const f = input.files?.[0];
          if (f) f.text().then((t) => loadFileText(t, f.name));
          input.value = "";
        }}
      />
    </header>
  );
}
