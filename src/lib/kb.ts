// キーマップ状態と逆引き (文字 → キー+Shift+レイヤー)、指番号の推定
import { charsOf, K_NONE, type KeyDef, modsHaveShift, tapOf } from "./keycodes";
import { KLE, type PhysKey, parseKLE } from "./layout";
import { settings } from "./settings";
import { invalidate, setStatus } from "./store";

// 現在のキーボード: 物理配置(rows/cols/physKeys/name)とキーマップ(layers)、表示中レイヤー
export const KB = {
  rows: 8,
  cols: 7,
  physKeys: parseKLE(KLE),
  name: "Cornix",
  layers: [] as KeyDef[][][],
  layerCount: 0,
  source: "sample",
  label: "",
  viewLayer: 0,
};

export const KEYMAP_STORE_KEY = "vialTypingKeymap";

export function setKeymap(layers: KeyDef[][][], source: string, label?: string, restored?: boolean) {
  KB.layers = layers;
  KB.layerCount = layers.length;
  KB.source = source;
  KB.label = label || "";
  KB.viewLayer = 0;
  charCache.clear();
  // レイヤー数が減ったときは無効になった固定レイヤー設定を自動に戻す
  for (const key of ["num", "sym"] as const) {
    if (settings.layerPref[key] !== "auto" && +settings.layerPref[key] >= KB.layerCount)
      settings.layerPref[key] = "auto";
  }
  if (source === "sample") {
    setStatus("", "キーマップ未読込（サンプル表示中）");
  } else {
    setStatus("ok", "✓ " + label + "（" + layers.length + "レイヤー）" + (restored ? " · 前回のキーマップを復元" : ""));
    // 実際に読み込んだレイアウト+キーマップをブラウザに保存し、次回自動復元する
    if (!restored) saveKeymap(layers, source, label);
  }
  invalidate();
}

// 直近のレイアウト定義＋キーマップをlocalStorageへ保存
function saveKeymap(layers: KeyDef[][][], source: string, label?: string) {
  try {
    localStorage.setItem(
      KEYMAP_STORE_KEY,
      JSON.stringify({
        v: 1,
        source,
        label,
        matrixRows: KB.rows,
        matrixCols: KB.cols,
        physKeys: KB.physKeys,
        kbName: KB.name,
        layers,
      }),
    );
  } catch {
    /* 容量超過/プライベートモード等は無視 */
  }
}

// 保存済みレイアウト＋キーマップを復元（成功時true）
export function restoreSavedKeymap() {
  try {
    const raw = localStorage.getItem(KEYMAP_STORE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.layers) || !d.layers.length || !Array.isArray(d.physKeys) || !d.physKeys.length)
      return false;
    KB.rows = d.matrixRows || KB.rows;
    KB.cols = d.matrixCols || KB.cols;
    KB.physKeys = d.physKeys;
    KB.name = d.kbName || d.label || "Keyboard";
    setKeymap(d.layers, d.source || "vil", d.label || "保存済みキーマップ", true);
    return true;
  } catch {
    return false;
  }
}

// 保存済みを破棄して未読込状態に戻す
export function forgetSavedKeymap() {
  try {
    localStorage.removeItem(KEYMAP_STORE_KEY);
  } catch {}
  KB.layers = [];
  KB.layerCount = 0;
  KB.source = "sample";
  KB.label = "";
  KB.viewLayer = 0;
  charCache.clear();
  setStatus("", "キーボード未読込");
  invalidate();
}

// 「キーマップを消す」ボタンは保存済みキーマップがあるときだけ表示
export function hasSavedKeymap() {
  try {
    return !!localStorage.getItem(KEYMAP_STORE_KEY);
  } catch {
    return false;
  }
}

// findKeyForChar の結果: 押すキーとホールドすべきキー
export interface KeyPos {
  r: number;
  c: number;
}
export interface ShiftKeyPos extends KeyPos {
  plain: boolean;
  fromBase?: boolean;
}
export interface LayerKeyPos extends KeyPos {
  mods: number;
}
export interface Hint {
  key: KeyPos;
  layer: number;
  shiftKey: ShiftKeyPos | null;
  layerKey: LayerKeyPos | null;
  score: number;
  alt?: Hint | null;
}

// transparent keys fall through to the base layer
export function effKey(L: number, r: number, c: number): KeyDef {
  let k = KB.layers[L]?.[r] ? KB.layers[L][r][c] : K_NONE;
  if (k.t === "trans" && L > 0) k = KB.layers[0][r][c];
  return k || K_NONE;
}
export const handOf = (r: number) => (r < 4 ? "L" : "R");

