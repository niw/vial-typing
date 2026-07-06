// 練習エンジン: 走行のステートマシン。DOMは触らず、状態変更後に invalidate() で
// Reactへ再描画を通知する（タイプライン・統計・ヒントはすべて状態から導出される）
import { audio } from "./audio";
import { EN_SENTS, EN_WORDS, JP_SENTS, JP_WORDS, SYM_ITEMS } from "./data";
import { type GuidedStep, guided, guidedBuildPools, guidedRecordRun, guidedUpdateKeys } from "./guided";
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

// 出題1件: 英字系は text、日本語は kana を持つ
export interface PracticeItem {
  text?: string;
  kana?: string;
  meta: string;
}

// 走行終了時の結果（結果ダイアログの表示内容）
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
  guided: false, // キー習得モード（練習モードと直交する切替）
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
  notice: null as string | null, // キーボード未読込のまま開始しようとした時の案内
  result: null as RunResult | null, // 結果ダイアログの内容（null = 非表示）
  bonusPops: [] as number[], // 表示中の +1s ポップのid
  bonusPopSeq: 0,
  // キー習得モードの打鍵記録
  steps: [] as GuidedStep[],
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

  // 3-2-1 カウントダウンを表示してから本番開始
  start() {
    if (this.counting) return;
    if (!KB.layerCount) {
      this.notice =
        "⌨️ 先にキーボードを読み込んでください（「キーボードから読み取る」または vial.json / .vil をドロップ）";
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
      // 最新の習得状況で出題プールを作り直す
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
    this.resetRunStats();
    invalidate();
  },

  tick() {
    if (!isUnlimited() && this.endTime - Date.now() <= 0) {
      this.finish();
      return;
    }
    invalidate(); // 残り時間/WPM表示の更新
  },

  onCorrect() {
    this.correct++;
    this.missFlash = false;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.combo % COMBO_STEP === 0) {
      if (!isUnlimited()) {
        // 無制限モードでは時間ボーナスは無意味なので付与しない
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
    this.lastInputAt = 0; // 単語間の間隔は打鍵時間に含めない
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

  // 次に打つべき文字（走行中のみ。表示側のヒント導出に使う）
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

  // 文字の確定1回を1打鍵として記録する。ミスした文字は打鍵時間の集計から除外される
  recordStep(ch: string) {
    const now = Date.now();
    this.steps.push({ ch, typo: this.typoPending, time: this.lastInputAt ? now - this.lastInputAt : 0 });
    this.lastInputAt = now;
    this.typoPending = false;
  },

  inputJP(c: string) {
    const u = this.units[this.unitIdx];
    if (!u) return;
    const nt = this.typed + c;
    const ok = u.opts.some((o) => o.startsWith(nt));
    if (ok) {
      if (this.guided) this.recordStep(c); // ローマ字1打鍵として記録
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
    if (ch != null && findKeyForChar(ch)) return; // 打てる文字はスキップさせない
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
