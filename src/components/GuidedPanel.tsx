import { useEffect, useRef } from "react";
import { engine } from "../lib/engine";
import {
  type CourseId,
  type GuidedKey,
  guided,
  guidedCourseTracks,
  guidedFocusOf,
  guidedKeyColor,
  guidedLearningRate,
  guidedReset,
  guidedSelectedKey,
  guidedWpm,
} from "../lib/guided";
import { invalidate } from "../lib/store";
import { drawKeyChart } from "./keyChartDraw";

const COURSES: [CourseId, string][] = [
  ["en", "英語"],
  ["jp", "日本語"],
  ["sym", "記号"],
];

export function GuidedPanel() {
  // 非表示中は描画も導出計算もしない（キーストローク毎の全体再描画に乗るため）
  if (!engine.guided) return null;
  const course = guided.courses[guided.course];
  const letterFocus = guidedFocusOf(course.letters);
  const symbolFocus = course.symbols ? guidedFocusOf(course.symbols) : null;
  const parts = [];
  if (letterFocus) parts.push("習得中のキー: " + letterFocus.toUpperCase());
  if (symbolFocus) parts.push("記号: " + symbolFocus);
  const selected = guidedSelectedKey();
  return (
    <div id="guided">
      <div className="guided-head">
        <span className="title">🔓 タイピング履歴に応じてキーが解放され、出題単語が変わります</span>
        <div className="course-tabs">
          {COURSES.map(([id, label]) => (
            <button
              type="button"
              key={id}
              data-course={id}
              className={guided.course === id ? "active" : ""}
              onClick={() => {
                guided.course = id;
                guided.selected = null;
                invalidate();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span id="guidedStatus">{parts.length ? parts.join(" ・ ") : "🎉 すべてのキーを解放しました"}</span>
        <button
          type="button"
          id="btnGuidedReset"
          title="キー習得モードの練習履歴を消して未習得の状態に戻す"
          disabled={!guided.results.length}
          onClick={() => {
            if (!confirm("キー習得モードの練習履歴を消します。よろしいですか？")) return;
            guidedReset();
          }}
        >
          🗑 履歴を消す
        </button>
      </div>
      <div id="keyset">
        {guidedCourseTracks().map((track, trackIndex) => (
          <div className="keyrow" key={trackIndex === 0 ? "letters" : "symbols"}>
            {track.map((key) => (
              <GKeyChip key={key.ch} guidedKey={key} isSelected={key === selected} />
            ))}
          </div>
        ))}
      </div>
      <div className="guided-detail">
        <KeyInfo guidedKey={selected} />
        <KeyChart guidedKey={selected} />
      </div>
    </div>
  );
}

function GKeyChip({ guidedKey: key, isSelected }: { guidedKey: GuidedKey; isSelected: boolean }) {
  const classes = ["gkey"];
  if (!key.included) classes.push("locked");
  if (key.focused) classes.push("focused");
  if (isSelected) classes.push("selected");
  const colored = key.included && key.confidence != null;
  if (colored) classes.push("colored");
  const title = key.included
    ? key.ch.toUpperCase() +
      (key.confidence == null ? "（未計測）" : "（信頼度 " + Math.round(key.confidence * 100) + "%）")
    : key.ch.toUpperCase() + "（未解放）";
  return (
    <button
      type="button"
      className={classes.join(" ")}
      style={colored ? { background: guidedKeyColor(key.confidence ?? 0) } : undefined}
      title={title}
      onClick={() => {
        guided.selected = key.ch;
        invalidate();
      }}
    >
      {key.ch}
    </button>
  );
}

function KeyInfo({ guidedKey: key }: { guidedKey: GuidedKey }) {
  const pct = (c: number) => Math.round(c * 100) + "%";
  const rate = key.included && key.timeToType != null ? guidedLearningRate(key) : null;
  return (
    <div id="keyInfo">
      <b className="gkey-name">{key.ch.toUpperCase()}</b>
      {!key.included ? (
        <> 🔒 未解放：前のキーがすべて目標速度（35 WPM）に達すると解放されます</>
      ) : key.timeToType == null ? (
        <> 未計測：もう少し打鍵データが必要です</>
      ) : (
        <>
          {" 直前 "}
          <b>{guidedWpm(key.timeToType)} WPM</b>
          {"（信頼度 " + pct(key.confidence ?? 0) + "）・自己ベスト "}
          <b>{guidedWpm(key.bestTimeToType ?? 0)} WPM</b>
          {"（" + pct(key.bestConfidence ?? 0) + "）"}
          {rate != null && "・学習率 " + (rate >= 0 ? "+" : "") + rate.toFixed(1) + " WPM/走行"}
        </>
      )}
    </div>
  );
}

function KeyChart({ guidedKey: key }: { guidedKey: GuidedKey }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawKeyChart(canvas, key);
    // コンテナ幅の変化（サイドバー切替やリサイズ）でも再描画する
    const observer = new ResizeObserver(() => drawKeyChart(canvas, key));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [key]);
  return <canvas id="keyChart" ref={canvasRef} />;
}
