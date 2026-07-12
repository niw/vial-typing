// Key-acquisition mode (keybr.com-style key unlocking): stats, unlock decisions, and word pools
import { EN_SENTS, EN_WORDS, JP_WORDS, SYM_ITEMS, VIM_ITEMS } from "./data";
import { ROMAJI, tokenizeKana } from "./romaji";
import { invalidate } from "./store";

// A port of keybr.com's guided lesson: treats each run as one lesson, recording the average time-to-type per key.
// A key is mastered once its fastest run reaches the target speed; once every unlocked key is mastered the next key
// unlocks in frequency order and the word pool updates. (The smoothed speed is kept only for the "recent speed" display.)
export const GUIDED_TARGET_TIME = 60000 / 175; // time per keystroke (ms) at the target speed of 175 CPM (=35 WPM)
const GUIDED_MIN_KEYS = 6;
const GUIDED_ALPHA = 0.1; // exponential smoothing coefficient
const GUIDED_MAX_RESULTS = 300;
export const GUIDED_STORE_KEY = "vialTypingGuided";
const GUIDED_SLOW_COLOR = [0xcc, 0x00, 0x00];
const GUIDED_FAST_COLOR = [0x60, 0xd7, 0x88];

// order characters by frequency of occurrence in the corpus (equivalent to keybr's Letter.frequencyOrder; characters that never occur are excluded)
function guidedFrequencyOrder(texts: string[], accept: (ch: string) => boolean): string[] {
  const freq = new Map<string, number>();
  for (const text of texts) {
    for (const raw of text) {
      const ch = raw.toLowerCase();
      if (!accept(ch)) continue;
      freq.set(ch, (freq.get(ch) || 0) + 1);
    }
  }
  return [...freq.keys()].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a.charCodeAt(0) - b.charCodeAt(0));
}

const guidedIsLetter = (ch: string) => ch >= "a" && ch <= "z";
const guidedIsSymbol = (ch: string) => ch !== " " && !guidedIsLetter(ch); // symbols and digits (uppercase letters are already lowercased)

// Courses per practice mode: the target keys and their unlock order within that corpus. Keystroke stats are shared across courses.
interface GuidedCourseOrder {
  letters: string[];
  symbols?: string[];
}
const GUIDED_COURSES: Record<"en" | "jp" | "sym" | "vim", GuidedCourseOrder> = {
  en: { letters: guidedFrequencyOrder(EN_WORDS.concat(EN_SENTS), guidedIsLetter) },
  jp: {
    letters: guidedFrequencyOrder(
      JP_WORDS.map(([kana]) => guidedRomajiOf(kana)),
      guidedIsLetter,
    ),
  },
  sym: {
    letters: guidedFrequencyOrder(SYM_ITEMS, guidedIsLetter),
    symbols: guidedFrequencyOrder(SYM_ITEMS, guidedIsSymbol),
  },
  vim: {
    letters: guidedFrequencyOrder(VIM_ITEMS, guidedIsLetter),
    symbols: guidedFrequencyOrder(VIM_ITEMS, guidedIsSymbol),
  },
};

// all keys tracked for stats (union of the letters and symbols across all courses)
const GUIDED_TRACKED = [
  ...new Set(Object.values(GUIDED_COURSES).flatMap((course) => [...course.letters, ...(course.symbols || [])])),
];

// A single run's record. h maps char -> [keystroke count, miss count, average time-to-type ms]
export interface GuidedResult {
  t: number;
  h: Record<string, [number, number, number]>;
}
interface GuidedSample {
  index: number;
  timeToType: number;
  filtered: number;
}
export interface GuidedStat {
  samples: GuidedSample[];
  timeToType: number | null;
  bestTimeToType: number | null;
}
// unlock state of a single key on a track
export interface GuidedKey extends GuidedStat {
  ch: string;
  confidence: number | null;
  bestConfidence: number | null;
  included: boolean;
  focused: boolean;
}
export interface GuidedCourse {
  letters: GuidedKey[];
  symbols?: GuidedKey[];
}
// record of a single keystroke during a run
export interface GuidedStep {
  ch: string;
  typo: boolean;
  time: number;
}
export type CourseId = "en" | "jp" | "sym" | "vim";

