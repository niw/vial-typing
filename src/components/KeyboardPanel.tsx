import "./KeyboardPanel.css";
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { currentExpected } from "../lib/hint";
import { t } from "../lib/i18n";
import { effKey, FINGER_NAMES, fingerFor, type Hint, KB, type KeyPos } from "../lib/kb";
import { K_NONE, legendFor, shiftedSub } from "../lib/keycodes";
import { settings } from "../lib/settings";
import { invalidate, ui } from "../lib/store";

// Static JSX lives at module level to avoid recreating it on every render
const colorLegend = (
  <div className="legend">
    <span>
      <i className="lt" />
      {t("keyboard.legendPressKey")}
    </span>
    <span>
      <i className="ls" />
      {t("keyboard.legendWithShift")}
    </span>
    <span>
      <i className="ll" />
      {t("keyboard.legendWithLayer")}
    </span>
  </div>
);

const usageNote = (
  <div className="note">
    {t("keyboard.bullet")}
    <b>{t("keyboard.noteReadLabel")}</b>
    {t("keyboard.noteRead")}
    <br />
    {t("keyboard.bullet")}
    {t("keyboard.noteFallbackPre")}
    <code>vial.json</code>
    {t("keyboard.noteFallbackMid")}
    <a href="https://vial.rocks" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
      Vial
    </a>
    {t("keyboard.noteFallbackMid2")}
    <code>.vil</code>
    {t("keyboard.noteFallbackPost")}
    <br />
    {t("keyboard.bullet")}
    {t("keyboard.noteImePre")}
    <b>{t("keyboard.noteImeBold")}</b>
    {t("keyboard.noteImePost")}
  </div>
);

const placeholder = (
  <div id="kb" style={{ width: "auto", height: "auto" }}>
    <div className="kb-placeholder">
      {t("keyboard.placeholderTitle")}
      <br />
      <span>
        {t("keyboard.placeholderBody1")}
        <br />
        {t("keyboard.placeholderBody2")}
      </span>
    </div>
  </div>
);

export function KeyboardPanel() {
  return (
    <section className="panel">
      <div className="kb-head">
        <div className="title">{t("keyboard.headTitle")}</div>
        <div className="layertabs" id="layertabs">
          {Array.from({ length: KB.layerCount }, (_, i) => (
            <button
              type="button"
              key={i}
              className={i === KB.viewLayer ? "active" : ""}
              onClick={() => {
                KB.viewLayer = i;
                invalidate();
              }}
            >
              L{i}
            </button>
          ))}
        </div>
      </div>
      <Keyboard />
      {colorLegend}
      <DebugLog />
      {usageNote}
    </section>
  );
}

// Highlight class and press order for the hint key (derived, equivalent to the old paintHint)
function highlightMap(hint: Hint | null) {
  const map = new Map<string, { cls: string; order: number }>();
  if (!hint) return map;
  const shiftFirst = hint.shiftKey?.fromBase && hint.layerKey;
  const mark = (pos: KeyPos | null, cls: string, order: number) => {
    if (pos) map.set(pos.r + "," + pos.c, { cls, order });
  };
  let n = 1;
  if (shiftFirst) {
    // Shift only exists before the layer switch
    mark(hint.shiftKey, "hl-shift", n++); // -> press & hold Shift first,
    mark(hint.layerKey, "hl-layer", n++); //    then the layer key
  } else {
    if (hint.layerKey) mark(hint.layerKey, "hl-layer", n++);
    if (hint.shiftKey) mark(hint.shiftKey, "hl-shift", n++);
  }
  mark(hint.key, "hl-target", n > 1 ? n : 0);
  return map;
}

