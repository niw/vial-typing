import "./ResultDialog.css";
import { useEffect, useRef } from "react";
import { engine } from "../lib/engine";
import { t } from "../lib/i18n";

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
        {result?.unlimited ? t("result.titleDone") : t("result.titleTimeUp")}
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
      <div className="score-formula">{t("result.scoreFormula")}</div>
      <div id="rUnlock" hidden={!result?.unlocked.length}>
        {result?.unlocked.length
          ? t("result.unlock", { keys: result.unlocked.map((ch) => ch.toUpperCase()).join(" ") })
          : ""}
      </div>
      <div className="result-grid">
        <div>
          <b id="rWpm">{result?.wpm ?? 0}</b>
          <span>WPM</span>
        </div>
        <div>
          <b id="rAcc">{result?.acc ?? "0%"}</b>
          <span>{t("result.accuracy")}</span>
        </div>
        <div>
          <b id="rWords">{result?.words ?? 0}</b>
          <span>{t("result.wordsTyped")}</span>
        </div>
        <div>
          <b id="rCombo">{result?.maxCombo ?? 0}</b>
          <span>{t("result.maxCombo")}</span>
        </div>
        <div>
          <b id="rMiss">{result?.miss ?? 0}</b>
          <span>{t("result.missCount")}</span>
        </div>
        <div>
          <b id="rBonus">+{result?.bonusTotal ?? 0}s</b>
          <span>{t("result.bonusEarned")}</span>
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
          {t("result.again")}
        </button>
      </div>
      <div style={{ textAlign: "center", fontSize: "12px", color: "var(--dim)", marginTop: "12px" }}>
        {t("result.escHint")}
      </div>
    </dialog>
  );
}
