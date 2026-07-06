// 既定のキーボード: キーマップ未読込時に表示する標準USテンキーレス(60%)配列。
// 実機を接続しなくてもすぐ練習を始められるようにする（読み取り/ドロップで置き換え可能）
import { K_NONE, type KeyDef } from "./keycodes";
import type { PhysKey } from "./layout";

const ROWS = 5;
const COLS = 14;

interface KeySpec {
  code: number;
  w?: number;
}

// 標準的な61キー US ANSI(60%)配列。分割キーボードではないため、
// row/col はマトリクスの電気的な意味を持たず、単なる位置識別子として使う
const ROW_SPECS: KeySpec[][] = [
  [
    { code: 0x35 },
    { code: 0x1e },
    { code: 0x1f },
    { code: 0x20 },
    { code: 0x21 },
    { code: 0x22 },
    { code: 0x23 },
    { code: 0x24 },
    { code: 0x25 },
    { code: 0x26 },
    { code: 0x27 },
    { code: 0x2d },
    { code: 0x2e },
    { code: 0x2a, w: 2 }, // Backspace
  ],
  [
    { code: 0x2b, w: 1.5 }, // Tab
    { code: 0x14 },
    { code: 0x1a },
    { code: 0x08 },
    { code: 0x15 },
    { code: 0x17 },
    { code: 0x1c },
    { code: 0x18 },
    { code: 0x0c },
    { code: 0x12 },
    { code: 0x13 },
    { code: 0x2f },
    { code: 0x30 },
    { code: 0x31, w: 1.5 }, // \
  ],
  [
    { code: 0x39, w: 1.75 }, // Caps Lock
    { code: 0x04 },
    { code: 0x16 },
    { code: 0x07 },
    { code: 0x09 },
    { code: 0x0a },
    { code: 0x0b },
    { code: 0x0d },
    { code: 0x0e },
    { code: 0x0f },
    { code: 0x33 },
    { code: 0x34 },
    { code: 0x28, w: 2.25 }, // Enter
  ],
  [
    { code: 0xe1, w: 2.25 }, // Left Shift
    { code: 0x1d },
    { code: 0x1b },
    { code: 0x06 },
    { code: 0x19 },
    { code: 0x05 },
    { code: 0x11 },
    { code: 0x10 },
    { code: 0x36 },
    { code: 0x37 },
    { code: 0x38 },
    { code: 0xe5, w: 2.75 }, // Right Shift
  ],
  [
    { code: 0xe0, w: 1.25 }, // Left Ctrl
    { code: 0xe3, w: 1.25 }, // Left GUI
    { code: 0xe2, w: 1.25 }, // Left Alt
    { code: 0x2c, w: 6.25 }, // Space
    { code: 0xe6, w: 1.25 }, // Right Alt
    { code: 0xe7, w: 1.25 }, // Right GUI
    { code: 0x65, w: 1.25 }, // Menu
    { code: 0xe4, w: 1.25 }, // Right Ctrl
  ],
];

function buildDefaultLayout() {
  const physKeys: PhysKey[] = [];
  const layer: KeyDef[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(K_NONE));
  ROW_SPECS.forEach((rowSpec, row) => {
    let x = 0;
    rowSpec.forEach((spec, col) => {
      const w = spec.w ?? 1;
      physKeys.push({ row, col, x, y: row, w, h: 1, r: 0, rx: 0, ry: 0 });
      layer[row][col] = { t: "kc", code: spec.code, mods: 0 };
      x += w;
    });
  });
  return { physKeys, layer };
}

const { physKeys, layer } = buildDefaultLayout();

export const DEFAULT_STATUS_TEXT = "既定のUS配列キーボードを表示中（読み取り/ドロップで置き換え可）";

export const DEFAULT_KEYBOARD = {
  rows: ROWS,
  cols: COLS,
  physKeys,
  name: "US配列キーボード",
  layers: [layer] as KeyDef[][][],
};