function Keyboard() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(1000);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setAvail(el.clientWidth || 1000);
    });
    observer.observe(el);
    setAvail(el.clientWidth || 1000);
    return () => observer.disconnect();
  }, []);

  const { hint } = currentExpected();
  const jis = settings.outMode === "jis";
  // The keyboard doesn't change on every timer-tick re-render, so only rebuild it
  // when the input (hint), keymap, layer, or width changes
  const board = useMemo(() => {
    if (!KB.layerCount) return placeholder;

    let maxX = 0,
      maxY = 0,
      minX = 99,
      minY = 99;
    for (const k of KB.physKeys) {
      maxX = Math.max(maxX, k.x + k.w);
      maxY = Math.max(maxY, k.y + k.h + 0.6);
      minX = Math.min(minX, k.x);
      minY = Math.min(minY, k.y);
    }
    const pad = 0.25;
    // Dynamically compute the unit (--u) so the whole keyboard fits the container width (max 52px)
    const spanX = maxX - minX + pad * 2 || 1;
    const U = Math.max(14, Math.min(52, avail / spanX));
    const gap = 3;
    const highlights = highlightMap(hint);
    const alt = hint?.alt ?? null;
    const altKey = alt && alt.layer === KB.viewLayer ? alt.key.r + "," + alt.key.c : null;

    return (
      <div
        id="kb"
        style={
          {
            width: (maxX - minX + pad * 2) * U + "px",
            height: (maxY - minY + pad * 2) * U + "px",
            "--u": U + "px",
          } as React.CSSProperties
        }
      >
        {KB.physKeys.map((k) => {
          const rc = k.row + "," + k.col;
          const keyDef = (KB.layers[KB.viewLayer]?.[k.row] ? KB.layers[KB.viewLayer][k.row][k.col] : null) || K_NONE;
          const show = keyDef.t === "trans" ? effKey(KB.viewLayer, k.row, k.col) : keyDef;
          const sub = shiftedSub(show, jis);
          const legend = legendFor(show, jis);
          const hl = highlights.get(rc);
          const classes = ["key"];
          if (keyDef.t === "trans" || keyDef.t === "none") classes.push("dim");
          if (hl) classes.push(hl.cls);
          if (altKey === rc && hl?.cls !== "hl-target") classes.push("hl-alt");
          const finger = hl ? fingerFor(k.row, k.col) : null;
          return (
            <div
              key={rc}
              className={classes.join(" ")}
              style={{
                left: (k.x - minX + pad) * U + gap / 2 + "px",
                top: (k.y - minY + pad) * U + gap / 2 + "px",
                width: k.w * U - gap + "px",
                height: k.h * U - gap + "px",
                ...(k.r
                  ? {
                      transformOrigin: (k.rx - k.x) * U + "px " + (k.ry - k.y) * U + "px",
                      transform: "rotate(" + k.r + "deg)",
                    }
                  : {}),
              }}
              {...(hl?.order ? { "data-order": hl.order } : {})}
            >
              {sub ? <span className="sub">{sub}</span> : null}
              {legend.split("\n").map((line, i) => (
                <Fragment key={line + String(i)}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
              {finger ? (
                <i className="fingertag" title={FINGER_NAMES[finger]}>
                  {finger}
                </i>
              ) : null}
            </div>
          );
        })}
      </div>
    );
    // KB is mutable, but layers/physKeys/layerCount get a new reference whenever they're replaced
  }, [hint, jis, avail, KB.physKeys, KB.layers, KB.layerCount, KB.viewLayer]);

  return (
    <div id="kbwrap" ref={wrapRef}>
      {board}
    </div>
  );
}

function DebugLog() {
  return (
    <details className="note" id="dbgwrap" style={{ marginTop: "12px" }}>
      <summary style={{ cursor: "pointer" }}>{t("keyboard.debugSummary")}</summary>
      <button
        type="button"
        id="btnDefDl"
        style={{ marginTop: "6px", fontSize: "11px", padding: "4px 10px" }}
        onClick={() => {
          if (!window.lastDefJson) {
            alert(t("keyboard.noDefAlert"));
            return;
          }
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([window.lastDefJson], { type: "application/json" }));
          a.download = "vial.json";
          a.click();
        }}
      >
        {t("keyboard.saveDefBtn")}
      </button>
      <pre
        id="dbglog"
        className="mono"
        style={{
          whiteSpace: "pre-wrap",
          fontSize: "11px",
          background: "var(--panel2)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "8px",
          marginTop: "6px",
        }}
      >
        {ui.log.length ? ui.log.join("\n") : t("keyboard.emptyLog")}
      </pre>
    </details>
  );
}