export const guided = {
  results: [] as GuidedResult[],
  stats: new Map<string, GuidedStat>(),
  courses: {} as Record<CourseId, GuidedCourse>, // unlock state per course
  course: "en" as CourseId, // the course currently shown in the panel
  words: { en: [] as string[], jp: [] as [string, string][], sym: [] as string[], vim: [] as string[] }, // word pools per practice mode
  selected: null as string | null,
  lastTyped: null as string | null, // the most recently typed key while running (follows the live chart); cleared when idle
  pending: null as GuidedResult | null, // in-progress run overlaid on the committed results for a live chart/unlock preview
  rev: 0, // bumped on record/reset (triggers a graph redraw)
};

export function guidedLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUIDED_STORE_KEY) ?? "null");
    if (raw && raw.v === 1 && Array.isArray(raw.results)) guided.results = raw.results;
  } catch {}
}

function guidedSave() {
  try {
    localStorage.setItem(GUIDED_STORE_KEY, JSON.stringify({ v: 1, results: guided.results }));
  } catch {}
}

// confidence = target time-to-type / actual time-to-type. 1.0 or above means "mastered" (equivalent to keybr's Target.confidence)
const guidedConfidence = (timeToType: number | null) => (timeToType == null ? null : GUIDED_TARGET_TIME / timeToType);

// recompute each key's smoothed time-to-type and personal best from all records (equivalent to keybr's MutableKeyStats)
export function guidedRebuildStats() {
  const stats = new Map<string, GuidedStat>(
    GUIDED_TRACKED.map((ch) => [ch, { samples: [], timeToType: null, bestTimeToType: null }]),
  );
  // fold the in-progress run in as a trailing (uncommitted) sample so the chart and unlock state update live
  const runs = guided.pending ? [...guided.results, guided.pending] : guided.results;
  runs.forEach((result, index) => {
    for (const [ch, sample] of Object.entries(result.h) as [string, [number, number, number]][]) {
      const stat = stats.get(ch);
      const timeToType = sample[2];
      if (!stat || !(timeToType > 0)) continue;
      const filtered =
        stat.timeToType == null ? timeToType : GUIDED_ALPHA * timeToType + (1 - GUIDED_ALPHA) * stat.timeToType;
      stat.samples.push({ index, timeToType, filtered });
      stat.timeToType = filtered;
      // NOTE: best is the fastest actual run, not the fastest smoothed value. Smoothing lags the raw speed, so
      // min-of-smoothed can never reach the target when a key hovers near it, permanently stalling the unlock;
      // basing mastery on the best real run means a key counts as mastered once it's been typed at the target once.
      stat.bestTimeToType = Math.min(stat.bestTimeToType ?? Infinity, timeToType);
    }
  });
  guided.stats = stats;
}

// determine the unlocked keys and focus key for one track (equivalent to keybr's GuidedLesson.update)
function guidedTrackKeys(order: string[]): GuidedKey[] {
  const keys = order.map((ch): GuidedKey => {
    const stat = guided.stats.get(ch)!;
    return {
      ch,
      samples: stat.samples,
      timeToType: stat.timeToType,
      bestTimeToType: stat.bestTimeToType,
      confidence: guidedConfidence(stat.timeToType),
      bestConfidence: guidedConfidence(stat.bestTimeToType),
      included: false,
      focused: false,
    };
  });
  for (const key of keys) {
    const included = keys.filter((k) => k.included);
    if (included.length < GUIDED_MIN_KEYS) {
      key.included = true; // guarantee a minimum number of keys
    } else if ((key.bestConfidence ?? 0) >= 1) {
      key.included = true; // always include a key that has ever reached the target speed
    } else if (included.every((k) => (k.bestConfidence ?? 0) >= 1)) {
      key.included = true; // only unlock the next key once all existing keys have reached the target
    }
  }
  // make the unlocked key with the lowest confidence the focus key
  const weakest = keys
    .filter((k) => k.included && (k.bestConfidence ?? 0) < 1)
    .sort((a, b) => (a.bestConfidence ?? 0) - (b.bestConfidence ?? 0));
  if (weakest.length) weakest[0].focused = true;
  return keys;
}

