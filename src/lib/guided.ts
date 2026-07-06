// キー習得モード (keybr.com方式のキー解放) の統計・解放判定・出題プール
import { EN_SENTS, EN_WORDS, JP_WORDS, SYM_ITEMS } from "./data";
import { ROMAJI, tokenizeKana } from "./romaji";
import { invalidate } from "./store";

// keybr.comのguided lessonの移植: 1走行を1レッスンとしてキー別の平均打鍵時間を記録し、
// 指数平滑した速度が目標に達すると出現頻度順に次のキーを解放して出題単語を更新する
export const GUIDED_TARGET_TIME = 60000 / 175; // 目標速度175CPM(=35WPM)での1打鍵あたりの時間(ms)
const GUIDED_MIN_KEYS = 6;
const GUIDED_ALPHA = 0.1; // 指数平滑の係数
const GUIDED_MAX_RESULTS = 300;
export const GUIDED_STORE_KEY = "vialTypingGuided";
const GUIDED_SLOW_COLOR = [0xcc, 0x00, 0x00];
const GUIDED_FAST_COLOR = [0x60, 0xd7, 0x88];

// コーパス中の出現頻度順に文字を並べる (keybrのLetter.frequencyOrder相当。出現しない文字は含めない)
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
const guidedIsSymbol = (ch: string) => ch !== " " && !guidedIsLetter(ch); // 記号と数字（大文字は小文字化済み）

// 練習モード別のコース: 対象キーとそのコーパスでの解放順。打鍵統計はコース間で共有する
interface GuidedCourseOrder {
  letters: string[];
  symbols?: string[];
}
const GUIDED_COURSES: Record<"en" | "jp" | "sym", GuidedCourseOrder> = {
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
};

// 統計を追跡する全キー（全コースの英字と記号の和集合）
const GUIDED_TRACKED = [
  ...new Set(Object.values(GUIDED_COURSES).flatMap((course) => [...course.letters, ...(course.symbols || [])])),
];

// 1走行分の記録。h は 文字 -> [打鍵数, ミス数, 平均打鍵時間ms]
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
// トラック上の1キー分の解放状態
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
// 走行中の1打鍵分の記録
export interface GuidedStep {
  ch: string;
  typo: boolean;
  time: number;
}
export type CourseId = "en" | "jp" | "sym";

export const guided = {
  results: [] as GuidedResult[],
  stats: new Map<string, GuidedStat>(),
  courses: {} as Record<CourseId, GuidedCourse>, // コースごとの解放状態
  course: "en" as CourseId, // パネルに表示中のコース
  words: { en: [] as string[], jp: [] as [string, string][], sym: [] as string[] }, // 練習モード別の出題プール
  selected: null as string | null,
  rev: 0, // 記録・リセットで増える(グラフ再描画のトリガ)
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

// 信頼度 = 目標打鍵時間 / 実際の打鍵時間。1.0以上で「習得済み」(keybrのTarget.confidence相当)
const guidedConfidence = (timeToType: number | null) => (timeToType == null ? null : GUIDED_TARGET_TIME / timeToType);

// 全記録からキー別の平滑打鍵時間と自己ベストを再計算する (keybrのMutableKeyStats相当)
export function guidedRebuildStats() {
  const stats = new Map<string, GuidedStat>(
    GUIDED_TRACKED.map((ch) => [ch, { samples: [], timeToType: null, bestTimeToType: null }]),
  );
  guided.results.forEach((result, index) => {
    for (const [ch, sample] of Object.entries(result.h) as [string, [number, number, number]][]) {
      const stat = stats.get(ch);
      const timeToType = sample[2];
      if (!stat || !(timeToType > 0)) continue;
      const filtered =
        stat.timeToType == null ? timeToType : GUIDED_ALPHA * timeToType + (1 - GUIDED_ALPHA) * stat.timeToType;
      stat.samples.push({ index, timeToType, filtered });
      stat.timeToType = filtered;
      stat.bestTimeToType = Math.min(stat.bestTimeToType ?? Infinity, filtered);
    }
  });
  guided.stats = stats;
}

// 1トラック分の解放済みキーと注目キーを決める (keybrのGuidedLesson.update相当)
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
      key.included = true; // 最低限のキー数を確保
    } else if ((key.bestConfidence ?? 0) >= 1) {
      key.included = true; // 一度でも目標速度に達したキーは常に含める
    } else if (included.every((k) => (k.bestConfidence ?? 0) >= 1)) {
      key.included = true; // 既存キーがすべて目標に達したときだけ次のキーを解放
    }
  }
  // 最も信頼度の低い解放済みキーを注目キーにする
  const weakest = keys
    .filter((k) => k.included && (k.bestConfidence ?? 0) < 1)
    .sort((a, b) => (a.bestConfidence ?? 0) - (b.bestConfidence ?? 0));
  if (weakest.length) weakest[0].focused = true;
  return keys;
}

