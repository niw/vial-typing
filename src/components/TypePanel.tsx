import "./TypePanel.css";
import { engine } from "../lib/engine";
import { currentExpected } from "../lib/hint";
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
    <span className="start-prompt">▶ スタート</span>
    <span className="start-sub">クリック / Space / Enter で開始　・　プレイ中は ESC で戻る</span>
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
      ⚠ このキーマップでは「<b>{dispChar(ch)}</b>」が見つかりません（Enterでスキップ）
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
            <FingerBadge pos={hint.shiftKey} />① Shift を先に押しながら
          </span>
          ＋
          <span className="chip l">
            <FingerBadge pos={hint.layerKey} />② L{hint.layer} キー
          </span>
          ＋
        </>
      ) : (
        <>
          {hint.layerKey && (
            <>
              <span className="chip l">
                <FingerBadge pos={hint.layerKey} />L{hint.layer} キーを押しながら
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
      {alt && <span className="alt">別案: {alt}</span>}
    </>
  );
}

function altText(a: Hint, ch: string) {
  let alt = "";
  if (a.shiftKey?.fromBase && a.layerKey) alt += "Shift先押し＋L" + a.layer + "キー＋";
  else {
    if (a.layerKey) alt += "L" + a.layer + "キー＋";
    if (a.shiftKey) alt += "Shift＋";
  }
  if (!a.layerKey && !a.shiftKey) alt += "そのまま ";
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
      {next ? "次: " + next : ""}
    </div>
  );
}