// physical-key check: the matrix can contain keycodes at positions that have no
// physical key on the board — those must never be suggested
let _physRef: PhysKey[] | null = null,
  _physSet: Set<string> | null = null;
function physHas(r: number, c: number) {
  if (_physRef !== KB.physKeys) {
    _physRef = KB.physKeys;
    _physSet = new Set(KB.physKeys.map((k) => k.row + "," + k.col));
  }
  return (_physSet as Set<string>).has(r + "," + c);
}

// 物理配置から指番号を推定する (1=親指, 2=人差し指, 3=中指, 4=薬指, 5=小指)
export const FINGER_NAMES: Record<number, string> = { 1: "親指", 2: "人差し指", 3: "中指", 4: "薬指", 5: "小指" };
let _fingerRef: PhysKey[] | null = null;
let _fingerMap: Map<string, number> | null = null;
export function fingerFor(row: number, col: number): number | null {
  if (_fingerRef !== KB.physKeys) {
    _fingerRef = KB.physKeys;
    _fingerMap = buildFingerMap();
  }
  return _fingerMap?.get(row + "," + col) ?? null;
}

// ヒューリスティック: 盤面中央で左右の手に分け、分割型(偶数行数>=6)は各半分の最終行を親指、
// それ以外は回転キーと横長キー(スペース等)を親指とする。残りは列単位で内側から
// 人差し指×2列・中指・薬指・以降は小指を割り当て、キー1個だけの列は最寄りの列に合流する
function buildFingerMap() {
  const map = new Map<string, number>();
  if (!KB.physKeys.length) return map;
  const entries = KB.physKeys.map((k) => ({ k, cx: k.x + k.w / 2 }));
  const midX = (Math.min(...entries.map((e) => e.cx)) + Math.max(...entries.map((e) => e.cx))) / 2;
  const splitHalves = KB.rows >= 6 && KB.rows % 2 === 0;
  const thumbRows = splitHalves ? [KB.rows / 2 - 1, KB.rows - 1] : [];
  const isThumb = (e: { k: PhysKey; cx: number }) =>
    splitHalves ? thumbRows.includes(e.k.row) : e.k.r !== 0 || e.k.w >= 1.75;
  for (const hand of ["L", "R"]) {
    const handKeys = entries.filter((e) => (hand === "L" ? e.cx <= midX : e.cx > midX));
    const fingerKeys: { k: PhysKey; cx: number }[] = [];
    for (const e of handKeys) {
      if (isThumb(e)) map.set(e.k.row + "," + e.k.col, 1);
      else fingerKeys.push(e);
    }
    const cols: { x: number; keys: { k: PhysKey; cx: number }[] }[] = [];
    for (const e of fingerKeys.sort((a, b) => a.cx - b.cx)) {
      const col = cols[cols.length - 1];
      if (col && Math.abs(col.x - e.cx) < 0.55) {
        col.keys.push(e);
        col.x += (e.cx - col.x) / col.keys.length;
      } else cols.push({ x: e.cx, keys: [e] });
    }
    const full = cols.filter((c) => c.keys.length > 1);
    if (full.length) {
      for (const col of cols) {
        if (col.keys.length > 1) continue;
        const nearest = full.reduce((best, c) => (Math.abs(c.x - col.x) < Math.abs(best.x - col.x) ? c : best));
        nearest.keys.push(...col.keys);
      }
    }
    const ranked = (full.length ? full : cols).sort((a, b) => (hand === "L" ? b.x - a.x : a.x - b.x));
    ranked.forEach((col, i) => {
      const finger = i <= 1 ? 2 : i === 2 ? 3 : i === 3 ? 4 : 5;
      for (const e of col.keys) map.set(e.k.row + "," + e.k.col, finger);
    });
  }
  return map;
}