// 共有統計から各コースの解放状態を計算する
export function guidedUpdateKeys() {
  guided.courses = {
    en: { letters: guidedTrackKeys(GUIDED_COURSES.en.letters) },
    jp: { letters: guidedTrackKeys(GUIDED_COURSES.jp.letters) },
    sym: {
      letters: guidedTrackKeys(GUIDED_COURSES.sym.letters),
      symbols: guidedTrackKeys(GUIDED_COURSES.sym.symbols!),
    },
  };
}

const guidedIncludedSet = (track: GuidedKey[]) => new Set(track.filter((k) => k.included).map((k) => k.ch));
export const guidedFocusOf = (track: GuidedKey[]) => track.find((k) => k.focused)?.ch ?? null;

// 全コース・全トラックの解放済みキーの和集合（解放アナウンスの差分検出用）
function guidedIncludedAll() {
  const set = new Set<string>();
  for (const course of Object.values(guided.courses))
    for (const track of [course.letters, course.symbols])
      if (track) for (const key of track) if (key.included) set.add(key.ch);
  return set;
}

// 解放済みキーだけで打てるお題を練習モード別に作る (keybrのDictionary.find相当)
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
  };
}

// 解放済みキーだけで綴れて注目キーを含む英単語
function guidedEnPool(included: Set<string>, focused: string | null): string[] {
  let words = EN_WORDS.filter((w) => w.length > 2 && [...w].every((ch) => included.has(ch)));
  if (focused) words = words.filter((w) => w.includes(focused));
  words = words.slice(0, 1000);
  while (words.length < 15) words.push(guidedPseudoWord([...included], focused)); // 実単語が少ない序盤は疑似単語で補う
  return words;
}

// 単語の標準ローマ字表記（各入力単位の第1候補をつないだもの）
function guidedRomajiOf(kana: string): string {
  return tokenizeKana(kana)
    .map((unit) => unit.opts[0] || "")
    .join("");
}

// ローマ字スタイル変更後に日本語コースの解放順を再計算する
export function guidedRefreshJpCourse() {
  GUIDED_COURSES.jp.letters = guidedFrequencyOrder(
    JP_WORDS.map(([kana]) => guidedRomajiOf(kana)),
    guidedIsLetter,
  );
  guidedUpdateKeys();
  invalidate();
}

// 標準ローマ字が解放済みキーだけで打てる日本語単語
function guidedJpPool(included: Set<string>, focused: string | null): [string, string][] {
  const typeable = JP_WORDS.filter(([kana]) => [...guidedRomajiOf(kana)].every((ch) => included.has(ch)));
  let pool = focused ? typeable.filter(([kana]) => guidedRomajiOf(kana).includes(focused)) : typeable;
  if (pool.length < 5) pool = typeable;
  pool = pool.slice();
  while (pool.length < 5) pool.push(guidedPseudoKana(included, focused));
  return pool;
}

// 解放済みキーだけで打てるかなを組み合わせた疑似単語（[かな, 表示] 形式）
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

// 英字も記号もそれぞれの解放済みキーに収まる記号行（不足分は識別子+記号で生成）
function guidedSymPool(
  letters: Set<string>,
  letterFocus: string | null,
  symbols: Set<string>,
  symbolFocus: string | null,
): string[] {
  const typeable = (item: string) =>
    [...item.toLowerCase()].every((ch) => ch === " " || (guidedIsLetter(ch) ? letters.has(ch) : symbols.has(ch)));
  let pool = SYM_ITEMS.filter(typeable);
  const focus = symbolFocus ?? letterFocus;
  if (focus) {
    const withFocus = pool.filter((item) => item.toLowerCase().includes(focus));
    if (withFocus.length) pool = withFocus;
  }
  pool = pool.slice();
  while (pool.length < 8) pool.push(guidedSymLine(letters, letterFocus, symbols, symbolFocus));
  return pool;
}