// compute each course's unlock state from the shared stats
export function guidedUpdateKeys() {
  guided.courses = {
    en: { letters: guidedTrackKeys(GUIDED_COURSES.en.letters) },
    jp: { letters: guidedTrackKeys(GUIDED_COURSES.jp.letters) },
    sym: {
      letters: guidedTrackKeys(GUIDED_COURSES.sym.letters),
      symbols: guidedTrackKeys(GUIDED_COURSES.sym.symbols!),
    },
    vim: {
      letters: guidedTrackKeys(GUIDED_COURSES.vim.letters),
      symbols: guidedTrackKeys(GUIDED_COURSES.vim.symbols!),
    },
  };
}

const guidedIncludedSet = (track: GuidedKey[]) => new Set(track.filter((k) => k.included).map((k) => k.ch));
export const guidedFocusOf = (track: GuidedKey[]) => track.find((k) => k.focused)?.ch ?? null;

// per-track sets of unlocked keys, in a fixed course/track order (used to diff for unlock announcements).
// NOTE: must diff per track, not as one union — a key can be unlocked from the start in one course
// (e.g. "e" is the most frequent EN letter) and still be a fresh unlock in another.
function guidedIncludedByTrack(): Set<string>[] {
  const tracks: Set<string>[] = [];
  for (const course of Object.values(guided.courses))
    for (const track of [course.letters, course.symbols]) if (track) tracks.push(guidedIncludedSet(track));
  return tracks;
}

// fingerprint of the state the word pools are built from (per-track unlocked keys + focus key);
// when it changes mid-run the engine rebuilds the pools so new keys show up in the prompts immediately
export function guidedPoolKey(): string {
  const parts: string[] = [];
  for (const course of Object.values(guided.courses))
    for (const track of [course.letters, course.symbols])
      if (track)
        parts.push(
          track
            .filter((k) => k.included)
            .map((k) => k.ch)
            .join("") +
            ":" +
            (guidedFocusOf(track) ?? ""),
        );
  return parts.join("|");
}

// build word pools typeable with only unlocked keys, per practice mode (equivalent to keybr's Dictionary.find)
export function guidedBuildPools() {
  const courses = guided.courses;
  return {
    en: guidedEnPool(guidedIncludedSet(courses.en.letters), guidedFocusOf(courses.en.letters)),
    jp: guidedJpPool(guidedIncludedSet(courses.jp.letters), guidedFocusOf(courses.jp.letters)),
    sym: guidedSymPool(
      guidedIncludedSet(courses.sym.letters),
      guidedFocusOf(courses.sym.letters),
      guidedIncludedSet(courses.sym.symbols!),
      guidedFocusOf(courses.sym.symbols!),
    ),
    vim: guidedVimPool(
      guidedIncludedSet(courses.vim.letters),
      guidedFocusOf(courses.vim.letters),
      guidedIncludedSet(courses.vim.symbols!),
      guidedFocusOf(courses.vim.symbols!),
    ),
  };
}

// English words spellable with only unlocked keys, containing the focus key
function guidedEnPool(included: Set<string>, focused: string | null): string[] {
  let words = EN_WORDS.filter((w) => w.length > 2 && [...w].every((ch) => included.has(ch)));
  if (focused) words = words.filter((w) => w.includes(focused));
  words = words.slice(0, 1000);
  while (words.length < 15) words.push(guidedPseudoWord([...included], focused)); // pad with pseudo-words early on when few real words qualify
  return words;
}