// find a key holding shift. Searches `layer` first, then falls back to the base
// layer (pressing Shift on base, then holding the layer key, keeps Shift active).
function findShiftKey(layer: number, hand: string): ShiftKeyPos | null {
  const collect = (L: number) => {
    const cands: ShiftKeyPos[] = [];
    for (let r = 0; r < KB.rows; r++)
      for (let c = 0; c < KB.cols; c++) {
        if (!physHas(r, c)) continue;
        const k = effKey(L, r, c);
        if (
          (k.t === "kc" && k.mods === 0 && (k.code === 0xe1 || k.code === 0xe5)) ||
          (k.t === "mt" && modsHaveShift(k.mods ?? 0)) ||
          (k.t === "osm" && modsHaveShift(k.mods ?? 0))
        )
          cands.push({ r, c, plain: k.t === "kc" });
      }
    return cands;
  };
  let cands = collect(layer),
    fromBase = false;
  if (!cands.length && layer > 0) {
    cands = collect(0);
    fromBase = true;
  }
  cands.sort(
    (a, b) => Number(handOf(a.r) === hand) - Number(handOf(b.r) === hand) || Number(b.plain) - Number(a.plain),
  );
  if (!cands.length) return null;
  // fromBase: Shift only exists on the layer *before* switching, so it must be
  // pressed BEFORE (and held through) the layer key
  return Object.assign(cands[0], { fromBase });
}

// find a key on the base layer that reaches `layer` while held; returns its implied mods (for LM)
function findLayerKey(layer: number): LayerKeyPos | null {
  for (let r = 0; r < KB.rows; r++)
    for (let c = 0; c < KB.cols; c++) {
      if (!physHas(r, c)) continue;
      const k = effKey(0, r, c);
      if ((k.t === "mo" || k.t === "lt" || k.t === "tt" || k.t === "osl" || k.t === "lm") && k.layer === layer)
        return { r, c, mods: (k.t === "lm" ? k.mods : 0) ?? 0 };
    }
  return null;
}

// category of a character for layer preferences: digit / symbol / other(letters, space...)
function charCategory(ch: string): "num" | "sym" | null {
  if (/[0-9]/.test(ch)) return "num";
  if (/[a-zA-Z\s]/.test(ch)) return null;
  return "sym";
}

export const charCache = new Map<string, Hint | null>();
// char -> {key:{r,c}, layer, shiftKey, layerKey} or null
export function findKeyForChar(ch: string): Hint | null {
  const cached = charCache.get(ch);
  if (cached !== undefined) return cached;
  const cat = charCategory(ch);
  const fixedL = cat && settings.layerPref[cat] !== "auto" ? +settings.layerPref[cat] : null;
  const cands: Hint[] = [];
  for (let L = 0; L < KB.layerCount; L++) {
    const layerKey = L === 0 ? null : findLayerKey(L);
    if (L > 0 && !layerKey) continue;
    // an LM(layer, Shift) key shifts every key on that layer (Shift+digit -> symbol)
    const lkShift = layerKey ? modsHaveShift(layerKey.mods) : false;
    for (let r = 0; r < KB.rows; r++)
      for (let c = 0; c < KB.cols; c++) {
        if (!physHas(r, c)) continue;
        const raw = KB.layers[L][r][c];
        if (L > 0 && (raw.t === "trans" || raw.t === "none")) continue;
        const tap = tapOf(raw);
        if (!tap) continue;
        // Ctrl/Alt/GUI付きのキーはショートカット(例: LSG(4)=Sft+GUI+4)であり文字入力ではない
        if (tap.mods & 0x0d) continue;
        const chars = charsOf(tap.code, settings.outMode === "jis");
        if (!chars) continue;
        let needShift: boolean | null = null;
        if (modsHaveShift(tap.mods) || lkShift) {
          if (chars[1] === ch) needShift = false;
        } else if (chars[0] === ch) needShift = false;
        else if (chars[1] === ch) needShift = true;
        if (needShift === null) continue;
        let shiftKey: ShiftKeyPos | null = null;
        if (needShift) {
          shiftKey = findShiftKey(L, handOf(r));
          if (!shiftKey) continue;
        }
        // one "hold" costs 10: layer hold + shift hold; prefer fewer holds, then lower layers.
        // the shift weight shifts with the user's guidance preference
        const shiftW = settings.keyPref === "shift" ? 1 : settings.keyPref === "layer" ? 30 : 12;
        let score = (L > 0 ? 10 + L : 0) + (needShift ? shiftW : 0) + (raw.t !== "kc" ? 1 : 0);
        // a fixed layer for this category dominates everything; other layers stay as fallback
        if (fixedL !== null && L !== fixedL) score += 1000;
        cands.push({ key: { r, c }, layer: L, shiftKey, layerKey, score });
      }
  }
  cands.sort((a, b) => a.score - b.score);
  const best = cands[0] || null;
  if (best) {
    // 2nd-best with a *different* physical key or layer, shown faintly as an alternative
    best.alt = cands.find((c) => c.layer !== best.layer || c.key.r !== best.key.r || c.key.c !== best.key.c) || null;
  }
  charCache.set(ch, best);
  return best;
}
