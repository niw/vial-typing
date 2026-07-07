import "./GuidedPanel.css";
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
import { t } from "../lib/i18n";
import { invalidate } from "../lib/store";
import { drawKeyChart } from "./keyChartDraw";

const COURSES: [CourseId, string][] = [
  ["en", t("guided.courseEn")],
  ["jp", t("guided.courseJp")],
  ["sym", t("guided.courseSym")],
];

export function GuidedPanel() {
  // Skip rendering and derived computations while hidden (this rides on the per-keystroke full re-render)
  if (!engine.guided) return null;
  const course = guided.courses[guided.course];
  const letterFocus = guidedFocusOf(course.letters);
  const symbolFocus = course.symbols ? guidedFocusOf(course.symbols) : null;
  const parts = [];
  if (letterFocus) parts.push(t("guided.focusLetter", { key: letterFocus.toUpperCase() }));
  if (symbolFocus) parts.push(t("guided.focusSymbol", { sym: symbolFocus }));
  const selected = guidedSelectedKey();
  return (
    <div id="guided">
      <div className="guided-head">
        <span className="title">{t("guided.headTitle")}</span>
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
        <span id="guidedStatus">{parts.length ? parts.join(t("guided.sep")) : t("guided.allUnlocked")}</span>
        <button
          type="button"
          id="btnGuidedReset"
          title={t("guided.resetTitle")}
          disabled={!guided.results.length}
          onClick={() => {
            if (!confirm(t("guided.resetConfirm"))) return;
            guidedReset();
          }}
        >
          {t("guided.resetButton")}
        </button>
      </div>
      <div id="keyset">
        {guidedCourseTracks().map((track, trackIndex) => (
          <div className="keyrow" key={trackIndex === 0 ? "letters" : "symbols"}>
            {track.map((key) => (
              <GKeyChip
                key={key.ch}
                guidedKey={key}
                isSelected={key === selected}
                isPinned={key.ch === guided.selected}
              />
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

function GKeyChip({
  guidedKey: key,
  isSelected,
  isPinned,
}: {
  guidedKey: GuidedKey;
  isSelected: boolean;
  isPinned: boolean;
}) {
  const classes = ["gkey"];
  if (!key.included) classes.push("locked");
  if (key.focused) classes.push("focused");
  if (isSelected) classes.push("selected");
  if (isPinned) classes.push("pinned"); // the user pinned this cell (vs. auto-following the last-typed/focus key)
  const colored = key.included && key.confidence != null;
  if (colored) classes.push("colored");
  const name = key.ch.toUpperCase();
  const title = key.included
    ? key.confidence == null
      ? t("guided.chipUnmeasured", { name })
      : t("guided.chipConfidence", { name, pct: Math.round(key.confidence * 100) })
    : t("guided.chipLocked", { name });
  return (
    <button
      type="button"
      className={classes.join(" ")}
      style={colored ? { background: guidedKeyColor(key.confidence ?? 0) } : undefined}
      title={title}
      onClick={() => {
        // toggle: pin this key on the first click, release back to auto-follow on the second
        guided.selected = guided.selected === key.ch ? null : key.ch;
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
        t("guided.infoLocked")
      ) : key.timeToType == null ? (
        t("guided.infoUnmeasured")
      ) : (
        <>
          {t("guided.infoRecent")}
          <b>{guidedWpm(key.timeToType)} WPM</b>
          {t("guided.infoConfBest", { pct: pct(key.confidence ?? 0) })}
          <b>{guidedWpm(key.bestTimeToType ?? 0)} WPM</b>
          {t("guided.infoBestPct", { pct: pct(key.bestConfidence ?? 0) })}
          {rate != null && t("guided.infoLearnRate", { rate: (rate >= 0 ? "+" : "") + rate.toFixed(1) })}
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
    // Also redraw when the container width changes (sidebar toggle or resize)
    const observer = new ResizeObserver(() => drawKeyChart(canvas, key));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [key]);
  return <canvas id="keyChart" ref={canvasRef} />;
}