// standard romaji spelling of a word (joins the first-choice romanization of each input unit)
function guidedRomajiOf(kana: string): string {
  return tokenizeKana(kana)
    .map((unit) => unit.opts[0] || "")
    .join("");
}

// recompute the Japanese course's unlock order after the romaji style changes
export function guidedRefreshJpCourse() {
  GUIDED_COURSES.jp.letters = guidedFrequencyOrder(
    JP_WORDS.map(([kana]) => guidedRomajiOf(kana)),
    guidedIsLetter,
  );
  guidedUpdateKeys();
  invalidate();
}

// Japanese words whose standard romaji is typeable with only unlocked keys
function guidedJpPool(included: Set<string>, focused: string | null): [string, string][] {
  const typeable = JP_WORDS.filter(([kana]) => [...guidedRomajiOf(kana)].every((ch) => included.has(ch)));
  // keep the focus filter and pad with focus pseudo-kana (like the EN pool) so the focus key is always
  // practiceable; falling back to all typeable words here would starve the focus key and stall unlocking
  const pool = focused ? typeable.filter(([kana]) => guidedRomajiOf(kana).includes(focused)) : typeable.slice();
  while (pool.length < 5) pool.push(guidedPseudoKana(included, focused));
  return pool;
}

// pseudo-word combining kana typeable with only unlocked keys (in [kana, display] form)
function guidedPseudoKana(included: Set<string>, focused: string | null): [string, string] {
  const kanas = Object.keys(ROMAJI).filter(
    (kana) => !"んっ".includes(kana) && [...ROMAJI[kana][0]].every((ch) => included.has(ch)),
  );
  if (!kanas.length) return ["あ", "あ"];
  let word = "";
  const len = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < len; i++) word += kanas[Math.floor(Math.random() * kanas.length)];
  if (focused) {
    const withFocus = kanas.filter((kana) => ROMAJI[kana][0].includes(focused));
    if (withFocus.length) word += withFocus[Math.floor(Math.random() * withFocus.length)];
  }
  return [word, word];
}

// items where both letters and symbols fit within their own unlocked keys (generated from identifier+symbol when there's a shortfall).
// Shared by the Symbols and Vim courses, which both mix letters and symbols within one corpus.
function guidedItemPool(
  items: string[],
  letters: Set<string>,
  letterFocus: string | null,
  symbols: Set<string>,
  symbolFocus: string | null,
): string[] {
  const typeable = (item: string) =>
    [...item.toLowerCase()].every((ch) => ch === " " || (guidedIsLetter(ch) ? letters.has(ch) : symbols.has(ch)));
  const focus = symbolFocus ?? letterFocus;
  // filter to the focus even when no real item contains it (like the EN pool), then pad with focus-injecting
  // synthetic lines. Keeping all typeable items when the focus is absent would starve it and stall unlocking:
  // a whole-line snippet containing e.g. "#" also needs symbols that aren't unlocked yet, so "#" never appears.
  const pool = focus
    ? items.filter((item) => typeable(item) && item.toLowerCase().includes(focus))
    : items.filter(typeable);
  while (pool.length < 8) pool.push(guidedSymLine(letters, letterFocus, symbols, symbolFocus));
  return pool;
}

function guidedSymPool(
  letters: Set<string>,
  letterFocus: string | null,
  symbols: Set<string>,
  symbolFocus: string | null,
): string[] {
  return guidedItemPool(SYM_ITEMS, letters, letterFocus, symbols, symbolFocus);
}

function guidedVimPool(
  letters: Set<string>,
  letterFocus: string | null,
  symbols: Set<string>,
  symbolFocus: string | null,
): string[] {
  return guidedItemPool(VIM_ITEMS, letters, letterFocus, symbols, symbolFocus);
}

