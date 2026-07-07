// Keymap state and reverse lookup (char → key+Shift+layer), plus finger-number estimation
import { DEFAULT_KEYBOARD, DEFAULT_STATUS_TEXT } from "./defaultKeyboard";
import { charsOf, K_NONE, type KeyDef, modsHaveShift, tapOf } from "./keycodes";
import type { PhysKey } from "./layout";
import { settings } from "./settings";
import { invalidate, setStatus } from "./store";

// The current keyboard: physical layout (rows/cols/physKeys/name), keymap (layers), and the visible layer.
// Shows the default US-layout keyboard (defaultKeyboard.ts) right after startup, replaced by reading a real device or a file drop.
export const KB = {
  rows: DEFAULT_KEYBOARD.rows,
  cols: DEFAULT_KEYBOARD.cols,
  physKeys: DEFAULT_KEYBOARD.physKeys,
  name: DEFAULT_KEYBOARD.name,
  layers: DEFAULT_KEYBOARD.layers as KeyDef[][][],
  layerCount: DEFAULT_KEYBOARD.layers.length,
  source: "default",
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
  // reset a fixed-layer preference to auto if it now points past the reduced layer count
  for (const key of ["num", "sym"] as const) {
    if (settings.layerPref[key] !== "auto" && +settings.layerPref[key] >= KB.layerCount)
      settings.layerPref[key] = "auto";
  }
  if (source === "sample") {
    setStatus("", "キーマップ未読込（サンプル表示中）");
  } else {
    setStatus("ok", "✓ " + label + "（" + layers.length + "レイヤー）" + (restored ? " · 前回のキーマップを復元" : ""));
    // save the actually loaded layout+keymap to the browser so it auto-restores next time
    if (!restored) saveKeymap(layers, source, label);
  }
  invalidate();
}

// save the most recent layout definition + keymap to localStorage
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
    /* ignore quota-exceeded / private-mode errors, etc. */
  }
}

// Apply a keymap object (from storage or a file) to the current keyboard.
// restored=true is the automatic restore at startup (not re-saved); false is a file import (saved so it also restores next time)
function applyKeymapData(data: unknown, restored: boolean): boolean {
  const d = data as {
    layers?: KeyDef[][][];
    physKeys?: PhysKey[];
    matrixRows?: number;
    matrixCols?: number;
    kbName?: string;
    source?: string;
    label?: string;
  } | null;
  if (!d || !Array.isArray(d.layers) || !d.layers.length || !Array.isArray(d.physKeys) || !d.physKeys.length)
    return false;
  KB.rows = d.matrixRows || KB.rows;
  KB.cols = d.matrixCols || KB.cols;
  KB.physKeys = d.physKeys;
  KB.name = d.kbName || d.label || "Keyboard";
  setKeymap(d.layers, d.source || "vil", d.label || "保存済みキーマップ", restored);
  return true;
}

// restore the saved layout + keymap (returns true on success)
export function restoreSavedKeymap() {
  try {
    const raw = localStorage.getItem(KEYMAP_STORE_KEY);
    return raw ? applyKeymapData(JSON.parse(raw), true) : false;
  } catch {
    return false;
  }
}

// apply a keymap loaded from a file (also saved to localStorage so it restores on next launch)
export function importKeymap(data: unknown): boolean {
  return applyKeymapData(data, false);
}

// serialize the current keymap for saving to a file (null while showing the default/sample)
export function keymapSnapshot() {
  if (!hasSavedKeymap()) return null;
  return {
    v: 1,
    source: KB.source,
    label: KB.label,
    matrixRows: KB.rows,
    matrixCols: KB.cols,
    physKeys: KB.physKeys,
    kbName: KB.name,
    layers: KB.layers,
  };
}

// discard the saved keymap and revert to the default US-layout keyboard
export function forgetSavedKeymap() {
  try {
    localStorage.removeItem(KEYMAP_STORE_KEY);
  } catch {}
  KB.rows = DEFAULT_KEYBOARD.rows;
  KB.cols = DEFAULT_KEYBOARD.cols;
  KB.physKeys = DEFAULT_KEYBOARD.physKeys;
  KB.name = DEFAULT_KEYBOARD.name;
  KB.layers = DEFAULT_KEYBOARD.layers;
  KB.layerCount = DEFAULT_KEYBOARD.layers.length;
  KB.source = "default";
  KB.label = "";
  KB.viewLayer = 0;
  charCache.clear();
  setStatus("", DEFAULT_STATUS_TEXT);
  invalidate();
}

// The "clear keymap" button only shows when a saved keymap exists.
// Determined by whether the source is other than sample/default (i.e. saved on load), so we avoid reading localStorage on every render.
export function hasSavedKeymap() {
  return KB.source !== "sample" && KB.source !== "default";
}

// result of findKeyForChar: the key to press and the key(s) to hold
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

// estimate finger number from the physical layout (1=thumb, 2=index, 3=middle, 4=ring, 5=pinky)
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

// Heuristic: split into left/right hands at the board's center. For split boards (even row count >= 6),
// the last row of each half is the thumb; otherwise, rotated keys and wide keys (space, etc.) are the thumb.
// The rest are assigned column by column from the inside out: 2 columns for the index finger, then middle,
// ring, and pinky for the remainder; a column with only one key merges into its nearest neighbor.
function buildFingerMap() {
  const map = new Map<string, number>();
  if (!KB.physKeys.length) return map;
  const entries = KB.physKeys.map((k) => ({ k, cx: k.x + k.w / 2 }));
  const midX = (Math.min(...entries.map((e) => e.cx)) + Math.max(...entries.map((e) => e.cx))) / 2;
  const splitHalves = KB.rows >= 6 && KB.rows % 2 === 0;
  const thumbRows = splitHalves ? [KB.rows / 2 - 1, KB.rows - 1] : [];
  // Non-split board: only rotated keys, or wide keys in the bottom row (space, etc.), are the thumb.
  // Wide keys outside the bottom row (Shift/Enter/Backspace, etc.) are not the thumb.
  const maxRow = Math.max(...entries.map((e) => e.k.row));
  const isThumb = (e: { k: PhysKey; cx: number }) =>
    splitHalves ? thumbRows.includes(e.k.row) : e.k.r !== 0 || (e.k.row === maxRow && e.k.w >= 1.75);
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
        // keys with Ctrl/Alt/GUI are shortcuts (e.g. LSG(4)=Sft+GUI+4), not character input
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
