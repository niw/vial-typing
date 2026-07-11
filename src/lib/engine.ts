// Practice engine: a state machine for a run. Never touches the DOM; after a state change it calls
// invalidate() to notify React to re-render (the type line, stats, and hints are all derived from state)
import { audio } from "./audio";
import { EN_SENTS, EN_WORDS, JP_SENTS, JP_WORDS, SYM_ITEMS } from "./data";
import {
  type GuidedStep,
  guided,
  guidedBuildPools,
  guidedPoolKey,
  guidedPreview,
  guidedRebuildStats,
  guidedRecordRun,
  guidedUpdateKeys,
} from "./guided";
import { t } from "./i18n";
import { findKeyForChar, KB } from "./kb";
import { type KanaUnit, tokenizeKana } from "./romaji";
import { isUnlimited, settings } from "./settings";
import { invalidate } from "./store";

const COMBO_STEP = 30; // every 30 consecutive hits ...
const COMBO_BONUS = 1; // ... +1 second

// shuffled-bag sampling: every entry appears once before any repeats
const bags: Record<string, unknown[]> = {};
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function drawFrom<T>(list: T[], key: string): T {
  if (!bags[key]?.length) bags[key] = shuffle(list.slice());
  return bags[key].pop() as T;
}

// One practice item: English-type items have text, Japanese items have kana
export interface PracticeItem {
  text?: string;
  kana?: string;
  meta: string;
}

// Result at the end of a run (contents shown in the result dialog)
export interface RunResult {
  score: number;
  rank: string;
  wpm: number;
  acc: string;
  miss: number;
  words: number;
  maxCombo: number;
  bonusTotal: number;
  unlocked: string[];
  unlimited: boolean;
}