// common code identifiers, so the synthetic symbol lines read like real code instead of random letters
const GUIDED_IDENTS = [
  "name",
  "value",
  "count",
  "index",
  "list",
  "item",
  "data",
  "node",
  "next",
  "size",
  "total",
  "label",
  "state",
  "error",
  "token",
  "line",
  "word",
  "code",
  "text",
  "file",
  "path",
  "time",
  "type",
  "mode",
  "step",
  "rate",
  "score",
  "level",
  "result",
  "input",
  "offset",
  "length",
  "target",
  "source",
  "filter",
  "cursor",
  "string",
  "number",
  "object",
  "array",
  "entry",
  "field",
  "group",
  "order",
  "title",
  "event",
  "query",
  "table",
  "model",
  "min",
  "max",
  "sum",
  "temp",
];

// pick a real identifier spellable with the unlocked letters (preferring one containing the focus letter);
// fall back to a random letter cluster only when no real identifier fits the unlocked letters yet
function guidedIdent(letters: Set<string>, focus: string | null): string {
  const fits = (word: string) => [...word].every((ch) => letters.has(ch));
  let pool = GUIDED_IDENTS.filter(fits);
  if (focus && guidedIsLetter(focus)) {
    const withFocus = pool.filter((word) => word.includes(focus));
    if (withFocus.length) pool = withFocus;
  }
  return pool.length
    ? pool[Math.floor(Math.random() * pool.length)]
    : guidedPseudoWord([...letters], focus).slice(0, 4);
}

// practice line joining unlocked-letter identifiers with unlocked symbols
function guidedSymLine(
  letters: Set<string>,
  letterFocus: string | null,
  symbols: Set<string>,
  symbolFocus: string | null,
): string {
  const symbolList = [...symbols];
  const pickSymbol = () => symbolList[Math.floor(Math.random() * symbolList.length)];
  const ident = (focus: string | null) => guidedIdent(letters, focus);
  let line = ident(letterFocus);
  const joints = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < joints; i++) {
    const symbol = i === 0 && symbolFocus ? symbolFocus : pickSymbol();
    line += Math.random() < 0.5 ? " " + symbol + " " + ident(null) : symbol + ident(null);
  }
  return line;
}

function guidedPseudoWord(letters: string[], focused: string | null): string {
  let word = "";
  const len = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < len; i++) word += letters[Math.floor(Math.random() * letters.length)];
  if (focused && !word.includes(focused)) {
    const at = Math.floor(Math.random() * word.length);
    word = word.slice(0, at) + focused + word.slice(at + 1);
  }
  return word;
}

