import "./ResultDialog.css";
import { useEffect, useRef } from "react";
import { engine } from "../lib/engine";

export function ResultDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const result = engine.result;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (result && !dialog.open) dialog.showModal();
    else if (!result && dialog.open) dialog.close();
  }, [result]);
  return (
    <dialog
      id="resultDlg"
      ref={ref}
      onClose={() => {
        if (engine.result) engine.closeResult();
      }}
    >
      <h2 id="rTitle" style={{ fontSize: "18px", textAlign: "center" }}>
        {result?.unlimited ? "🎉 おつかれさま！" : "🎉 タイムアップ！"}
      </h2>
      <div className="score-hero">
        <div className="rank" id="rRank">
          {result?.rank ?? "A"}
        </div>
        <div className="num" id="rScore">
          {(result?.score ?? 0).toLocaleString()}
        </div>
        <div className="unit">pt</div>
      </div>
      <div className="score-formula">スコア = 正解打鍵×10 ＋ ワード×100 ＋ 最大コンボ×30 − ミス×20</div>
      <div id="rUnlock" hidden={!result?.unlocked.length}>
        {result?.unlocked.length
          ? "🔓 新しいキーを解放: " + result.unlocked.map((ch) => ch.toUpperCase()).join(" ")
          : ""}
      </div>
      <div className="result-grid">
        <div>
          <b id="rWpm">{result?.wpm ?? 0}</b>
          <span>WPM</span>
        </div>
        <div>
          <b id="rAcc">{result?.acc ?? "0%"}</b>
          <span>正確率</span>
        </div>
        <div>
          <b id="rWords">{result?.words ?? 0}</b>
          <span>入力ワード数</span>
        </div>
        <div>
          <b id="rCombo">{result?.maxCombo ?? 0}</b>
          <span>最大コンボ</span>
        </div>
        <div>
          <b id="rMiss">{result?.miss ?? 0}</b>
          <span>ミス数</span>
        </div>
        <div>
          <b id="rBonus">+{result?.bonusTotal ?? 0}s</b>
          <span>獲得ボーナス</span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          className="primary"
          id="btnAgain"
          onClick={() => {
            engine.closeResult();
            engine.start();
          }}
        >
          もう一度
        </button>
      </div>
      <div style={{ textAlign: "center", fontSize: "12px", color: "var(--dim)", marginTop: "12px" }}>
        ESCキーでメニューに戻る
      </div>
    </dialog>
  );
}
