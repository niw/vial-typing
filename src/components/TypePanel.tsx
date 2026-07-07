import "./TypePanel.css";
import { engine } from "../lib/engine";
import { currentExpected } from "../lib/hint";
import { t } from "../lib/i18n";
import { FINGER_NAMES, fingerFor, type Hint, type KeyPos } from "../lib/kb";
import { dispChar } from "../lib/keycodes";

// The type-line bundle: prompt display, cursor position, input hints, and the next-word queue
export function TypePanel() {
  const jp = engine.running && engine.isJP();
  const item = engine.items[engine.idx];
  return (
    <>
      <div id="wordMeta">{jp && item ? <span className="jp">{item.meta}</span> : null}</div>
      <TypeLine />
      <HintBar />
      <Queue />
    </>
  );
}

// The idle-state prompt is static, so build it once at module level
const startPrompt = (
  <>
    <span className="start-prompt">{t("typePanel.startPrompt")}</span>
    <span className="start-sub">{t("typePanel.startSub")}</span>
  </>
);

function TypeLine() {
  const idle = !engine.running && !engine.counting;
  let content: React.ReactNode;
  if (engine.counting) {
    content = <span className={engine.countdown === "GO!" ? "countdown go" : "countdown"}>{engine.countdown}</span>;
  } else if (!engine.running && engine.notice) {
    content = (
      <span className="rest" style={{ fontSize: "20px" }}>
        {engine.notice}
      </span>
    );
  } else if (!engine.running) {
    content = startPrompt;
  } else {
    let done: string, cur: string, rest: string;
    if (engine.isJP()) {
      const s = engine.jpStrings();
      done = s.done;
      cur = s.rest[0] || "";
      rest = s.rest.slice(1);
    } else {
      done = engine.text.slice(0, engine.pos);
      cur = engine.text[engine.pos] || "";
      rest = engine.text.slice(engine.pos + 1);
    }
    content = (
      <>
        <span className="done">{done}</span>
        <span className={engine.missFlash ? "cur miss" : "cur"}>{cur === " " ? "␣" : cur}</span>
        <span className="rest">{rest}</span>
      </>
    );
  }
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction is handled by document's keydown (Space/Enter)
    // biome-ignore lint/a11y/noStaticElementInteractions: same as above
    <div
      id="typeline"
      className={idle ? "mono idle" : "mono"}
      onClick={() => {
        if (!engine.running && !engine.counting) engine.start();
      }}
    >
      {content}
    </div>
  );
}

// A piano-fingering-style finger-number badge (overlaid on the chip)
function FingerBadge({ pos }: { pos: KeyPos | null }) {
  const finger = pos && fingerFor(pos.r, pos.c);
  if (!finger) return null;
  return (
    <i className="fnum" title={FINGER_NAMES[finger]}>
      {finger}
    </i>
  );
}

function HintBar() {
  const { ch, hint } = currentExpected();
  return <div id="hint">{ch == null ? null : hint ? <HintChips ch={ch} hint={hint} /> : <HintMissing ch={ch} />}</div>;
}

function HintMissing({ ch }: { ch: string }) {
  return (
    <>
      {t("typePanel.hintMissingPre")}
      <b>{dispChar(ch)}</b>
      {t("typePanel.hintMissingPost")}
    </>
  );
}

function HintChips({ ch, hint }: { ch: string; hint: Hint }) {
  const shiftFirst = hint.shiftKey?.fromBase && hint.layerKey;
  const alt = hint.alt ? altText(hint.alt, ch) : null;
  return (
    <>
      {shiftFirst ? (
        <>
          <span className="chip s">
            <FingerBadge pos={hint.shiftKey} />
            {t("typePanel.shiftFirst")}
          </span>
          ＋
          <span className="chip l">
            <FingerBadge pos={hint.layerKey} />
            {t("typePanel.layerOrdered", { layer: hint.layer })}
          </span>
          ＋
        </>
      ) : (
        <>
          {hint.layerKey && (
            <>
              <span className="chip l">
                <FingerBadge pos={hint.layerKey} />
                {t("typePanel.layerHold", { layer: hint.layer })}
              </span>
              ＋
            </>
          )}
          {hint.shiftKey && (
            <>
              <span className="chip s">
                <FingerBadge pos={hint.shiftKey} />
                Shift
              </span>
              ＋
            </>
          )}
        </>
      )}
      <span className="chip t">
        <FingerBadge pos={hint.key} />
        {dispChar(ch)}
      </span>
      {alt && (
        <span className="alt">
          {t("typePanel.altPrefix")}
          {alt}
        </span>
      )}
    </>
  );
}

function altText(a: Hint, ch: string) {
  let alt = "";
  if (a.shiftKey?.fromBase && a.layerKey) alt += t("typePanel.altShiftFirst", { layer: a.layer });
  else {
    if (a.layerKey) alt += t("typePanel.altLayer", { layer: a.layer });
    if (a.shiftKey) alt += t("typePanel.altShift");
  }
  if (!a.layerKey && !a.shiftKey) alt += t("typePanel.altPlain");
  return alt + dispChar(ch);
}

function Queue() {
  const next = engine.running
    ? engine.items
        .slice(engine.idx + 1, engine.idx + 4)
        .map((it) => (it.kana ? it.meta : it.text))
        .join("　")
    : "";
  return (
    <div id="queue" className="mono">
      {next ? t("typePanel.queuePrefix") + next : ""}
    </div>
  );
}