function guidedMedian(times: number[]): number {
  if (!times.length) return 0;
  const sorted = times.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

// aggregate a run's confirmed keystrokes into a per-key histogram (char -> [hits, misses, median time-to-type ms])
// NOTE: the per-key time is the median, not the mean. Mid-word thinking pauses land on whichever key comes next,
// and a couple of 1-2s hesitations push a key's mean past the target forever even when actually typing fast —
// the median measures how fast the key is typically typed and is immune to those outliers.
function guidedBuildHistogram(steps: GuidedStep[]): Record<string, [number, number, number]> {
  const byChar = new Map<string, { hit: number; miss: number; times: number[] }>();
  for (const step of steps) {
    const ch = step.ch.toLowerCase(); // count a shifted uppercase letter under the same physical key
    if (!guided.stats.has(ch)) continue;
    let s = byChar.get(ch);
    if (!s) byChar.set(ch, (s = { hit: 0, miss: 0, times: [] }));
    s.hit += 1;
    if (step.typo) s.miss += 1;
    else if (step.time > 0) s.times.push(step.time);
  }
  const histogram: Record<string, [number, number, number]> = {};
  for (const [ch, s] of byChar) {
    const timeToType = guidedMedian(s.times);
    if (timeToType > 0 && (timeToType < 40 || timeToType > 12000)) continue; // discard implausibly fast/slow samples (keybr's validateSample)
    histogram[ch] = [s.hit, s.miss, timeToType];
  }
  return histogram;
}

// aggregate one run's keystroke records into a per-key histogram, save it, and return newly unlocked keys
export function guidedRecordRun(steps: GuidedStep[]): string[] {
  const histogram = guidedBuildHistogram(steps);
  if (Object.keys(histogram).length < 3) return []; // don't record a run with too few distinct characters
  // read the unlock state as the user last saw it live (pending overlay still applied) so keys already
  // shown unlocking during the run aren't re-announced in the result dialog
  const before = guidedIncludedByTrack();
  guided.pending = null; // drop the preview overlay so the committed run isn't counted twice
  guided.results.push({ t: Date.now(), h: histogram });
  if (guided.results.length > GUIDED_MAX_RESULTS) guided.results.splice(0, guided.results.length - GUIDED_MAX_RESULTS);
  guidedSave();
  guidedRebuildStats();
  guidedUpdateKeys();
  guided.rev++;
  invalidate();
  const after = guidedIncludedByTrack();
  return [...new Set(after.flatMap((track, i) => [...track].filter((ch) => !before[i]?.has(ch))))];
}

// overlay the in-progress run: recompute stats/unlock state as if the current keystrokes were a finished run,
// without persisting. Drives the real-time chart and mid-run unlocking; reverted on finish/abort.
export function guidedPreview(steps: GuidedStep[]) {
  const histogram = guidedBuildHistogram(steps);
  guided.pending = Object.keys(histogram).length ? { t: Date.now(), h: histogram } : null;
  guidedRebuildStats();
  guidedUpdateKeys();
  invalidate();
}

export const guidedWpm = (timeToType: number) => Math.round(12000 / timeToType);

export function guidedKeyColor(confidence: number): string {
  const t = Math.max(0, Math.min(1, confidence));
  const mix = GUIDED_SLOW_COLOR.map((c, i) => Math.round(c + (GUIDED_FAST_COLOR[i] - c) * t));
  return "rgb(" + mix.join(",") + ")";
}

// tracks for the currently shown course (the symbol course has 2 tracks: letters + symbols)
export function guidedCourseTracks() {
  const course = guided.courses[guided.course];
  return course.symbols ? [course.letters, course.symbols] : [course.letters];
}

export function guidedSelectedKey() {
  const all = guidedCourseTracks().flat();
  // a chip the user pinned by clicking wins; otherwise while typing follow the most recently typed key, then the focus key
  return (
    (guided.selected ? all.find((k) => k.ch === guided.selected) : undefined) ??
    (guided.lastTyped ? all.find((k) => k.ch === guided.lastTyped) : undefined) ??
    all.find((k) => k.focused) ??
    all[0]
  );
}

// slope of the regression line over recent samples = learning rate (WPM/run) (a simplified version of keybr's LearningRate)
export function guidedLearningRate(key: GuidedKey): number | null {
  const samples = key.samples.slice(-30);
  if (samples.length < 5) return null;
  const ys = samples.map((s) => 12000 / s.filtered);
  const n = ys.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += ys[i];
    sxx += i * i;
    sxy += i * ys[i];
  }
  const d = n * sxx - sx * sx;
  return d ? (n * sxy - sx * sy) / d : null;
}

// extract the practice records (run history) for saving to a file
export function guidedResultsSnapshot(): GuidedResult[] {
  return guided.results;
}

// import run history loaded from a file and rebuild stats and unlock state
export function guidedImport(results: unknown) {
  const valid = Array.isArray(results)
    ? results.filter(
        (r): r is GuidedResult => !!r && typeof r === "object" && typeof (r as GuidedResult).h === "object",
      )
    : [];
  guided.results = valid.slice(-GUIDED_MAX_RESULTS);
  guided.selected = null;
  guided.pending = null;
  guidedSave();
  guidedRebuildStats();
  guidedUpdateKeys();
  guided.rev++;
  invalidate();
}

// clear history and revert to the not-yet-mastered state
export function guidedReset() {
  guided.results = [];
  guided.selected = null;
  guided.pending = null;
  try {
    localStorage.removeItem(GUIDED_STORE_KEY);
  } catch {}
  guidedRebuildStats();
  guidedUpdateKeys();
  guided.rev++;
  invalidate();
}
