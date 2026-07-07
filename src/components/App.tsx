import { useEffect } from "react";
import { loadFileText } from "../lib/backup";
import { engine } from "../lib/engine";
import { currentExpected } from "../lib/hint";
import { t } from "../lib/i18n";
import { KB } from "../lib/kb";
import { isUnlimited } from "../lib/settings";
import { invalidate, ui } from "../lib/store";
import { DevicePicker } from "./DevicePicker";
import { GuidedPanel } from "./GuidedPanel";
import { Header } from "./Header";
import { KeyboardPanel } from "./KeyboardPanel";
import { ResultDialog } from "./ResultDialog";
import { StatBar } from "./StatBar";
import { Toolbar } from "./Toolbar";
import { TypePanel } from "./TypePanel";
import { useAppState } from "./useApp";

export function App() {
  useAppState();

  // Auto-switch the displayed layer to the hint key's layer (side effect of the old refreshHint).
  // Re-evaluated on every keystroke; does not fire from manual layer-tab switches
  const { hint } = currentExpected();
  const strokes = engine.correct + engine.miss;
  useEffect(() => {
    if (hint && hint.layer !== KB.viewLayer) {
      KB.viewLayer = hint.layer;
      invalidate();
    }
  }, [hint, strokes]);

  // Global input: keystrokes and file drops
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (engine.result) return; // the result dialog closes via the native Esc handler
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        // Esc during a run/countdown = back to the pre-start menu
        if (engine.running && isUnlimited()) {
          e.preventDefault();
          engine.finish(); // unlimited mode shows the result and ends
        } else if (engine.running || engine.counting) {
          e.preventDefault();
          engine.idle();
        }
        return;
      }
      if (engine.counting) {
        e.preventDefault(); // ignore input during the 3-2-1 countdown
        return;
      }
      if (!engine.running) {
        // Space / Enter starts a run
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          engine.start();
        }
        return;
      }
      if (e.key === "Enter" && engine.items.length && !currentExpected().hint) {
        e.preventDefault();
        engine.skipChar();
        return;
      }
      if (e.key.length !== 1) return;
      e.preventDefault();
      engine.input(e.key === "¥" ? "\\" : e.key);
    };

    let dragDepth = 0;
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragDepth++;
      ui.dropVisible = true;
      invalidate();
    };
    const onDragLeave = () => {
      if (--dragDepth <= 0) {
        dragDepth = 0;
        ui.dropVisible = false;
        invalidate();
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth = 0;
      ui.dropVisible = false;
      invalidate();
      const f = e.dataTransfer?.files[0];
      if (f) f.text().then((t) => loadFileText(t, f.name));
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <>
      <Header />
      <div className="layout">
        <aside className="panel side">
          <Toolbar />
          <StatBar />
        </aside>
        <div className="main">
          <section className="panel">
            <GuidedPanel />
            <TypePanel />
          </section>
          <KeyboardPanel />
        </div>
      </div>
      <div id="drop" className={ui.dropVisible ? "show" : ""}>
        {t("app.dropText")}
      </div>
      <ResultDialog />
      <DevicePicker />
    </>
  );
}
