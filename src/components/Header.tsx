import "./Header.css";
import { useRef } from "react";
import { engine } from "../lib/engine";
import { connectHID, loadVilText } from "../lib/hid";
import { forgetSavedKeymap, hasSavedKeymap } from "../lib/kb";
import { ui } from "../lib/store";

export function Header() {
  const fileRef = useRef<HTMLInputElement>(null);
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
          if (f) f.text().then((t) => loadVilText(t, f.name));
          input.value = "";
        }}
      />
    </header>
  );
}