// 解放済みの英字識別子を解放済みの記号でつないだ練習行
function guidedSymLine(
  letters: Set<string>,
  letterFocus: string | null,
  symbols: Set<string>,
  symbolFocus: string | null,
): string {
  const symbolList = [...symbols];
  const pickSymbol = () => symbolList[Math.floor(Math.random() * symbolList.length)];
  const ident = (focus: string | null) => guidedPseudoWord([...letters], focus).slice(0, 4);
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

// 1走行分の打鍵記録をキー別ヒストグラムに集計して保存し、新たに解放されたキーを返す
export function guidedRecordRun(steps: GuidedStep[]): string[] {
  const byChar = new Map<string, { hit: number; miss: number; time: number; count: number }>();
  for (const step of steps) {
    const ch = step.ch.toLowerCase(); // Shift打ちの大文字は同じ物理キーとして集計する
    if (!guided.stats.has(ch)) continue;
    let s = byChar.get(ch);
    if (!s) byChar.set(ch, (s = { hit: 0, miss: 0, time: 0, count: 0 }));
    s.hit += 1;
    if (step.typo) s.miss += 1;
    else if (step.time > 0) {
      s.time += step.time;
      s.count += 1;
    }
  }
  const histogram: Record<string, [number, number, number]> = {};
  for (const [ch, s] of byChar) {
    const timeToType = s.count > 0 ? Math.round(s.time / s.count) : 0;
    if (timeToType > 0 && (timeToType < 40 || timeToType > 12000)) continue; // 速すぎ/遅すぎは無効 (keybrのvalidateSample)
    histogram[ch] = [s.hit, s.miss, timeToType];
  }
  if (Object.keys(histogram).length < 3) return []; // 文字種が少なすぎる走行は記録しない
  const before = guidedIncludedAll();
  guided.results.push({ t: Date.now(), h: histogram });
  if (guided.results.length > GUIDED_MAX_RESULTS) guided.results.splice(0, guided.results.length - GUIDED_MAX_RESULTS);
  guidedSave();
  guidedRebuildStats();
  guidedUpdateKeys();
  guided.rev++;
  invalidate();
  return [...guidedIncludedAll()].filter((ch) => !before.has(ch));
}

export const guidedWpm = (timeToType: number) => Math.round(12000 / timeToType);

export function guidedKeyColor(confidence: number): string {
  const t = Math.max(0, Math.min(1, confidence));
  const mix = GUIDED_SLOW_COLOR.map((c, i) => Math.round(c + (GUIDED_FAST_COLOR[i] - c) * t));
  return "rgb(" + mix.join(",") + ")";
}

// 表示中コースのトラック一覧（記号コースは英字+記号の2トラック）
export function guidedCourseTracks() {
  const course = guided.courses[guided.course];
  return course.symbols ? [course.letters, course.symbols] : [course.letters];
}

export function guidedSelectedKey() {
  const all = guidedCourseTracks().flat();
  return all.find((k) => k.ch === guided.selected) ?? all.find((k) => k.focused) ?? all[0];
}

// 直近サンプルの回帰直線の傾き = 学習率(WPM/走行) (keybrのLearningRateの簡易版)
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

// 練習記録（走行履歴）をファイル保存用に取り出す
export function guidedResultsSnapshot(): GuidedResult[] {
  return guided.results;
}

// ファイルから読み込んだ走行履歴を取り込み、統計と解放状態を作り直す
export function guidedImport(results: unknown) {
  const valid = Array.isArray(results)
    ? results.filter(
        (r): r is GuidedResult => !!r && typeof r === "object" && typeof (r as GuidedResult).h === "object",
      )
    : [];
  guided.results = valid.slice(-GUIDED_MAX_RESULTS);
  guided.selected = null;
  guidedSave();
  guidedRebuildStats();
  guidedUpdateKeys();
  guided.rev++;
  invalidate();
}

// 履歴を消して未習得の状態に戻す
export function guidedReset() {
  guided.results = [];
  guided.selected = null;
  try {
    localStorage.removeItem(GUIDED_STORE_KEY);
  } catch {}
  guidedRebuildStats();
  guidedUpdateKeys();
  guided.rev++;
  invalidate();
}