export const engine = {
  mode: "en",
  guided: false, // key-mastery mode (a toggle orthogonal to practice mode)
  items: [] as PracticeItem[],
  idx: 0,
  running: false,
  // en/sym
  text: "",
  pos: 0,
  // jp
  units: [] as KanaUnit[],
  unitIdx: 0,
  typed: "",
  softDone: false,
  // stats
  correct: 0,
  miss: 0,
  startTime: 0,
  endTime: 0,
  missFlash: false,
  combo: 0,
  maxCombo: 0,
  words: 0,
  bonusTotal: 0,
  timerId: 0 as ReturnType<typeof setInterval> | number,
  counting: false,
  countdown: null as string | number | null, // 3 → 2 → 1 → "GO!"
  countId: 0 as ReturnType<typeof setInterval> | number,
  notice: null as string | null, // guidance shown when starting without a keyboard loaded
  result: null as RunResult | null, // contents of the result dialog (null = hidden)
  bonusPops: [] as number[], // ids of the +1s popups currently shown
  bonusPopSeq: 0,
  // keystroke records for key-mastery mode
  steps: [] as GuidedStep[],
  previewedSteps: 0, // number of steps already folded into the live preview overlay
  lastInputAt: 0,
  typoPending: false,

  makeItem(mode?: string): PracticeItem {
    mode = mode || this.mode;
    if (mode === "mix") {
      const r = Math.random();
      mode = r < 0.35 ? "en" : r < 0.7 ? "jp" : "sym";
    }
    if (this.guided) {
      if (mode === "jp") {
        const w = drawFrom(guided.words.jp, "g_jp");
        return { kana: w[0], meta: w[1] };
      }
      if (mode === "sym") return { text: drawFrom(guided.words.sym, "g_sym"), meta: "" };
      return { text: drawFrom(guided.words.en, "g_en"), meta: "" };
    }
    if (mode === "en")
      return Math.random() < 0.2
        ? { text: drawFrom(EN_SENTS, "ens"), meta: "" }
        : { text: drawFrom(EN_WORDS, "enw"), meta: "" };
    if (mode === "sym") return { text: drawFrom(SYM_ITEMS, "sym"), meta: "" };
    const w = Math.random() < 0.15 ? drawFrom(JP_SENTS, "jps") : drawFrom(JP_WORDS, "jpw");
    return { kana: w[0], meta: w[1] };
  },

  // whether the *current item* is Japanese (mix mode mixes item types)
  isJP() {
    const it = this.items[this.idx];
    return !!it?.kana;
  },
  fillItems(n: number) {
    for (let i = 0; i < n; i++) this.items.push(this.makeItem());
  },

  resetRunStats() {
    this.correct = 0;
    this.miss = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.words = 0;
    this.bonusTotal = 0;
    this.startTime = 0;
    this.endTime = 0;
    this.missFlash = false;
  },

  // show a 3-2-1 countdown, then start the real run
  start() {
    if (this.counting) return;
    if (!KB.layerCount) {
      this.notice = t("engine.notice");
      invalidate();
      return;
    }
    this.result = null;
    clearInterval(this.timerId);
    this.running = false;
    this.notice = null;
    this.items = [];
    this.resetRunStats();
    this.counting = true;
    let n = 3;
    this.countdown = n;
    audio.play("type");
    invalidate();
    this.countId = setInterval(() => {
      n--;
      if (n > 0) {
        this.countdown = n;
        audio.play("type");
      } else if (n === 0) {
        this.countdown = "GO!";
        audio.play("bonus");
      } else {
        clearInterval(this.countId);
        this.counting = false;
        this.countdown = null;
        this.beginRun();
      }
      invalidate();
    }, 700);
  },

  beginRun() {
    clearInterval(this.timerId);
    if (this.guided) {
      // rebuild the item pool based on the latest mastery status (dropping any leftover preview overlay)
      guided.pending = null;
      guided.lastTyped = null;
      this.previewedSteps = 0;
      guidedRebuildStats();
      guidedUpdateKeys();
      guided.words = guidedBuildPools();
      bags.g_en = bags.g_jp = bags.g_sym = [];
      this.steps = [];
      this.lastInputAt = 0;
      this.typoPending = false;
    }
    this.items = [];
    this.fillItems(20);
    this.idx = 0;
    this.resetRunStats();
    this.startTime = Date.now();
    this.endTime = this.startTime + settings.runSeconds * 1000;
    this.running = true;
    this.timerId = setInterval(() => this.tick(), 100);
    this.loadItem();
    invalidate();
  },

  idle() {
    clearInterval(this.timerId);
    clearInterval(this.countId);
    this.counting = false;
    this.countdown = null;
    this.running = false;
    this.items = [];
    this.notice = null;
    guided.lastTyped = null; // stop following the last-typed key; revert the chart to the focus key
    if (guided.pending) {
      // an aborted run: drop the preview overlay and revert the chart/unlock view to committed data
      guided.pending = null;
      this.previewedSteps = 0;
      guidedRebuildStats();
      guidedUpdateKeys();
    }
    this.resetRunStats();
    invalidate();
  },

  tick() {
    if (!isUnlimited() && this.endTime - Date.now() <= 0) {
      this.finish();
      return;
    }
    if (this.guided && this.steps.length !== this.previewedSteps) {
      this.previewedSteps = this.steps.length;
      const poolKey = guidedPoolKey();
      guidedPreview(this.steps); // live chart + mid-run unlock overlay (also invalidates)
      // the unlock/focus state changed mid-run: rebuild the pools and replace the not-yet-typed items
      // so the newly unlocked or newly focused key appears in the prompts immediately
      if (guidedPoolKey() !== poolKey) {
        guided.words = guidedBuildPools();
        bags.g_en = bags.g_jp = bags.g_sym = [];
        this.items = this.items.slice(0, this.idx + 1);
        this.fillItems(10);
      }
    } else {
      invalidate(); // update the remaining-time/WPM display
    }
  },

  onCorrect() {
    this.correct++;
    this.missFlash = false;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.combo % COMBO_STEP === 0) {
      if (!isUnlimited()) {
        // time bonuses are meaningless in unlimited mode, so don't award them
        this.endTime += COMBO_BONUS * 1000;
        this.bonusTotal += COMBO_BONUS;
        const id = ++this.bonusPopSeq;
        this.bonusPops.push(id);
        setTimeout(() => {
          this.bonusPops = this.bonusPops.filter((p) => p !== id);
          invalidate();
        }, 900);
      }
      audio.play("bonus");
    } else audio.play("type");
  },
  onMiss() {
    this.miss++;
    this.combo = 0;
    this.missFlash = true;
    audio.play("miss");
  },

  loadItem() {
    const it = this.items[this.idx];
    if (it.kana) {
      this.units = tokenizeKana(it.kana);
      this.unitIdx = 0;
      this.typed = "";
      this.softDone = false;
    } else {
      this.text = it.text ?? "";
      this.pos = 0;
    }
    this.lastInputAt = 0; // the gap between words isn't counted as keystroke time
    this.typoPending = false;
  },

  // expected next character (or null when the item is finished)
  expect() {
    if (!this.isJP()) return this.pos < this.text.length ? this.text[this.pos] : null;
    if (this.unitIdx >= this.units.length) return null;
    const u = this.units[this.unitIdx];
    if (this.softDone) {
      const nx = this.units[this.unitIdx + 1];
      if (nx) return nx.opts[0][0];
      const o = u.opts.find((o) => o.startsWith(this.typed) && o.length > this.typed.length);
      return o ? o[this.typed.length] : null;
    }
    const o =
      u.opts.find((o) => o.startsWith(this.typed) && o.length > this.typed.length) ||
      u.opts.find((o) => o.startsWith(this.typed));
    return o ? o[this.typed.length] : null;
  },

  // the next character to type (only while running; used to derive the display hint)
  expectedChar(): string | null {
    return this.running && this.items.length ? this.expect() : null;
  },

  input(c: string) {
    if (!this.running || !this.items.length) return;
    if (this.isJP()) this.inputJP(c);
    else this.inputText(c);
    invalidate();
  },

  inputText(c: string) {
    const t = this.text[this.pos];
    if (c === t) {
      if (this.guided) this.recordStep(t);
      this.pos++;
      this.onCorrect();
      if (this.pos >= this.text.length) this.nextItem();
    } else {
      if (this.guided) this.typoPending = true;
      this.onMiss();
    }
  },

  // record each confirmed character as one keystroke. Missed characters are excluded from the keystroke-time tally
  recordStep(ch: string) {
    const now = Date.now();
    this.steps.push({ ch, typo: this.typoPending, time: this.lastInputAt ? now - this.lastInputAt : 0 });
    guided.lastTyped = ch.toLowerCase(); // point the live chart at the key just typed
    this.lastInputAt = now;
    this.typoPending = false;
  },

  inputJP(c: string) {
    const u = this.units[this.unitIdx];
    if (!u) return;
    const nt = this.typed + c;
    const ok = u.opts.some((o) => o.startsWith(nt));
    if (ok) {
      if (this.guided) this.recordStep(c); // record as one romaji keystroke
      this.typed = nt;
      this.onCorrect();
      const exact = u.opts.includes(nt);
      const ext = u.opts.some((o) => o.length > nt.length && o.startsWith(nt));
      if (exact && !ext) this.finishUnit();
      else if (exact) this.softDone = true;
      return;
    }
    if (this.softDone) {
      // "n" was already a valid ん etc. — move to the next unit and retry
      this.finishUnit();
      this.input(c); // re-route: the next item may not be Japanese (mix mode)
      return;
    }
    if (this.guided) this.typoPending = true;
    this.onMiss();
  },

  finishUnit() {
    const u = this.units[this.unitIdx];
    u.done = this.typed;
    this.unitIdx++;
    this.typed = "";
    this.softDone = false;
    if (this.unitIdx >= this.units.length) this.nextItem();
  },

  nextItem() {
    this.words++;
    this.idx++;
    if (this.idx + 5 >= this.items.length) this.fillItems(10); // endless until time runs out
    this.loadItem();
  },

  finish() {
    clearInterval(this.timerId);
    this.running = false;
    let unlocked: string[] = [];
    if (this.guided && this.steps.length) {
      unlocked = guidedRecordRun(this.steps);
      this.steps = [];
      this.previewedSteps = 0;
    }
    const min = this.startTime ? (Date.now() - this.startTime) / 60000 : 0;
    const wpm = min > 0 ? Math.round(this.correct / 5 / min) : 0;
    const tot = this.correct + this.miss;
    const acc = (tot ? Math.round((this.correct / tot) * 100) : 100) + "%";
    const score = Math.max(0, Math.round(this.correct * 10 + this.words * 100 + this.maxCombo * 30 - this.miss * 20));
    const rank = score >= 12000 ? "S" : score >= 9000 ? "A" : score >= 6000 ? "B" : score >= 3000 ? "C" : "D";
    this.result = {
      score,
      rank,
      wpm,
      acc,
      miss: this.miss,
      words: this.words,
      maxCombo: this.maxCombo,
      bonusTotal: this.bonusTotal,
      unlocked,
      unlimited: isUnlimited(),
    };
    this.idle();
  },

  closeResult() {
    this.result = null;
    invalidate();
  },

  skipChar() {
    // Enter skips characters that don't exist in the keymap
    if (!this.items.length) return;
    const ch = this.expect();
    if (ch != null && findKeyForChar(ch)) return; // don't skip characters that can be typed
    if (this.isJP()) {
      this.softDone = false;
      this.finishUnit();
    } else {
      this.pos++;
      if (this.pos >= this.text.length) this.nextItem();
    }
    invalidate();
  },

  jpStrings() {
    let done = "";
    for (let i = 0; i < this.unitIdx; i++) done += this.units[i].done;
    done += this.typed;
    let rest = "";
    if (this.unitIdx < this.units.length) {
      const u = this.units[this.unitIdx];
      if (!this.softDone) {
        const o =
          u.opts.find((o) => o.startsWith(this.typed) && o.length > this.typed.length) ||
          u.opts.find((o) => o.startsWith(this.typed)) ||
          "";
        rest = o.slice(this.typed.length);
      } else if (this.unitIdx + 1 >= this.units.length) {
        const o = u.opts.find((o) => o.startsWith(this.typed) && o.length > this.typed.length) || "";
        rest = o.slice(this.typed.length);
      }
      for (let j = this.unitIdx + 1; j < this.units.length; j++) rest += this.units[j].opts[0];
    }
    return { done, rest };
  },
};
