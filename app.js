/* ================================================================
   Cornix Typing — keymap-aware typing trainer for the Cornix
   (Jezail Funder) split keyboard.
   Sections:
     1. Physical layout (KLE data from vial.json) + parser
     2. Keycode tables & decoding (QMK/Vial numeric + .vil strings)
     3. Keymap state & reverse lookup (char -> key/shift/layer)
     4. Keyboard rendering
     5. WebHID (Vial/VIA protocol) reader + .vil import
     6. Practice engine (EN / JP romaji / symbols / guided key unlocking)
   ================================================================ */

/* ---------- 1. Physical layout ---------- */
let MATRIX_ROWS = 8,
  MATRIX_COLS = 7;

// KLE data taken from the Cornix vial.json (keys labelled "row,col")
const KLE = [
  [{ x: 3.5 }, "0,3", { x: 10.5 }, "4,3"],
  [{ x: 2.5, y: -0.875 }, "0,2", { x: 1 }, "0,4", { x: 8.5 }, "4,4", { x: 1 }, "4,2"],
  [{ x: 5.5, y: -0.875 }, "0,5", { x: 6.5 }, "4,5"],
  [{ x: 0.5, y: -0.875 }, "0,0", "0,1", { x: 14.5 }, "4,1", "4,0"],
  [{ x: 3.5, y: -0.375 }, "1,3", { x: 10.5 }, "5,3"],
  [{ x: 2.5, y: -0.875 }, "1,2", { x: 1 }, "1,4", { x: 8.5 }, "5,4", { x: 1 }, "5,2"],
  [{ x: 5.5, y: -0.875 }, "1,5", { x: 6.5 }, "5,5"],
  [{ x: 8, y: -0.9 }, "0,1\n\n\n\n\n\n\n\n\ne", { x: 1.5 }, "1,1\n\n\n\n\n\n\n\n\ne"],
  [{ x: 0.5, y: -0.975 }, "1,0", "1,1", { x: 14.5 }, "5,1", "5,0"],
  [{ x: 3.5, y: -0.375 }, "2,3", { x: 2.2 }, "2,6", { x: 4.1 }, "5,6", { x: 2.2 }, "6,3"],
  [{ x: 2.5, y: -0.875 }, "2,2", { x: 1 }, "2,4", { x: 8.5 }, "6,4", { x: 1 }, "6,2"],
  [{ x: 5.5, y: -0.875 }, "2,5", { x: 6.5 }, "6,5"],
  [{ x: 0.5, y: -0.875 }, "2,0", "2,1", { x: 14.5 }, "6,1", "6,0"],
  [{ x: 8, y: -0.725 }, "0,0\n\n\n\n\n\n\n\n\ne", { x: 1.5 }, "1,0\n\n\n\n\n\n\n\n\ne"],
  [{ x: 2.5, y: -0.525 }, "3,2", { x: 12.5 }, "7,2"],
  [{ x: 0.5, y: -0.75 }, "3,0", "3,1", { x: 14.5 }, "7,1", "7,0"],
  [{ x: 4.1667, y: -0.95 }, "3,3", { x: 9.1666 }, "7,3"],
  [{ r: 8, rx: 5.22, ry: 4.43, y: -1 }, "3,4"],
  [{ r: 16, rx: 6.27, ry: 4.6, y: -1.02 }, "3,5"],
  [{ r: -16, rx: 13.23, x: -1, y: -1.02 }, "7,5"],
  [{ r: -8, rx: 14.28, ry: 4.43, x: -1, y: -1 }, "7,4"],
];

// Parse KLE -> array of physical keys {row,col,x,y,w,h,r,rx,ry}
function parseKLE(kle) {
  const keys = [];
  const c = { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, clusterX: 0, clusterY: 0 };
  for (const row of kle) {
    if (!Array.isArray(row)) continue; // KLE metadata entry
    for (const item of row) {
      if (typeof item === "object") {
        if (item.d) c.decal = true;
        if (item.r !== undefined) c.r = item.r;
        if (item.rx !== undefined) {
          c.clusterX = c.rx = item.rx;
          c.x = c.clusterX;
          c.y = c.clusterY;
        }
        if (item.ry !== undefined) {
          c.clusterY = c.ry = item.ry;
          c.x = c.clusterX;
          c.y = c.clusterY;
        }
        c.x += item.x || 0;
        c.y += item.y || 0;
        if (item.w) c.w = item.w;
        if (item.h) c.h = item.h;
      } else {
        const parts = item.split("\n");
        const isEncoder = parts[9] === "e"; // Vial: 10th legend "e" = encoder
        const opt = parts[3] ? parts[3].split(",").map(Number) : null; // VIA layout option "group,choice"
        const mpos = parts[0].split(",").map(Number);
        if (
          !isEncoder &&
          !c.decal &&
          mpos.length === 2 &&
          !Number.isNaN(mpos[0]) &&
          !Number.isNaN(mpos[1]) &&
          (!opt || opt.length < 2 || opt[1] === 0)
        ) {
          // show default layout option (0)
          keys.push({ row: mpos[0], col: mpos[1], x: c.x, y: c.y, w: c.w, h: c.h, r: c.r, rx: c.rx, ry: c.ry });
        }
        c.x += c.w;
        c.w = 1;
        c.h = 1;
        c.decal = false;
      }
    }
    c.y += 1;
    c.x = c.clusterX;
  }
  return keys;
}
let PHYS_KEYS = parseKLE(KLE);

/* ---------- generic Vial definition support ---------- */
const KBDEF = { name: "Cornix" };

// apply a vial.json-style definition: {name, matrix:{rows,cols}, layouts:{keymap:[KLE]}}
function applyDefinition(def, label) {
  if (!def?.matrix || !def.layouts || !Array.isArray(def.layouts.keymap))
    throw new Error("vial.json形式ではありません");
  const keys = parseKLE(def.layouts.keymap);
  if (!keys.length) throw new Error("レイアウトにキーがありません");
  MATRIX_ROWS = def.matrix.rows;
  MATRIX_COLS = def.matrix.cols;
  PHYS_KEYS = keys;
  // some stock firmwares ship a generic name ("HID Keyboard") — prefer the OS device name then
  const generic = !def.name || /^hid[ _-]?keyboard$/i.test(def.name.trim()) || /^keyboard$/i.test(def.name.trim());
  KBDEF.name = (generic ? label : def.name) || def.name || label || "Keyboard";
  renderKeyboard();
  const empty = [Array.from({ length: MATRIX_ROWS }, () => Array(MATRIX_COLS).fill(K_NONE))];
  setKeymap(empty, "sample");
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error("CDNからのデコーダ読み込みに失敗"));
    document.head.appendChild(s);
  });
}

// vial definitions are xz-compressed JSON (RMK & vial-qmk both use the XZ container)
let xzModule = null;
async function getXz() {
  if (xzModule) return xzModule;
  // the CDN build is CommonJS, so fetch the source and evaluate it with a tiny shim
  const resp = await fetch("https://cdn.jsdelivr.net/npm/xz-decompress@0.2.3/dist/package/xz-decompress.min.js");
  if (!resp.ok) throw new Error("xzデコーダのダウンロードに失敗 (" + resp.status + ")");
  const code = await resp.text();
  const mod = { exports: {} };
  // UMD bundle takes the CJS branch and calls require("stream/web") -> hand it the browser globals
  const requireStub = () => ({
    ReadableStream: window.ReadableStream,
    WritableStream: window.WritableStream,
    TransformStream: window.TransformStream,
    CountQueuingStrategy: window.CountQueuingStrategy,
    ByteLengthQueuingStrategy: window.ByteLengthQueuingStrategy,
  });
  new Function("module", "exports", "require", code)(mod, mod.exports, requireStub);
  if (!mod.exports.XzReadableStream) throw new Error("xzデコーダの初期化に失敗");
  xzModule = mod.exports;
  return xzModule;
}
async function decompressDefinition(buf) {
  if (buf[0] === 0xfd && buf[1] === 0x37 && buf[2] === 0x7a) {
    // .xz magic
    const { XzReadableStream } = await getXz();
    return await new Response(new XzReadableStream(new Blob([buf]).stream())).text();
  }
  await loadScript("https://cdn.jsdelivr.net/npm/lzma@2.3.2/src/lzma_worker.js"); // LZMA_ALONE fallback
  const L = window.LZMA_WORKER || window.LZMA;
  if (!L) throw new Error("lzmaデコーダの読み込みに失敗");
  return new Promise((res, rej) =>
    L.decompress(Array.from(buf), (r, e) =>
      e ? rej(new Error(String(e))) : res(typeof r === "string" ? r : new TextDecoder().decode(new Uint8Array(r))),
    ),
  );
}

/* ---------- 2. Keycode tables & decoding ---------- */

// HID usage -> [unshifted char, shifted char] (US layout)
const HID_CHARS = {};
(() => {
  const az = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < 26; i++) HID_CHARS[0x04 + i] = [az[i], az[i].toUpperCase()];
  const num = "1234567890",
    numS = "!@#$%^&*()";
  for (let i = 0; i < 10; i++) HID_CHARS[0x1e + i] = [num[i], numS[i]];
  Object.assign(HID_CHARS, {
    0x28: ["\n", "\n"],
    0x2b: ["\t", "\t"],
    0x2c: [" ", " "],
    0x2d: ["-", "_"],
    0x2e: ["=", "+"],
    0x2f: ["[", "{"],
    0x30: ["]", "}"],
    0x31: ["\\", "|"],
    0x32: ["#", "~"],
    0x33: [";", ":"],
    0x34: ["'", '"'],
    0x35: ["`", "~"],
    0x36: [",", "<"],
    0x37: [".", ">"],
    0x38: ["/", "?"],
    0x54: ["/", "/"],
    0x55: ["*", "*"],
    0x56: ["-", "-"],
    0x57: ["+", "+"],
    0x58: ["\n", "\n"],
    0x63: [".", "."],
    0x67: ["=", "="],
  });
  const kp = "1234567890";
  for (let i = 0; i < 10; i++) HID_CHARS[0x59 + i] = [kp[i], kp[i]];
})();

// JIS interpretation (OS set to JIS *without* firmware US-conversion)
const HID_CHARS_JIS = {
  0x1f: ["2", '"'],
  0x23: ["6", "&"],
  0x24: ["7", "'"],
  0x25: ["8", "("],
  0x26: ["9", ")"],
  0x27: ["0", ""],
  0x2d: ["-", "="],
  0x2e: ["^", "~"],
  0x2f: ["@", "`"],
  0x30: ["[", "{"],
  0x31: ["]", "}"],
  0x32: ["]", "}"],
  0x33: [";", "+"],
  0x34: [":", "*"],
  0x87: ["\\", "_"], // INT1 ろ
  0x89: ["\\", "|"], // INT3 ¥
};
// "us" = output matches US legends (OS=US plain, or OS=JIS + firmware US-conversion)
// "jis" = output matches JIS legends (OS=JIS plain, or OS=US + firmware JIS-conversion)
let outMode = "us";
try {
  if (localStorage.getItem("cornixOutMode") === "jis") outMode = "jis";
} catch {}
function charsOf(code) {
  if (outMode === "jis") {
    if (code in HID_CHARS_JIS) return HID_CHARS_JIS[code];
    if (code === 0x35) return undefined; // JIS: 半角/全角 — no character output
  }
  return HID_CHARS[code];
}

// labels for non-character HID codes
const KEYLABELS = {
  0x00: "",
  0x29: "Esc",
  0x2a: "⌫",
  0x39: "Caps",
  0x46: "PrtSc",
  0x47: "ScrLk",
  0x48: "Pause",
  0x49: "Ins",
  0x4a: "Home",
  0x4b: "PgUp",
  0x4c: "Del",
  0x4d: "End",
  0x4e: "PgDn",
  0x4f: "→",
  0x50: "←",
  0x51: "↓",
  0x52: "↑",
  0x53: "Num",
  0x65: "App",
  0x28: "⏎",
  0x2b: "Tab",
  0x2c: "Space",
  0xe0: "Ctrl",
  0xe1: "Shift",
  0xe2: "Alt",
  0xe3: "GUI",
  0xe4: "Ctrl",
  0xe5: "Shift",
  0xe6: "Alt",
  0xe7: "GUI",
  0x35: "半/全",
  0x88: "かな",
  0x8a: "変換",
  0x8b: "無変換",
  0x90: "IME ON",
  0x91: "IME OFF", // LANG1 / LANG2（macOS の かな / 英数）
};
for (let i = 0; i < 12; i++) KEYLABELS[0x3a + i] = "F" + (i + 1); // F1-F12
for (let i = 0; i < 12; i++) KEYLABELS[0x68 + i] = "F" + (i + 13); // F13-F24 (HID 0x68-0x73)

const modsHaveShift = (m) => !!(m & 0x02);
function modsLabel(m) {
  const p = [];
  if (m & 1) p.push("Ctrl");
  if (m & 2) p.push("Sft");
  if (m & 4) p.push("Alt");
  if (m & 8) p.push("GUI");
  return p.join("+");
}

// KC_ name -> HID code (for .vil parsing)
const KC_NAMES = {};
(() => {
  const az = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < 26; i++) KC_NAMES["KC_" + az[i]] = 0x04 + i;
  "1234567890".split("").forEach((d, i) => {
    KC_NAMES["KC_" + d] = 0x1e + i;
  });
  const alias = {
    ENTER: 0x28,
    ENT: 0x28,
    ESCAPE: 0x29,
    ESC: 0x29,
    BSPACE: 0x2a,
    BSPC: 0x2a,
    BACKSPACE: 0x2a,
    TAB: 0x2b,
    SPACE: 0x2c,
    SPC: 0x2c,
    MINUS: 0x2d,
    MINS: 0x2d,
    EQUAL: 0x2e,
    EQL: 0x2e,
    LBRACKET: 0x2f,
    LBRC: 0x2f,
    LEFT_BRACKET: 0x2f,
    RBRACKET: 0x30,
    RBRC: 0x30,
    RIGHT_BRACKET: 0x30,
    BSLASH: 0x31,
    BSLS: 0x31,
    BACKSLASH: 0x31,
    NONUS_HASH: 0x32,
    NUHS: 0x32,
    SCOLON: 0x33,
    SCLN: 0x33,
    SEMICOLON: 0x33,
    QUOTE: 0x34,
    QUOT: 0x34,
    GRAVE: 0x35,
    GRV: 0x35,
    COMMA: 0x36,
    COMM: 0x36,
    DOT: 0x37,
    SLASH: 0x38,
    SLSH: 0x38,
    CAPSLOCK: 0x39,
    CAPS: 0x39,
    CAPS_LOCK: 0x39,
    PSCREEN: 0x46,
    PSCR: 0x46,
    PRINT_SCREEN: 0x46,
    SCROLLLOCK: 0x47,
    SCRL: 0x47,
    PAUSE: 0x48,
    PAUS: 0x48,
    INSERT: 0x49,
    INS: 0x49,
    HOME: 0x4a,
    PGUP: 0x4b,
    PAGE_UP: 0x4b,
    DELETE: 0x4c,
    DEL: 0x4c,
    END: 0x4d,
    PGDN: 0x4e,
    PGDOWN: 0x4e,
    PAGE_DOWN: 0x4e,
    RIGHT: 0x4f,
    RGHT: 0x4f,
    LEFT: 0x50,
    DOWN: 0x51,
    UP: 0x52,
    NUMLOCK: 0x53,
    NLCK: 0x53,
    NUM_LOCK: 0x53,
    NUM: 0x53,
    KP_SLASH: 0x54,
    PSLS: 0x54,
    KP_ASTERISK: 0x55,
    PAST: 0x55,
    KP_MINUS: 0x56,
    PMNS: 0x56,
    KP_PLUS: 0x57,
    PPLS: 0x57,
    KP_ENTER: 0x58,
    PENT: 0x58,
    KP_DOT: 0x63,
    PDOT: 0x63,
    KP_EQUAL: 0x67,
    PEQL: 0x67,
    KP_EQUAL_AS400: 0x86,
    APPLICATION: 0x65,
    APP: 0x65,
    NONUS_BSLASH: 0x64,
    NUBS: 0x64,
    LCTRL: 0xe0,
    LCTL: 0xe0,
    LEFT_CTRL: 0xe0,
    LSHIFT: 0xe1,
    LSFT: 0xe1,
    LEFT_SHIFT: 0xe1,
    LALT: 0xe2,
    LEFT_ALT: 0xe2,
    LOPT: 0xe2,
    LGUI: 0xe3,
    LCMD: 0xe3,
    LWIN: 0xe3,
    LEFT_GUI: 0xe3,
    RCTRL: 0xe4,
    RCTL: 0xe4,
    RIGHT_CTRL: 0xe4,
    RSHIFT: 0xe5,
    RSFT: 0xe5,
    RIGHT_SHIFT: 0xe5,
    RALT: 0xe6,
    RIGHT_ALT: 0xe6,
    ROPT: 0xe6,
    ALGR: 0xe6,
    RGUI: 0xe7,
    RCMD: 0xe7,
    RWIN: 0xe7,
    RIGHT_GUI: 0xe7,
    INT1: 0x87,
    RO: 0x87,
    INT2: 0x88,
    KANA: 0x88,
    INT3: 0x89,
    JYEN: 0x89,
    YEN: 0x89,
    INT4: 0x8a,
    HENK: 0x8a,
    INT5: 0x8b,
    MHEN: 0x8b,
    LNG1: 0x90,
    LANG1: 0x90,
    LNG2: 0x91,
    LANG2: 0x91,
    LNG3: 0x92,
    LANG3: 0x92,
    LNG4: 0x93,
    LANG4: 0x93,
    LNG5: 0x94,
    LANG5: 0x94,
  };
  for (const [n, c] of Object.entries(alias)) KC_NAMES["KC_" + n] = c;
  for (let i = 1; i <= 12; i++) KC_NAMES["KC_F" + i] = 0x3a + i - 1; // F1-F12
  for (let i = 13; i <= 24; i++) KC_NAMES["KC_F" + i] = 0x68 + i - 13; // F13-F24 (HID 0x68-0x73)
  for (let i = 1; i <= 9; i++) {
    KC_NAMES["KC_KP_" + i] = 0x58 + i;
    KC_NAMES["KC_P" + i] = 0x58 + i;
  }
  KC_NAMES.KC_KP_0 = 0x62;
  KC_NAMES.KC_P0 = 0x62;
})();

/* decoded key object types:
   none | trans | kc{code,mods} | mt{mods,tap} | lt{layer,tap}
   | mo/tg/to/df/osl/tt{layer} | osm{mods} | custom{label} | unknown{code} */
const K_NONE = { t: "none" },
  K_TRANS = { t: "trans" };

// numeric QMK/Vial keycode -> decoded object (handles both old-Vial and new-QMK layer ranges)
function decodeNum(n) {
  if (n === 0) return K_NONE;
  if (n === 1) return K_TRANS;
  if (n <= 0xff) return { t: "kc", code: n, mods: 0 };
  if (n <= 0x1fff) return { t: "kc", code: n & 0xff, mods: (n >> 8) & 0x1f };
  if (n >= 0x2000 && n <= 0x3fff) return { t: "mt", mods: (n >> 8) & 0x1f, tap: n & 0xff }; // new MT
  if (n >= 0x4000 && n <= 0x4fff) return { t: "lt", layer: (n >> 8) & 0xf, tap: n & 0xff };
  if (n >= 0x5000 && n <= 0x50ff) return { t: "to", layer: n & 0x0f }; // old TO
  if (n >= 0x5100 && n <= 0x51ff) return { t: "mo", layer: n & 0xff }; // old MO
  if (n >= 0x5200 && n <= 0x521f) return { t: "to", layer: n & 0x1f }; // old DF / new TO
  if (n >= 0x5220 && n <= 0x523f) return { t: "mo", layer: n - 0x5220 }; // new MO
  if (n >= 0x5240 && n <= 0x525f) return { t: "df", layer: n - 0x5240 }; // new DF
  if (n >= 0x5260 && n <= 0x527f) return { t: "tg", layer: n - 0x5260 }; // new TG
  if (n >= 0x5280 && n <= 0x529f) return { t: "osl", layer: n - 0x5280 }; // new OSL
  if (n >= 0x52a0 && n <= 0x52bf) return { t: "osm", mods: n & 0x1f }; // new OSM
  if (n >= 0x52c0 && n <= 0x52df) return { t: "tt", layer: n - 0x52c0 }; // new TT
  if (n >= 0x5300 && n <= 0x53ff) return { t: "tg", layer: n & 0xff }; // old TG
  if (n >= 0x5400 && n <= 0x54ff) return { t: "osl", layer: n & 0xff }; // old OSL
  if (n >= 0x5500 && n <= 0x55ff) return { t: "osm", mods: n & 0x1f }; // old OSM
  if (n >= 0x5700 && n <= 0x57ff) return { t: "custom", label: "TD" + (n & 0xff) };
  if (n >= 0x5800 && n <= 0x58ff) return { t: "tt", layer: n & 0xff }; // old TT
  if (n >= 0x5900 && n <= 0x59ff) return { t: "lm", layer: (n >> 4) & 0xf, mods: n & 0xf }; // old LM(layer, mod)
  if (n >= 0x6000 && n <= 0x7fff) return { t: "mt", mods: (n >> 8) & 0x1f, tap: n & 0xff }; // old MT
  return { t: "unknown", code: n };
}

// .vil keycode string -> decoded object
const MT_MODS = {
  LCTL: 1,
  CTL: 1,
  LSFT: 2,
  SFT: 2,
  LALT: 4,
  ALT: 4,
  LGUI: 8,
  GUI: 8,
  LCMD: 8,
  LWIN: 8,
  RCTL: 0x11,
  RSFT: 0x12,
  RALT: 0x14,
  RGUI: 0x18,
  RCMD: 0x18,
  RWIN: 0x18,
  C: 1,
  S: 2,
  A: 4,
  G: 8,
  LCA: 5,
  LSA: 6,
  LCAG: 13,
  LCG: 9,
  LSG: 10,
  LAG: 12,
  SGUI: 10,
  RCA: 0x15,
  RSA: 0x16,
  RCG: 0x19,
  RSG: 0x1a,
  RAG: 0x1c,
  C_S: 3,
  MEH: 7,
  HYPR: 15,
  ALL: 15,
};
function parseVil(s) {
  if (s === -1 || s === "-1" || s == null) return K_NONE;
  if (typeof s === "number") return decodeNum(s);
  s = String(s).trim();
  if (SHIFTED_ALIAS?.[s]) s = SHIFTED_ALIAS[s];
  if (s === "" || s === "KC_NO" || s === "KC_NONE") return K_NONE;
  if (s === "KC_TRNS" || s === "KC_TRANSPARENT") return K_TRANS;
  if (s in KC_NAMES) return { t: "kc", code: KC_NAMES[s], mods: 0 };
  let m;
  if ((m = s.match(/^MO\((\d+)\)$/))) return { t: "mo", layer: +m[1] };
  if ((m = s.match(/^TG\((\d+)\)$/))) return { t: "tg", layer: +m[1] };
  if ((m = s.match(/^TO\((\d+)\)$/))) return { t: "to", layer: +m[1] };
  if ((m = s.match(/^TT\((\d+)\)$/))) return { t: "tt", layer: +m[1] };
  if ((m = s.match(/^DF\((\d+)\)$/))) return { t: "df", layer: +m[1] };
  if ((m = s.match(/^OSL\((\d+)\)$/))) return { t: "osl", layer: +m[1] };
  if ((m = s.match(/^LM\((\d+),\s*(.+)\)$/)))
    return { t: "lm", layer: +m[1], mods: /SFT|SHIFT/.test(m[2]) ? 2 : MT_MODS[m[2].replace(/^MOD_/, "")] || 0 };
  if ((m = s.match(/^OSM\((.+)\)$/))) return { t: "osm", mods: 2 };
  if ((m = s.match(/^LT(\d+)\((.+)\)$/)) || (m = s.match(/^LT\((\d+),\s*(.+)\)$/))) {
    const inner = parseVil(m[2]);
    return { t: "lt", layer: +m[1], tap: inner.t === "kc" ? inner.code : 0 };
  }
  if ((m = s.match(/^([A-Z_]+)_T\((.+)\)$/))) {
    const inner = parseVil(m[2]);
    return { t: "mt", mods: MT_MODS[m[1]] || 0, tap: inner.t === "kc" ? inner.code : 0 };
  }
  if (
    (m = s.match(/^(LCTL|LSFT|LALT|LGUI|RCTL|RSFT|RALT|RGUI|C|S|A|G|LCA|LSA|LCAG|LCG|LSG|LAG|SGUI|MEH|HYPR)\((.+)\)$/))
  ) {
    const inner = parseVil(m[2]);
    if (inner.t === "kc") return { t: "kc", code: inner.code, mods: inner.mods | (MT_MODS[m[1]] || 0) };
    return { t: "custom", label: s };
  }
  return { t: "custom", label: s.replace(/^KC_/, "") };
}

/* ---------- 3. Keymap state & reverse lookup ---------- */

const KB = { layers: [], layerCount: 0, source: "sample" };

// shifted-symbol aliases (vial writes these in .vil files too)
const SHIFTED_ALIAS = {
  KC_EXLM: "LSFT(KC_1)",
  KC_AT: "LSFT(KC_2)",
  KC_HASH: "LSFT(KC_3)",
  KC_DLR: "LSFT(KC_4)",
  KC_PERC: "LSFT(KC_5)",
  KC_CIRC: "LSFT(KC_6)",
  KC_AMPR: "LSFT(KC_7)",
  KC_ASTR: "LSFT(KC_8)",
  KC_LPRN: "LSFT(KC_9)",
  KC_RPRN: "LSFT(KC_0)",
  KC_TILD: "LSFT(KC_GRV)",
  KC_UNDS: "LSFT(KC_MINS)",
  KC_PLUS: "LSFT(KC_EQL)",
  KC_LCBR: "LSFT(KC_LBRC)",
  KC_RCBR: "LSFT(KC_RBRC)",
  KC_PIPE: "LSFT(KC_BSLS)",
  KC_COLN: "LSFT(KC_SCLN)",
  KC_DQUO: "LSFT(KC_QUOT)",
  KC_LABK: "LSFT(KC_COMM)",
  KC_RABK: "LSFT(KC_DOT)",
  KC_QUES: "LSFT(KC_SLSH)",
};
const KEYMAP_STORE_KEY = "vialTypingKeymap";

function setKeymap(layers, source, label, restored) {
  KB.layers = layers;
  KB.layerCount = layers.length;
  KB.source = source;
  KB.label = label || "";
  charCache.clear();
  buildLayerTabs();
  rebuildLayerSelects();
  setViewLayer(0);
  const st = document.getElementById("status");
  if (source === "sample") {
    st.className = "";
    st.textContent = "キーマップ未読込（サンプル表示中）";
  } else {
    st.className = "ok";
    st.textContent = "✓ " + label + "（" + layers.length + "レイヤー）" + (restored ? " · 前回のキーマップを復元" : "");
    // 実際に読み込んだレイアウト+キーマップをブラウザに保存し、次回自動復元する
    if (!restored) saveKeymap(layers, source, label);
  }
  updateForgetBtn();
  engine?.refreshHint();
}

// 直近のレイアウト定義＋キーマップをlocalStorageへ保存
function saveKeymap(layers, source, label) {
  try {
    localStorage.setItem(
      KEYMAP_STORE_KEY,
      JSON.stringify({
        v: 1,
        source,
        label,
        matrixRows: MATRIX_ROWS,
        matrixCols: MATRIX_COLS,
        physKeys: PHYS_KEYS,
        kbName: KBDEF.name,
        layers,
      }),
    );
  } catch {
    /* 容量超過/プライベートモード等は無視 */
  }
}

// 保存済みレイアウト＋キーマップを復元（成功時true）
function restoreSavedKeymap() {
  try {
    const raw = localStorage.getItem(KEYMAP_STORE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.layers) || !d.layers.length || !Array.isArray(d.physKeys) || !d.physKeys.length)
      return false;
    MATRIX_ROWS = d.matrixRows || MATRIX_ROWS;
    MATRIX_COLS = d.matrixCols || MATRIX_COLS;
    PHYS_KEYS = d.physKeys;
    KBDEF.name = d.kbName || d.label || "Keyboard";
    renderKeyboard();
    setKeymap(d.layers, d.source || "vil", d.label || "保存済みキーマップ", true);
    return true;
  } catch {
    return false;
  }
}

// 保存済みを破棄して未読込状態に戻す
function forgetSavedKeymap() {
  try {
    localStorage.removeItem(KEYMAP_STORE_KEY);
  } catch {}
  KB.layers = [];
  KB.layerCount = 0;
  KB.source = "sample";
  KB.label = "";
  charCache.clear();
  showKbPlaceholder();
  buildLayerTabs();
  rebuildLayerSelects();
  const st = document.getElementById("status");
  st.className = "";
  st.textContent = "キーボード未読込";
  updateForgetBtn();
  engine?.idle();
}

// 「保存を消す」ボタンは保存済みキーマップがあるときだけ表示
function updateForgetBtn() {
  const b = document.getElementById("btnForget");
  if (!b) return;
  let has = false;
  try {
    has = !!localStorage.getItem(KEYMAP_STORE_KEY);
  } catch {}
  b.hidden = !has;
}

// transparent keys fall through to the base layer
function effKey(L, r, c) {
  let k = KB.layers[L]?.[r] ? KB.layers[L][r][c] : K_NONE;
  if (k.t === "trans" && L > 0) k = KB.layers[0][r][c];
  return k || K_NONE;
}
const handOf = (r) => (r < 4 ? "L" : "R");

// tap output of a decoded key: {code, mods} or null
function tapOf(k) {
  if (k.t === "kc") return { code: k.code, mods: k.mods };
  if (k.t === "mt" || k.t === "lt") return { code: k.tap, mods: 0 };
  return null;
}

// physical-key check: the matrix can contain keycodes at positions that have no
// physical key on the board — those must never be suggested
let _physRef = null,
  _physSet = null;
function physHas(r, c) {
  if (_physRef !== PHYS_KEYS) {
    _physRef = PHYS_KEYS;
    _physSet = new Set(PHYS_KEYS.map((k) => k.row + "," + k.col));
  }
  return _physSet.has(r + "," + c);
}

// 物理配置から指番号を推定する (1=親指, 2=人差し指, 3=中指, 4=薬指, 5=小指)
const FINGER_NAMES = { 1: "親指", 2: "人差し指", 3: "中指", 4: "薬指", 5: "小指" };
let _fingerRef = null;
let _fingerMap = null;
function fingerFor(row, col) {
  if (_fingerRef !== PHYS_KEYS) {
    _fingerRef = PHYS_KEYS;
    _fingerMap = buildFingerMap();
  }
  return _fingerMap.get(row + "," + col) ?? null;
}

// ヒューリスティック: 盤面中央で左右の手に分け、分割型(偶数行数>=6)は各半分の最終行を親指、
// それ以外は回転キーと横長キー(スペース等)を親指とする。残りは列単位で内側から
// 人差し指×2列・中指・薬指・以降は小指を割り当て、キー1個だけの列は最寄りの列に合流する
function buildFingerMap() {
  const map = new Map();
  if (!PHYS_KEYS.length) return map;
  const entries = PHYS_KEYS.map((k) => ({ k, cx: k.x + k.w / 2 }));
  const midX = (Math.min(...entries.map((e) => e.cx)) + Math.max(...entries.map((e) => e.cx))) / 2;
  const splitHalves = MATRIX_ROWS >= 6 && MATRIX_ROWS % 2 === 0;
  const thumbRows = splitHalves ? [MATRIX_ROWS / 2 - 1, MATRIX_ROWS - 1] : [];
  const isThumb = (e) => (splitHalves ? thumbRows.includes(e.k.row) : e.k.r !== 0 || e.k.w >= 1.75);
  for (const hand of ["L", "R"]) {
    const handKeys = entries.filter((e) => (hand === "L" ? e.cx <= midX : e.cx > midX));
    const fingerKeys = [];
    for (const e of handKeys) {
      if (isThumb(e)) map.set(e.k.row + "," + e.k.col, 1);
      else fingerKeys.push(e);
    }
    const cols = [];
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
function findShiftKey(layer, hand) {
  const collect = (L) => {
    const cands = [];
    for (let r = 0; r < MATRIX_ROWS; r++)
      for (let c = 0; c < MATRIX_COLS; c++) {
        if (!physHas(r, c)) continue;
        const k = effKey(L, r, c);
        if (
          (k.t === "kc" && k.mods === 0 && (k.code === 0xe1 || k.code === 0xe5)) ||
          (k.t === "mt" && modsHaveShift(k.mods)) ||
          (k.t === "osm" && modsHaveShift(k.mods))
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
  cands.sort((a, b) => (handOf(a.r) === hand) - (handOf(b.r) === hand) || b.plain - a.plain);
  if (!cands.length) return null;
  // fromBase: Shift only exists on the layer *before* switching, so it must be
  // pressed BEFORE (and held through) the layer key
  return Object.assign(cands[0], { fromBase });
}

// find a key on the base layer that reaches `layer` while held; returns its implied mods (for LM)
function findLayerKey(layer) {
  for (let r = 0; r < MATRIX_ROWS; r++)
    for (let c = 0; c < MATRIX_COLS; c++) {
      if (!physHas(r, c)) continue;
      const k = effKey(0, r, c);
      if ((k.t === "mo" || k.t === "lt" || k.t === "tt" || k.t === "osl" || k.t === "lm") && k.layer === layer)
        return { r, c, mods: k.t === "lm" ? k.mods : 0 };
    }
  return null;
}

// guidance preference when a character can be typed in multiple ways:
// "auto" = fewest holds & lowest layer, "shift" = prefer Shift combos, "layer" = prefer direct layer keys
const keyPref = { v: "auto" };
try {
  const p = localStorage.getItem("cornixPref");
  if (p === "shift" || p === "layer") keyPref.v = p;
} catch {}

// fixed guidance layer per character category ("auto" or a layer number as string)
const layerPref = { num: "auto", sym: "auto" };
try {
  const n = localStorage.getItem("cornixNumLayer"),
    s = localStorage.getItem("cornixSymLayer");
  if (n && n !== "auto" && !Number.isNaN(+n)) layerPref.num = n;
  if (s && s !== "auto" && !Number.isNaN(+s)) layerPref.sym = s;
} catch {}

// category of a character for layer preferences: digit / symbol / other(letters, space...)
function charCategory(ch) {
  if (/[0-9]/.test(ch)) return "num";
  if (/[a-zA-Z\s]/.test(ch)) return null;
  return "sym";
}

function rebuildLayerSelects() {
  for (const [id, key] of [
    ["selNumLayer", "num"],
    ["selSymLayer", "sym"],
  ]) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    sel.innerHTML = "";
    const optAuto = document.createElement("option");
    optAuto.value = "auto";
    optAuto.textContent = "自動";
    sel.appendChild(optAuto);
    for (let i = 0; i < KB.layerCount; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = "L" + i;
      sel.appendChild(o);
    }
    if (layerPref[key] !== "auto" && +layerPref[key] >= KB.layerCount) layerPref[key] = "auto";
    sel.value = layerPref[key];
  }
}

const charCache = new Map();
// char -> {key:{r,c}, layer, shiftKey, layerKey} or null
function findKeyForChar(ch) {
  if (charCache.has(ch)) return charCache.get(ch);
  const cat = charCategory(ch);
  const fixedL = cat && layerPref[cat] !== "auto" ? +layerPref[cat] : null;
  const cands = [];
  for (let L = 0; L < KB.layerCount; L++) {
    const layerKey = L === 0 ? null : findLayerKey(L);
    if (L > 0 && !layerKey) continue;
    // an LM(layer, Shift) key shifts every key on that layer (Shift+digit -> symbol)
    const lkShift = layerKey ? modsHaveShift(layerKey.mods) : false;
    for (let r = 0; r < MATRIX_ROWS; r++)
      for (let c = 0; c < MATRIX_COLS; c++) {
        if (!physHas(r, c)) continue;
        const raw = KB.layers[L][r][c];
        if (L > 0 && (raw.t === "trans" || raw.t === "none")) continue;
        const tap = tapOf(raw);
        if (!tap) continue;
        // Ctrl/Alt/GUI付きのキーはショートカット(例: LSG(4)=Sft+GUI+4)であり文字入力ではない
        if (tap.mods & 0x0d) continue;
        const chars = charsOf(tap.code);
        if (!chars) continue;
        let needShift = null;
        if (modsHaveShift(tap.mods) || lkShift) {
          if (chars[1] === ch) needShift = false;
        } else if (chars[0] === ch) needShift = false;
        else if (chars[1] === ch) needShift = true;
        if (needShift === null) continue;
        let shiftKey = null;
        if (needShift) {
          shiftKey = findShiftKey(L, handOf(r));
          if (!shiftKey) continue;
        }
        // one "hold" costs 10: layer hold + shift hold; prefer fewer holds, then lower layers.
        // the shift weight shifts with the user's guidance preference
        const shiftW = keyPref.v === "shift" ? 1 : keyPref.v === "layer" ? 30 : 12;
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

/* ---------- 4. Keyboard rendering ---------- */

const kbEl = document.getElementById("kb");
const keyEls = new Map(); // "r,c" -> element
let viewLayer = 0;

function legendFor(k) {
  switch (k.t) {
    case "none":
      return "";
    case "trans":
      return "▽";
    case "kc": {
      const ch = charsOf(k.code);
      if (ch) {
        // Shift以外の修飾(Ctrl/Alt/GUI)が付くキーはショートカット扱い:
        // 全修飾(Shiftを含む) + シフト前のベースキー を表示する (例: LSG(3) -> Sft+GUI+3)
        if (k.mods & 0x0d) {
          const raw = ch[0];
          const baseKey =
            raw === " "
              ? "Space"
              : raw === "\n"
                ? "⏎"
                : raw === "\t"
                  ? "Tab"
                  : /^[a-z]$/.test(raw)
                    ? raw.toUpperCase()
                    : raw;
          return modsLabel(k.mods) + "+" + baseKey;
        }
        const c = modsHaveShift(k.mods) ? ch[1] : ch[0];
        if (c === " ") return "Space";
        if (c === "\n") return "⏎";
        if (c === "\t") return "Tab";
        return /^[a-z]$/.test(c) ? c.toUpperCase() : c;
      }
      const lbl = KEYLABELS[k.code] || "0x" + k.code.toString(16);
      return k.mods ? modsLabel(k.mods) + "+" + lbl : lbl;
    }
    case "mt":
      return (modsLabel(k.mods) || "Mod") + "\n" + legendFor({ t: "kc", code: k.tap, mods: 0 });
    case "lt":
      return "L" + k.layer + "\n" + legendFor({ t: "kc", code: k.tap, mods: 0 });
    case "mo":
      return "MO(" + k.layer + ")";
    case "lm":
      return "LM(" + k.layer + (modsHaveShift(k.mods) ? ",Sft" : "") + ")";
    case "tg":
      return "TG(" + k.layer + ")";
    case "to":
      return "TO(" + k.layer + ")";
    case "tt":
      return "TT(" + k.layer + ")";
    case "df":
      return "DF(" + k.layer + ")";
    case "osl":
      return "OSL(" + k.layer + ")";
    case "osm":
      return "OSM";
    case "custom":
      return k.label.length > 7 ? k.label.slice(0, 7) : k.label;
    default:
      return "?";
  }
}

function renderKeyboard() {
  kbEl.innerHTML = "";
  keyEls.clear();
  let maxX = 0,
    maxY = 0,
    minX = 99,
    minY = 99;
  for (const k of PHYS_KEYS) {
    maxX = Math.max(maxX, k.x + k.w);
    maxY = Math.max(maxY, k.y + k.h + 0.6);
    minX = Math.min(minX, k.x);
    minY = Math.min(minY, k.y);
  }
  const pad = 0.25;
  // キーボード全体がコンテナ幅に収まるようユニット(--u)を動的計算（最大52px）
  const spanX = maxX - minX + pad * 2 || 1;
  const avail = kbEl.parentElement?.clientWidth || 1000;
  const U = Math.max(14, Math.min(52, avail / spanX));
  document.documentElement.style.setProperty("--u", U + "px");
  kbEl.style.width = (maxX - minX + pad * 2) * U + "px";
  kbEl.style.height = (maxY - minY + pad * 2) * U + "px";
  for (const k of PHYS_KEYS) {
    const el = document.createElement("div");
    el.className = "key";
    const gap = 3;
    el.style.left = (k.x - minX + pad) * U + gap / 2 + "px";
    el.style.top = (k.y - minY + pad) * U + gap / 2 + "px";
    el.style.width = k.w * U - gap + "px";
    el.style.height = k.h * U - gap + "px";
    if (k.r) {
      el.style.transformOrigin = (k.rx - k.x) * U + "px " + (k.ry - k.y) * U + "px";
      el.style.transform = "rotate(" + k.r + "deg)";
    }
    kbEl.appendChild(el);
    keyEls.set(k.row + "," + k.col, el);
  }
  updateLegends();
}

// shifted character printed in the keycap corner (5 -> %, ; -> : ...)
function shiftedSub(k) {
  const tap = tapOf(k);
  if (!tap || tap.mods) return "";
  const chars = charsOf(tap.code);
  if (!chars || chars[0] === chars[1]) return "";
  if (/^[a-z]$/.test(chars[0])) return ""; // A-Z: obvious, keep keycaps clean
  return chars[1];
}

function showKbPlaceholder() {
  keyEls.clear();
  kbEl.style.width = "auto";
  kbEl.style.height = "auto";
  kbEl.innerHTML =
    '<div class="kb-placeholder">⌨️ キーボードが未読込です<br>' +
    "<span>「🔌 キーボードから読み取る」を押すと、接続中のVial対応キーボードから" +
    "レイアウトとキーマップを自動で読み込みます。<br>" +
    "または vial.json（レイアウト）/ .vil（キーマップ）をこのページにドロップしてください。</span></div>";
}

function updateLegends() {
  if (!KB.layerCount) return;
  for (const [rc, el] of keyEls) {
    const [r, c] = rc.split(",").map(Number);
    const k = (KB.layers[viewLayer]?.[r] ? KB.layers[viewLayer][r][c] : null) || K_NONE;
    const show = k.t === "trans" ? effKey(viewLayer, r, c) : k;
    const sub = shiftedSub(show);
    el.innerHTML =
      (sub ? '<span class="sub">' + escapeHtml(sub) + "</span>" : "") +
      escapeHtml(legendFor(show)).replace(/\n/g, "<br>");
    el.classList.toggle("dim", k.t === "trans" || k.t === "none");
  }
}

function buildLayerTabs() {
  const tabs = document.getElementById("layertabs");
  tabs.innerHTML = "";
  for (let i = 0; i < KB.layerCount; i++) {
    const b = document.createElement("button");
    b.textContent = "L" + i;
    b.onclick = () => setViewLayer(i);
    tabs.appendChild(b);
  }
}

function setViewLayer(i) {
  viewLayer = i;
  document.querySelectorAll("#layertabs button").forEach((b, j) => {
    b.classList.toggle("active", j === i);
  });
  updateLegends();
  if (engine?.hint) paintHint(engine.hint);
}

function clearHighlights() {
  for (const el of keyEls.values()) {
    el.classList.remove("hl-target", "hl-shift", "hl-layer", "hl-alt");
    delete el.dataset.order;
    el.querySelector(".fingertag")?.remove();
  }
}

function paintHint(hint) {
  clearHighlights();
  if (!hint) return;
  const shiftFirst = hint.shiftKey?.fromBase && hint.layerKey;
  const mark = (pos, cls, order) => {
    const el = pos && keyEls.get(pos.r + "," + pos.c);
    if (!el) return;
    el.classList.add(cls);
    if (order) el.dataset.order = order;
    const finger = fingerFor(pos.r, pos.c);
    if (finger) {
      const tag = document.createElement("i");
      tag.className = "fingertag";
      tag.textContent = finger;
      tag.title = FINGER_NAMES[finger];
      el.appendChild(tag);
    }
  };
  let n = 1;
  if (shiftFirst) {
    // Shift only exists before the layer switch
    mark(hint.shiftKey, "hl-shift", n++); // -> press & hold Shift first,
    mark(hint.layerKey, "hl-layer", n++); //    then the layer key
  } else {
    if (hint.layerKey) mark(hint.layerKey, "hl-layer", n++);
    if (hint.shiftKey) mark(hint.shiftKey, "hl-shift", n++);
  }
  mark(hint.key, "hl-target", n > 1 ? n : 0);
  // 2nd candidate: faint dashed highlight, only when it lives on the displayed layer
  if (hint.alt && hint.alt.layer === viewLayer) {
    const el = keyEls.get(hint.alt.key.r + "," + hint.alt.key.c);
    if (el && !el.classList.contains("hl-target")) el.classList.add("hl-alt");
  }
}

/* ---------- 5. WebHID (Vial/VIA protocol) + .vil import ---------- */

const CMD_GET_LAYER_COUNT = 0x11,
  CMD_GET_BUFFER = 0x12;

const KBLOG = [];
function dlog(msg) {
  KBLOG.push(msg);
  console.log("[vial-typing]", msg);
  const el = document.getElementById("dbglog");
  if (el) el.textContent = KBLOG.join("\n");
}
const hex = (u8, n) =>
  Array.from(u8.subarray(0, n))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

// wireless boards can be slow to answer the first command — retry with growing timeouts
async function hidCmdRetry(dev, bytes, tries) {
  let err;
  for (let i = 0; i < (tries || 3); i++) {
    try {
      return await hidCmd(dev, bytes, 1200 + i * 1200);
    } catch (e) {
      err = e;
    }
  }
  throw err;
}

function hidCmd(dev, bytes, timeoutMs) {
  const data = new Uint8Array(32);
  data.set(bytes);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      dev.removeEventListener("inputreport", onRep);
      reject(new Error("デバイスからの応答がありません"));
    }, timeoutMs || 1500);
    const onRep = (e) => {
      clearTimeout(timer);
      dev.removeEventListener("inputreport", onRep);
      resolve(new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength));
    };
    dev.addEventListener("inputreport", onRep);
    dev.sendReport(0, data).catch((err) => {
      clearTimeout(timer);
      dev.removeEventListener("inputreport", onRep);
      reject(err);
    });
  });
}

async function connectHID() {
  if (engine.running) engine.idle(); // reading a keymap resets to the pre-start menu
  const st = document.getElementById("status");
  if (!navigator.hid) {
    st.className = "err";
    st.textContent = "このブラウザはWebHID非対応です。Chrome/Edgeを使うか .vil を読み込んでください";
    return;
  }
  let dev = null;
  try {
    const devs = await navigator.hid.requestDevice({
      filters: [{ usagePage: 0xff60, usage: 0x61 }],
    });
    if (!devs.length) return;
    dev = devs.find((d) => d.collections.some((c) => c.usagePage === 0xff60)) || devs[0];
    if (!dev.opened) await dev.open();
    st.className = "";
    st.textContent = "レイアウト定義を読み取り中…";
    KBLOG.length = 0;
    dlog(
      "デバイス: " +
        (dev.productName || "(名称不明)") +
        "  vendor=0x" +
        dev.vendorId.toString(16) +
        " product=0x" +
        dev.productId.toString(16),
    );

    // --- vial_get_size / vial_get_def: layout definition embedded in the firmware ---
    try {
      try {
        const idr = await hidCmdRetry(dev, [0xfe, 0x00]); // vial_get_keyboard_id (optional)
        dlog("vial応答(FE00): " + hex(idr, 12) + "  → プロトコルv" + (idr[0] | (idr[1] << 8)));
      } catch {
        dlog("FE00応答なし（continue）");
      }
      const szr = await hidCmdRetry(dev, [0xfe, 0x01]);
      dlog("サイズ応答(FE01): " + hex(szr, 8));
      const sz = (szr[0] | (szr[1] << 8) | (szr[2] << 16) | (szr[3] << 24)) >>> 0;
      dlog("定義サイズ: " + sz + " bytes");
      if (sz > 0 && sz < 200000) {
        const comp = new Uint8Array(sz);
        for (let blk = 0; blk * 32 < sz; blk++) {
          const r = await hidCmdRetry(dev, [
            0xfe,
            0x02,
            blk & 0xff,
            (blk >> 8) & 0xff,
            (blk >> 16) & 0xff,
            (blk >> 24) & 0xff,
          ]);
          comp.set(r.subarray(0, Math.min(32, sz - blk * 32)), blk * 32);
        }
        dlog("定義先頭: " + hex(comp, 8) + (comp[0] === 0xfd ? " (xz形式)" : " (xz以外)"));
        const json = await decompressDefinition(comp);
        dlog("展開OK: " + json.length + "文字");
        window.lastDefJson = json; // debugging: raw definition
        const def = JSON.parse(json);
        dlog(
          "定義: name=" +
            def.name +
            " matrix=" +
            (def.matrix && def.matrix.rows + "x" + def.matrix.cols) +
            " layouts=" +
            !!def.layouts?.keymap,
        );
        applyDefinition(def, dev.productName);
        dlog("レイアウト適用OK: " + PHYS_KEYS.length + "キー（マトリクス " + MATRIX_ROWS + "x" + MATRIX_COLS + "）");
        dlog("--- 定義JSON全文（不具合報告用） ---");
        dlog(json);
      } else throw new Error("定義サイズが不正 (" + sz + ")");
    } catch (e) {
      dlog("✗ 定義読み取り失敗: " + e.message);
      dlog(
        "レイアウト不明のままキーマップは読み取りません。vial.jsonをドロップしてから.vilを読み込むか、再試行してください。",
      );
      console.warn("definition read failed:", e);
      st.className = "err";
      st.textContent = "レイアウト定義の読み取りに失敗: " + e.message + "（読み取りログ参照）";
      document.getElementById("dbgwrap").open = true;
      return;
    }
    st.textContent = "キーマップを読み取り中…";

    let layerCount = 4;
    try {
      const r = await hidCmdRetry(dev, [CMD_GET_LAYER_COUNT]);
      if (r[1] >= 1 && r[1] <= 16) layerCount = r[1];
    } catch {
      /* keep default */
    }

    const total = layerCount * MATRIX_ROWS * MATRIX_COLS * 2;
    const buf = new Uint8Array(total);
    for (let off = 0; off < total; off += 28) {
      const size = Math.min(28, total - off);
      const r = await hidCmdRetry(dev, [CMD_GET_BUFFER, (off >> 8) & 0xff, off & 0xff, size]);
      buf.set(r.subarray(4, 4 + size), off);
    }
    const layers = [];
    let i = 0;
    for (let L = 0; L < layerCount; L++) {
      const g = [];
      for (let r = 0; r < MATRIX_ROWS; r++) {
        const row = [];
        for (let c = 0; c < MATRIX_COLS; c++) {
          row.push(decodeNum((buf[i] << 8) | buf[i + 1]));
          i += 2;
        }
        g.push(row);
      }
      layers.push(g);
    }
    dlog("キーマップ読み取りOK: " + layerCount + "レイヤー (" + MATRIX_ROWS + "x" + MATRIX_COLS + ")");
    setKeymap(layers, "hid", KBDEF.name || dev.productName || "Keyboard");
  } catch (err) {
    st.className = "err";
    st.textContent = "読み取り失敗: " + err.message + "（USB接続を確認するか .vil を読み込んでください）";
  } finally {
    // release the raw-HID interface right away — only one app can hold it,
    // and keeping it open blocks Vial from connecting to the keyboard
    if (dev?.opened) {
      try {
        await dev.close();
      } catch {}
    }
  }
}

function loadVilText(text, name) {
  if (engine.running) engine.idle(); // loading a keymap resets to the pre-start menu
  const st = document.getElementById("status");
  try {
    const data = JSON.parse(text);
    if (data.layouts && data.matrix) {
      // vial.json -> layout definition
      applyDefinition(data, name);
      st.className = "ok";
      st.textContent = "✓ レイアウト適用: " + KBDEF.name + "（キーマップは未読込）";
      return;
    }
    if (!Array.isArray(data.layout)) throw new Error("layoutがありません");
    const layers = data.layout.map((layer) => {
      const g = Array.from({ length: MATRIX_ROWS }, () => Array(MATRIX_COLS).fill(K_NONE));
      layer.forEach((row, r) => {
        if (r < MATRIX_ROWS && Array.isArray(row))
          row.forEach((k, c) => {
            if (c < MATRIX_COLS) g[r][c] = parseVil(k);
          });
      });
      return g;
    });
    // drop trailing layers that are entirely empty/none
    while (
      layers.length > 1 &&
      layers[layers.length - 1].every((row) => row.every((k) => k.t === "none" || k.t === "trans"))
    )
      layers.pop();
    setKeymap(layers, "vil", name);
  } catch (err) {
    st.className = "err";
    st.textContent = ".vilの解析に失敗: " + err.message;
  }
}

document.getElementById("btnForget").addEventListener("click", forgetSavedKeymap);
document.getElementById("btnConnect").addEventListener("click", connectHID);
document.getElementById("btnVil").addEventListener("click", () => document.getElementById("vilFile").click());
document.getElementById("vilFile").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) f.text().then((t) => loadVilText(t, f.name));
  e.target.value = "";
});

const dropEl = document.getElementById("drop");
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth++;
  dropEl.classList.add("show");
});
window.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    dropEl.classList.remove("show");
  }
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropEl.classList.remove("show");
  const f = e.dataTransfer.files[0];
  if (f) f.text().then((t) => loadVilText(t, f.name));
});

/* ---------- 6a. Romaji engine ---------- */

const ROMAJI = {
  あ: ["a"],
  い: ["i", "yi"],
  う: ["u", "wu"],
  え: ["e"],
  お: ["o"],
  か: ["ka", "ca"],
  き: ["ki"],
  く: ["ku", "cu", "qu"],
  け: ["ke"],
  こ: ["ko", "co"],
  さ: ["sa"],
  し: ["si", "shi", "ci"],
  す: ["su"],
  せ: ["se", "ce"],
  そ: ["so"],
  た: ["ta"],
  ち: ["ti", "chi"],
  つ: ["tu", "tsu"],
  て: ["te"],
  と: ["to"],
  な: ["na"],
  に: ["ni"],
  ぬ: ["nu"],
  ね: ["ne"],
  の: ["no"],
  は: ["ha"],
  ひ: ["hi"],
  ふ: ["fu", "hu"],
  へ: ["he"],
  ほ: ["ho"],
  ま: ["ma"],
  み: ["mi"],
  む: ["mu"],
  め: ["me"],
  も: ["mo"],
  や: ["ya"],
  ゆ: ["yu"],
  よ: ["yo"],
  ら: ["ra"],
  り: ["ri"],
  る: ["ru"],
  れ: ["re"],
  ろ: ["ro"],
  わ: ["wa"],
  を: ["wo"],
  ん: ["n", "nn", "xn"],
  が: ["ga"],
  ぎ: ["gi"],
  ぐ: ["gu"],
  げ: ["ge"],
  ご: ["go"],
  ざ: ["za"],
  じ: ["zi", "ji"],
  ず: ["zu"],
  ぜ: ["ze"],
  ぞ: ["zo"],
  だ: ["da"],
  ぢ: ["di"],
  づ: ["du"],
  で: ["de"],
  ど: ["do"],
  ば: ["ba"],
  び: ["bi"],
  ぶ: ["bu"],
  べ: ["be"],
  ぼ: ["bo"],
  ぱ: ["pa"],
  ぴ: ["pi"],
  ぷ: ["pu"],
  ぺ: ["pe"],
  ぽ: ["po"],
  ぁ: ["la", "xa"],
  ぃ: ["li", "xi"],
  ぅ: ["lu", "xu"],
  ぇ: ["le", "xe"],
  ぉ: ["lo", "xo"],
  ゃ: ["lya", "xya"],
  ゅ: ["lyu", "xyu"],
  ょ: ["lyo", "xyo"],
  ふぁ: ["fa"],
  ふぃ: ["fi"],
  ふぇ: ["fe"],
  ふぉ: ["fo"],
  てぃ: ["thi"],
  でぃ: ["dhi"],
  うぃ: ["wi"],
  うぇ: ["we"],
  しぇ: ["sye", "she"],
  ちぇ: ["tye", "che"],
  じぇ: ["zye", "je"],
  ー: ["-"],
};
(() => {
  const Y = {
    き: ["ky"],
    ぎ: ["gy"],
    に: ["ny"],
    ひ: ["hy"],
    び: ["by"],
    ぴ: ["py"],
    み: ["my"],
    り: ["ry"],
    し: ["sy", "sh"],
    ち: ["ty", "ch", "cy"],
    じ: ["zy", "j", "jy"],
    ぢ: ["dy"],
  };
  const V = { ゃ: "a", ゅ: "u", ょ: "o" };
  for (const [k, pres] of Object.entries(Y))
    for (const [sm, v] of Object.entries(V)) ROMAJI[k + sm] = pres.map((p) => p + v);
})();

function tokenizeKana(word) {
  const units = [];
  let i = 0;
  while (i < word.length) {
    const two = word.substr(i, 2);
    if (two.length === 2 && ROMAJI[two]) {
      units.push({ kana: two, opts: ROMAJI[two].slice() });
      i += 2;
      continue;
    }
    const ch = word[i];
    if (ch === "っ") {
      units.push({ kana: ch, sok: true, opts: [] });
      i++;
      continue;
    }
    units.push({ kana: ch, opts: (ROMAJI[ch] || [ch]).slice() });
    i++;
  }
  for (let j = 0; j < units.length; j++) {
    const u = units[j],
      nx = units[j + 1];
    if (u.sok) {
      let cons = [];
      if (nx?.opts.length) cons = [...new Set(nx.opts.map((o) => o[0]).filter((c) => !"aiueon".includes(c)))];
      u.opts = cons.concat(["ltu", "xtu", "ltsu"]);
    }
    if (u.kana === "ん") {
      const allowN = nx?.opts.length && nx.opts.every((o) => !"aiueony".includes(o[0]));
      u.opts = allowN ? ["n", "nn", "xn"] : ["nn", "xn"];
    }
  }
  return units;
}

/* ---------- 6b. Practice data (data/*.json) ---------- */

// NOTE: fetchを使うためfile://では開けない。make runのhttpサーバー経由で開くこと
async function loadPracticeData(name) {
  const response = await fetch("data/" + name + ".json");
  if (!response.ok) throw new Error(name + ".json の読み込みに失敗 (" + response.status + ")");
  return response.json();
}
let EN_WORDS, EN_SENTS, JP_WORDS, JP_SENTS, SYM_ITEMS;
try {
  [EN_WORDS, EN_SENTS, JP_WORDS, JP_SENTS, SYM_ITEMS] = await Promise.all(
    ["en_words", "en_sents", "jp_words", "jp_sents", "sym_items"].map(loadPracticeData),
  );
} catch (error) {
  const status = document.getElementById("status");
  status.className = "err";
  status.textContent = "練習データ (data/*.json) の読み込みに失敗しました。make run のhttpサーバー経由で開いてください";
  throw error;
}

/* ---------- 6c. キー習得モード (keybr.com方式のキー解放) ---------- */

// keybr.comのguided lessonの移植: 1走行を1レッスンとしてキー別の平均打鍵時間を記録し、
// 指数平滑した速度が目標に達すると出現頻度順に次のキーを解放して出題単語を更新する
const GUIDED_TARGET_TIME = 60000 / 175; // 目標速度175CPM(=35WPM)での1打鍵あたりの時間(ms)
const GUIDED_MIN_KEYS = 6;
const GUIDED_ALPHA = 0.1; // 指数平滑の係数
const GUIDED_MAX_RESULTS = 300;
const GUIDED_STORE_KEY = "vialTypingGuided";
const GUIDED_SLOW_COLOR = [0xcc, 0x00, 0x00];
const GUIDED_FAST_COLOR = [0x60, 0xd7, 0x88];

// コーパス中の出現頻度順に文字を並べる (keybrのLetter.frequencyOrder相当。出現しない文字は含めない)
function guidedFrequencyOrder(texts, accept) {
  const freq = new Map();
  for (const text of texts) {
    for (const raw of text) {
      const ch = raw.toLowerCase();
      if (!accept(ch)) continue;
      freq.set(ch, (freq.get(ch) || 0) + 1);
    }
  }
  return [...freq.keys()].sort((a, b) => freq.get(b) - freq.get(a) || a.charCodeAt(0) - b.charCodeAt(0));
}

const guidedIsLetter = (ch) => ch >= "a" && ch <= "z";
const guidedIsSymbol = (ch) => ch !== " " && !guidedIsLetter(ch); // 記号と数字（大文字は小文字化済み）

// 練習モード別のコース: 対象キーとそのコーパスでの解放順。打鍵統計はコース間で共有する
const GUIDED_COURSES = {
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

const guided = {
  results: [], // 1走行分の記録 {t, h: {文字: [打鍵数, ミス数, 平均打鍵時間ms]}}
  stats: new Map(),
  courses: {}, // コースごとの解放状態 {en: {letters}, jp: {letters}, sym: {letters, symbols}}
  course: "en", // パネルに表示中のコース
  words: { en: [], jp: [], sym: [] }, // 練習モード別の出題プール
  selected: null,
};

function guidedLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUIDED_STORE_KEY));
    if (raw && raw.v === 1 && Array.isArray(raw.results)) guided.results = raw.results;
  } catch {}
}

function guidedSave() {
  try {
    localStorage.setItem(GUIDED_STORE_KEY, JSON.stringify({ v: 1, results: guided.results }));
  } catch {}
}

// 信頼度 = 目標打鍵時間 / 実際の打鍵時間。1.0以上で「習得済み」(keybrのTarget.confidence相当)
const guidedConfidence = (timeToType) => (timeToType == null ? null : GUIDED_TARGET_TIME / timeToType);

// 全記録からキー別の平滑打鍵時間と自己ベストを再計算する (keybrのMutableKeyStats相当)
function guidedRebuildStats() {
  const stats = new Map(GUIDED_TRACKED.map((ch) => [ch, { samples: [], timeToType: null, bestTimeToType: null }]));
  guided.results.forEach((result, index) => {
    for (const [ch, sample] of Object.entries(result.h)) {
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
function guidedTrackKeys(order) {
  const keys = order.map((ch) => {
    const stat = guided.stats.get(ch);
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
function guidedUpdateKeys() {
  guided.courses = {
    en: { letters: guidedTrackKeys(GUIDED_COURSES.en.letters) },
    jp: { letters: guidedTrackKeys(GUIDED_COURSES.jp.letters) },
    sym: {
      letters: guidedTrackKeys(GUIDED_COURSES.sym.letters),
      symbols: guidedTrackKeys(GUIDED_COURSES.sym.symbols),
    },
  };
}

const guidedIncludedSet = (track) => new Set(track.filter((k) => k.included).map((k) => k.ch));
const guidedFocusOf = (track) => track.find((k) => k.focused)?.ch ?? null;

// 全コース・全トラックの解放済みキーの和集合（解放アナウンスの差分検出用）
function guidedIncludedAll() {
  const set = new Set();
  for (const course of Object.values(guided.courses))
    for (const track of [course.letters, course.symbols])
      if (track) for (const key of track) if (key.included) set.add(key.ch);
  return set;
}

// 解放済みキーだけで打てるお題を練習モード別に作る (keybrのDictionary.find相当)
function guidedBuildPools() {
  const courses = guided.courses;
  return {
    en: guidedEnPool(guidedIncludedSet(courses.en.letters), guidedFocusOf(courses.en.letters)),
    jp: guidedJpPool(guidedIncludedSet(courses.jp.letters), guidedFocusOf(courses.jp.letters)),
    sym: guidedSymPool(
      guidedIncludedSet(courses.sym.letters),
      guidedFocusOf(courses.sym.letters),
      guidedIncludedSet(courses.sym.symbols),
      guidedFocusOf(courses.sym.symbols),
    ),
  };
}

// 解放済みキーだけで綴れて注目キーを含む英単語
function guidedEnPool(included, focused) {
  let words = EN_WORDS.filter((w) => w.length > 2 && [...w].every((ch) => included.has(ch)));
  if (focused) words = words.filter((w) => w.includes(focused));
  words = words.slice(0, 1000);
  while (words.length < 15) words.push(guidedPseudoWord([...included], focused)); // 実単語が少ない序盤は疑似単語で補う
  return words;
}

// 単語の標準ローマ字表記（各入力単位の第1候補をつないだもの）
function guidedRomajiOf(kana) {
  return tokenizeKana(kana)
    .map((unit) => unit.opts[0] || "")
    .join("");
}

// 標準ローマ字が解放済みキーだけで打てる日本語単語
function guidedJpPool(included, focused) {
  const typeable = JP_WORDS.filter(([kana]) => [...guidedRomajiOf(kana)].every((ch) => included.has(ch)));
  let pool = focused ? typeable.filter(([kana]) => guidedRomajiOf(kana).includes(focused)) : typeable;
  if (pool.length < 5) pool = typeable;
  pool = pool.slice();
  while (pool.length < 5) pool.push(guidedPseudoKana(included, focused));
  return pool;
}

// 解放済みキーだけで打てるかなを組み合わせた疑似単語（[かな, 表示] 形式）
function guidedPseudoKana(included, focused) {
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
function guidedSymPool(letters, letterFocus, symbols, symbolFocus) {
  const typeable = (item) =>
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
function guidedSymLine(letters, letterFocus, symbols, symbolFocus) {
  const symbolList = [...symbols];
  const pickSymbol = () => symbolList[Math.floor(Math.random() * symbolList.length)];
  const ident = (focus) => guidedPseudoWord([...letters], focus).slice(0, 4);
  let line = ident(letterFocus);
  const joints = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < joints; i++) {
    const symbol = i === 0 && symbolFocus ? symbolFocus : pickSymbol();
    line += Math.random() < 0.5 ? " " + symbol + " " + ident(null) : symbol + ident(null);
  }
  return line;
}

function guidedPseudoWord(letters, focused) {
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
function guidedRecordRun(steps) {
  const byChar = new Map();
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
  const histogram = {};
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
  guidedRenderAll();
  return [...guidedIncludedAll()].filter((ch) => !before.has(ch));
}

/* ---- キー習得モードの表示 ---- */

const guidedWpm = (timeToType) => Math.round(12000 / timeToType);

function guidedKeyColor(confidence) {
  const t = Math.max(0, Math.min(1, confidence));
  const mix = GUIDED_SLOW_COLOR.map((c, i) => Math.round(c + (GUIDED_FAST_COLOR[i] - c) * t));
  return "rgb(" + mix.join(",") + ")";
}

// 表示中コースのトラック一覧（記号コースは英字+記号の2トラック）
function guidedCourseTracks() {
  const course = guided.courses[guided.course];
  return course.symbols ? [course.letters, course.symbols] : [course.letters];
}

function guidedSelectedKey() {
  const all = guidedCourseTracks().flat();
  return all.find((k) => k.ch === guided.selected) ?? all.find((k) => k.focused) ?? all[0];
}

function renderKeySet() {
  const wrap = $("keyset");
  const current = guidedSelectedKey();
  wrap.innerHTML = "";
  for (const track of guidedCourseTracks()) {
    const row = document.createElement("div");
    row.className = "keyrow";
    for (const key of track) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "gkey";
      el.textContent = key.ch;
      if (!key.included) el.classList.add("locked");
      if (key.focused) el.classList.add("focused");
      if (key === current) el.classList.add("selected");
      if (key.included && key.confidence != null) {
        el.style.background = guidedKeyColor(key.confidence);
        el.classList.add("colored");
      }
      el.title = key.included
        ? key.ch.toUpperCase() +
          (key.confidence == null ? "（未計測）" : "（信頼度 " + Math.round(key.confidence * 100) + "%）")
        : key.ch.toUpperCase() + "（未解放）";
      el.addEventListener("click", () => {
        guided.selected = key.ch;
        guidedRenderAll();
      });
      row.appendChild(el);
    }
    wrap.appendChild(row);
  }
}

// 直近サンプルの回帰直線の傾き = 学習率(WPM/走行) (keybrのLearningRateの簡易版)
function guidedLearningRate(key) {
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

function renderKeyInfo(key) {
  const pct = (c) => Math.round(c * 100) + "%";
  let html = '<b class="gkey-name">' + key.ch.toUpperCase() + "</b>";
  if (!key.included) {
    html += " 🔒 未解放：前のキーがすべて目標速度（35 WPM）に達すると解放されます";
  } else if (key.timeToType == null) {
    html += " 未計測：もう少し打鍵データが必要です";
  } else {
    html +=
      " 直前 <b>" +
      guidedWpm(key.timeToType) +
      " WPM</b>（信頼度 " +
      pct(key.confidence) +
      "）・自己ベスト <b>" +
      guidedWpm(key.bestTimeToType) +
      " WPM</b>（" +
      pct(key.bestConfidence) +
      "）";
    const rate = guidedLearningRate(key);
    if (rate != null) html += "・学習率 " + (rate >= 0 ? "+" : "") + rate.toFixed(1) + " WPM/走行";
  }
  $("keyInfo").innerHTML = html;
}

// キー別の速度推移グラフ (keybrのKeyDetailsChart相当):
// 走行ごとの速度の散布図 + 平滑速度の曲線 + 目標速度の水平線 + 現在位置の縦線
function drawKeyChart(key) {
  const canvas = $("keyChart");
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (!cssWidth) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.body);
  const colors = {
    grid: css.getPropertyValue("--border").trim() || "#eee",
    axis: css.getPropertyValue("--dim").trim() || "#999",
    dot: css.getPropertyValue("--accent2").trim() || "#7c6cf6",
    curve: css.getPropertyValue("--accent").trim() || "#ff5d8f",
    target: css.getPropertyValue("--good").trim() || "#18b566",
    text: css.getPropertyValue("--dim").trim() || "#999",
  };
  const pad = { left: 40, right: 52, top: 16, bottom: 22 };
  const box = { x: pad.left, y: pad.top, w: cssWidth - pad.left - pad.right, h: cssHeight - pad.top - pad.bottom };
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const samples = key.samples.slice(-30);
  const targetWpm = guidedWpm(GUIDED_TARGET_TIME);

  // 目盛りの範囲を決める
  let xMax = samples.length;
  let nowX = 0;
  if (samples.length && (key.bestConfidence ?? 0) < 1) {
    nowX = samples.length;
    xMax = samples.length + 10; // 未習得キーは先の見通し分だけ右に伸ばす
  }
  const speeds = samples.flatMap((s) => [12000 / s.timeToType, 12000 / s.filtered]);
  let yMin = Math.min(targetWpm, ...speeds);
  let yMax = Math.max(targetWpm, ...speeds);
  yMin = Math.max(0, Math.floor(yMin / 5) * 5 - 5);
  yMax = Math.ceil(yMax / 5) * 5 + 5;

  const px = (i) => box.x + (xMax > 1 ? ((i - 1) / (xMax - 1)) * box.w : box.w / 2);
  const py = (wpm) => box.y + box.h - ((wpm - yMin) / (yMax - yMin)) * box.h;

  // グリッドと軸
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.grid;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const gy = box.y + (box.h / 5) * i;
    ctx.moveTo(box.x, gy);
    ctx.lineTo(box.x + box.w, gy);
    const gx = box.x + (box.w / 5) * i;
    ctx.moveTo(gx, box.y);
    ctx.lineTo(gx, box.y + box.h);
  }
  ctx.stroke();
  ctx.strokeStyle = colors.axis;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.stroke();

  ctx.font = "10px sans-serif";
  ctx.fillStyle = colors.text;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 5; i++) {
    const wpm = yMin + ((yMax - yMin) / 5) * i;
    ctx.fillText(Math.round(wpm), box.x - 6, py(wpm));
  }

  if (!samples.length) {
    ctx.textAlign = "center";
    ctx.font = "12px sans-serif";
    ctx.fillText("まだ記録がありません — この文字を打つと記録されます", box.x + box.w / 2, box.y + box.h / 2);
    return;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= 5; i++) {
    const v = 1 + ((xMax - 1) / 5) * i;
    ctx.fillText(Math.round(v), px(v), box.y + box.h + 6);
  }

  // 目標速度の水平線
  const ty = py(targetWpm);
  ctx.strokeStyle = colors.target;
  ctx.beginPath();
  ctx.moveTo(box.x - 6, ty);
  ctx.lineTo(box.x + box.w + 6, ty);
  ctx.stroke();
  ctx.fillStyle = colors.target;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("目標 " + targetWpm, box.x + box.w + 10, ty);

  // 現在位置の縦線
  if (nowX > 0) {
    const nx = px(nowX);
    ctx.strokeStyle = colors.axis;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(nx, box.y - 6);
    ctx.lineTo(nx, box.y + box.h + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = colors.text;
    ctx.fillText("今", nx + 3, box.y - 2);
  }

  // 走行ごとの実測速度の散布図
  ctx.fillStyle = colors.dot;
  samples.forEach((s, i) => {
    ctx.beginPath();
    ctx.arc(px(i + 1), py(12000 / s.timeToType), 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 平滑速度の曲線
  ctx.strokeStyle = colors.curve;
  ctx.lineWidth = 2;
  ctx.beginPath();
  samples.forEach((s, i) => {
    const x = px(i + 1);
    const y = py(12000 / s.filtered);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function guidedRenderAll() {
  const course = guided.courses[guided.course];
  const parts = [];
  const letterFocus = guidedFocusOf(course.letters);
  if (letterFocus) parts.push("習得中のキー: " + letterFocus.toUpperCase());
  const symbolFocus = course.symbols ? guidedFocusOf(course.symbols) : null;
  if (symbolFocus) parts.push("記号: " + symbolFocus);
  $("guidedStatus").textContent = parts.length ? parts.join(" ・ ") : "🎉 すべてのキーを解放しました";
  $("btnGuidedReset").disabled = !guided.results.length;
  document.querySelectorAll(".course-tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.course === guided.course);
  });
  renderKeySet();
  const key = guidedSelectedKey();
  renderKeyInfo(key);
  drawKeyChart(key);
}

/* ---------- 6d. Engine ---------- */

const COMBO_STEP = 30; // every 30 consecutive hits ...
const COMBO_BONUS = 1; // ... +1 second
let runSeconds = 60; // one set length: 30s / 60s / 90s (sushida style)、0 = 無制限(タイムアウトなし)
try {
  const t = +localStorage.getItem("cornixTime");
  if ([0, 30, 60, 90].includes(t)) runSeconds = t;
} catch {}
// 無制限モードでは残り時間ではなく経過時間をカウントアップし、自動終了しない
const isUnlimited = () => runSeconds === 0;

// 時間表示(ラベル+初期値)をモードに合わせてリセットする
function resetTimeDisplay() {
  const lbl = document.getElementById("stTimeLbl");
  if (lbl) lbl.textContent = isUnlimited() ? "経過時間" : "残り時間";
  const t = document.getElementById("stTime");
  t.textContent = isUnlimited() ? "0.0" : runSeconds.toFixed(1);
  t.classList.remove("low");
}
const $ = (id) => document.getElementById(id);

/* ---- sound effects (WebAudio, synthesized — no asset files) ---- */
let soundOn = true;
try {
  soundOn = localStorage.getItem("cornixSound") !== "0";
} catch {}
const audio = {
  ctx: null,
  tone(freq, dur, type, vol, delay = 0, freqEnd) {
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },
  play(kind) {
    if (!soundOn) return;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
      if (kind === "type") this.tone(900 + Math.random() * 150, 0.045, "triangle", 0.07);
      else if (kind === "miss") this.tone(170, 0.18, "sawtooth", 0.09, 0, 110);
      else if (kind === "bonus") {
        // cheerful 3-note arpeggio
        this.tone(784, 0.09, "sine", 0.12);
        this.tone(1046.5, 0.09, "sine", 0.12, 0.09);
        this.tone(1318.5, 0.16, "sine", 0.12, 0.18);
      }
    } catch {
      /* audio unavailable — play silently on */
    }
  },
};
function updateSoundBtn() {
  $("btnSound").textContent = soundOn ? "🔊 音あり" : "🔇 音なし";
}

// shuffled-bag sampling: every entry appears once before any repeats
const bags = {};
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function drawFrom(list, key) {
  if (!bags[key]?.length) bags[key] = shuffle(list.slice());
  return bags[key].pop();
}

const engine = {
  mode: "en",
  guided: false, // キー習得モード（練習モードと直交する切替）
  items: [],
  idx: 0,
  running: false,
  // en/sym
  text: "",
  pos: 0,
  // jp
  units: [],
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
  timerId: null,
  hint: null,
  warn: "",
  counting: false,
  countId: null,
  // キー習得モードの打鍵記録
  steps: [],
  lastInputAt: 0,
  typoPending: false,

  makeItem(mode) {
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
  fillItems(n) {
    for (let i = 0; i < n; i++) this.items.push(this.makeItem());
  },

  // 3-2-1 カウントダウンを表示してから本番開始
  start() {
    if (this.counting) return;
    if (!KB.layerCount) {
      $("typeline").innerHTML =
        '<span class="rest" style="font-size:20px">⌨️ 先にキーボードを読み込んでください（「キーボードから読み取る」または vial.json / .vil をドロップ）</span>';
      return;
    }
    if ($("resultDlg").open) $("resultDlg").close();
    clearInterval(this.timerId);
    this.running = false;
    this.hint = null;
    this.items = [];
    clearHighlights();
    $("wordMeta").textContent = "";
    $("queue").textContent = "";
    $("hint").innerHTML = "";
    resetTimeDisplay();
    $("stWpm").textContent = 0;
    $("stAcc").textContent = "100%";
    $("stCombo").textContent = 0;
    $("stMiss").textContent = 0;
    this.counting = true;
    $("typeline").classList.remove("idle");
    const show = (txt, go) =>
      ($("typeline").innerHTML = '<span class="countdown' + (go ? " go" : "") + '">' + txt + "</span>");
    let n = 3;
    show(n);
    if (soundOn) audio.play("type");
    this.countId = setInterval(() => {
      n--;
      if (n > 0) {
        show(n);
        if (soundOn) audio.play("type");
      } else if (n === 0) {
        show("GO!", true);
        if (soundOn) audio.play("bonus");
      } else {
        clearInterval(this.countId);
        this.counting = false;
        this.beginRun();
      }
    }, 700);
  },

  beginRun() {
    clearInterval(this.timerId);
    if (this.guided) {
      // 最新の習得状況で出題プールを作り直す
      guidedUpdateKeys();
      guided.words = guidedBuildPools();
      bags.g_en = bags.g_jp = bags.g_sym = null;
      this.steps = [];
      this.lastInputAt = 0;
      this.typoPending = false;
    }
    this.items = [];
    this.fillItems(20);
    this.idx = 0;
    this.correct = 0;
    this.miss = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.words = 0;
    this.bonusTotal = 0;
    this.startTime = Date.now();
    this.endTime = this.startTime + runSeconds * 1000;
    this.running = true;
    this.timerId = setInterval(() => this.tick(), 100);
    this.tick();
    this.loadItem();
  },

  idle() {
    clearInterval(this.timerId);
    clearInterval(this.countId);
    this.counting = false;
    this.running = false;
    this.items = [];
    this.hint = null;
    clearHighlights();
    $("typeline").classList.add("idle");
    $("typeline").innerHTML =
      '<span class="start-prompt">▶ スタート</span>' +
      '<span class="start-sub">クリック / Space / Enter で開始　・　プレイ中は ESC で戻る</span>';
    $("wordMeta").textContent = "";
    $("queue").textContent = "";
    $("hint").innerHTML = "";
    resetTimeDisplay();
    $("stWpm").textContent = 0;
    $("stAcc").textContent = "100%";
    $("stCombo").textContent = 0;
    $("stMiss").textContent = 0;
  },

  tick() {
    const t = $("stTime");
    if (isUnlimited()) {
      // 経過時間をカウントアップ、自動終了しない
      t.textContent = ((Date.now() - this.startTime) / 1000).toFixed(1);
      this.updateStats();
      return;
    }
    const rem = Math.max(0, this.endTime - Date.now());
    t.textContent = (rem / 1000).toFixed(1);
    t.classList.toggle("low", rem < 10000);
    this.updateStats();
    if (rem <= 0) this.finish();
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
        const pop = document.createElement("span");
        pop.className = "bonus-pop";
        pop.textContent = "+" + COMBO_BONUS + "s";
        $("stTimeWrap").appendChild(pop);
        setTimeout(() => pop.remove(), 900);
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
      this.text = it.text;
      this.pos = 0;
    }
    this.lastInputAt = 0; // 単語間の間隔は打鍵時間に含めない
    this.typoPending = false;
    this.warn = "";
    this.render();
    this.refreshHint();
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

  input(c) {
    if (!this.running || !this.items.length) return;
    if (this.isJP()) this.inputJP(c);
    else this.inputText(c);
    this.updateStats();
  },

  inputText(c) {
    const t = this.text[this.pos];
    if (c === t) {
      if (this.guided) this.recordStep(t);
      this.pos++;
      this.onCorrect();
      if (this.pos >= this.text.length) return this.nextItem();
    } else {
      if (this.guided) this.typoPending = true;
      this.onMiss();
    }
    this.render();
    this.refreshHint();
  },

  // 文字の確定1回を1打鍵として記録する。ミスした文字は打鍵時間の集計から除外される
  recordStep(ch) {
    const now = Date.now();
    this.steps.push({ ch, typo: this.typoPending, time: this.lastInputAt ? now - this.lastInputAt : 0 });
    this.lastInputAt = now;
    this.typoPending = false;
  },

  inputJP(c) {
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
      this.render();
      this.refreshHint();
      return;
    }
    if (this.softDone) {
      // "n" was already a valid ん etc. — move to the next unit and retry
      this.finishUnit();
      return this.input(c); // re-route: the next item may not be Japanese (mix mode)
    }
    if (this.guided) this.typoPending = true;
    this.onMiss();
    this.render();
    this.refreshHint();
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
    this.updateStats();
    const unlock = $("rUnlock");
    unlock.hidden = true;
    if (this.guided && this.steps.length) {
      const unlocked = guidedRecordRun(this.steps);
      this.steps = [];
      if (unlocked.length) {
        unlock.hidden = false;
        unlock.textContent = "🔓 新しいキーを解放: " + unlocked.map((ch) => ch.toUpperCase()).join(" ");
      }
    }
    $("rTitle").textContent = isUnlimited() ? "🎉 おつかれさま！" : "🎉 タイムアップ！";
    const score = Math.max(0, Math.round(this.correct * 10 + this.words * 100 + this.maxCombo * 30 - this.miss * 20));
    const rank = score >= 12000 ? "S" : score >= 9000 ? "A" : score >= 6000 ? "B" : score >= 3000 ? "C" : "D";
    $("rScore").textContent = score.toLocaleString();
    $("rRank").textContent = rank;
    $("rWpm").textContent = $("stWpm").textContent;
    $("rAcc").textContent = $("stAcc").textContent;
    $("rMiss").textContent = this.miss;
    $("rWords").textContent = this.words;
    $("rCombo").textContent = this.maxCombo;
    $("rBonus").textContent = "+" + this.bonusTotal + "s";
    $("resultDlg").showModal();
    this.idle();
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

  render() {
    const tl = $("typeline"),
      meta = $("wordMeta"),
      q = $("queue");
    if (!this.items.length) return;
    let done, cur, rest;
    if (this.isJP()) {
      const s = this.jpStrings();
      done = s.done;
      cur = s.rest[0] || "";
      rest = s.rest.slice(1);
      meta.innerHTML = '<span class="jp">' + escapeHtml(this.items[this.idx].meta) + "</span>";
    } else {
      done = this.text.slice(0, this.pos);
      cur = this.text[this.pos] || "";
      rest = this.text.slice(this.pos + 1);
      meta.textContent = "";
    }
    tl.innerHTML =
      '<span class="done">' +
      escapeHtml(done) +
      "</span>" +
      '<span class="cur' +
      (this.missFlash ? " miss" : "") +
      '">' +
      escapeHtml(cur === " " ? "␣" : cur) +
      "</span>" +
      '<span class="rest">' +
      escapeHtml(rest) +
      "</span>";
    const nxt = this.items
      .slice(this.idx + 1, this.idx + 4)
      .map((it) => (it.kana ? it.meta : it.text))
      .join("　");
    q.textContent = nxt ? "次: " + nxt : "";
  },

  refreshHint() {
    const hintEl = $("hint");
    const ch = this.items.length ? this.expect() : null;
    if (ch == null) {
      this.hint = null;
      clearHighlights();
      hintEl.innerHTML = "";
      return;
    }
    const h = findKeyForChar(ch);
    this.hint = h;
    if (!h) {
      clearHighlights();
      hintEl.innerHTML =
        "⚠ このキーマップでは「<b>" + escapeHtml(dispChar(ch)) + "</b>」が見つかりません（Enterでスキップ）";
      return;
    }
    if (h.layer !== viewLayer) setViewLayer(h.layer);
    else paintHint(h);
    // ピアノ運指風の指番号バッジ（チップの上に重ねる）
    const fingerBadge = (pos) => {
      const finger = pos && fingerFor(pos.r, pos.c);
      return finger ? '<i class="fnum" title="' + FINGER_NAMES[finger] + '">' + finger + "</i>" : "";
    };
    let html = "";
    if (h.shiftKey?.fromBase && h.layerKey) {
      // Shift lives on the pre-switch layer: press order matters
      html +=
        '<span class="chip s">' +
        fingerBadge(h.shiftKey) +
        "① Shift を先に押しながら</span>＋" +
        '<span class="chip l">' +
        fingerBadge(h.layerKey) +
        "② L" +
        h.layer +
        " キー</span>＋";
    } else {
      if (h.layerKey)
        html += '<span class="chip l">' + fingerBadge(h.layerKey) + "L" + h.layer + " キーを押しながら</span>＋";
      if (h.shiftKey) html += '<span class="chip s">' + fingerBadge(h.shiftKey) + "Shift</span>＋";
    }
    html += '<span class="chip t">' + fingerBadge(h.key) + escapeHtml(dispChar(ch)) + "</span>";
    if (h.alt) {
      const a = h.alt;
      let alt = "";
      if (a.shiftKey?.fromBase && a.layerKey) alt += "Shift先押し＋L" + a.layer + "キー＋";
      else {
        if (a.layerKey) alt += "L" + a.layer + "キー＋";
        if (a.shiftKey) alt += "Shift＋";
      }
      if (!a.layerKey && !a.shiftKey) alt += "そのまま ";
      alt += dispChar(ch);
      html += '<span class="alt">別案: ' + escapeHtml(alt) + "</span>";
    }
    hintEl.innerHTML = html;
  },

  skipChar() {
    // Enter skips characters that don't exist in the keymap
    if (!this.items.length || this.hint) return;
    if (this.isJP()) {
      this.softDone = false;
      this.finishUnit();
    } else {
      this.pos++;
      if (this.pos >= this.text.length) return this.nextItem();
    }
    this.render();
    this.refreshHint();
  },

  updateStats() {
    const min = this.startTime ? (Date.now() - this.startTime) / 60000 : 0;
    $("stWpm").textContent = min > 0 ? Math.round(this.correct / 5 / min) : 0;
    const tot = this.correct + this.miss;
    $("stAcc").textContent = (tot ? Math.round((this.correct / tot) * 100) : 100) + "%";
    $("stCombo").textContent = this.combo;
    $("stMiss").textContent = this.miss;
  },
};

function dispChar(c) {
  return c === " " ? "Space" : c === "\n" ? "Enter" : c === "\t" ? "Tab" : c;
}
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m],
  );
}

/* ---------- 6e. Input & UI wiring ---------- */

document.addEventListener("keydown", (e) => {
  if ($("resultDlg").open) return; // Esc closes the dialog natively
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") {
    // Esc during a run/countdown = back to the pre-start menu
    if (engine.running && isUnlimited()) {
      e.preventDefault();
      engine.finish();
    } // 無制限は結果を表示して終了
    else if (engine.running || engine.counting) {
      e.preventDefault();
      engine.idle();
    }
    return;
  }
  if (engine.counting) {
    e.preventDefault();
    return;
  } // ignore input during the 3-2-1 countdown
  if (!engine.running) {
    // Space / Enter starts a run
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      engine.start();
    }
    return;
  }
  if (e.key === "Enter" && engine.items.length && !engine.hint) {
    e.preventDefault();
    engine.skipChar();
    return;
  }
  if (e.key.length !== 1) return;
  e.preventDefault();
  engine.input(e.key === "¥" ? "\\" : e.key);
});

document.querySelectorAll(".modes button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".modes button").forEach((x) => {
      x.classList.remove("active");
    });
    b.classList.add("active");
    engine.mode = b.dataset.mode;
    if (engine.mode !== "mix" && guided.course !== engine.mode) {
      // 練習モードに対応するコース表示へ自動で切り替える
      guided.course = engine.mode;
      guided.selected = null;
    }
    if (engine.guided) guidedRenderAll();
    engine.idle();
  });
});
document.querySelectorAll(".course-tabs button").forEach((b) => {
  b.addEventListener("click", () => {
    guided.course = b.dataset.course;
    guided.selected = null;
    guidedRenderAll();
  });
});
document.querySelectorAll(".playstyle button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".playstyle button").forEach((x) => {
      x.classList.remove("active");
    });
    b.classList.add("active");
    engine.guided = b.dataset.guided === "1";
    $("guided").hidden = !engine.guided;
    if (engine.guided) guidedRenderAll();
    engine.idle();
  });
});
document.querySelectorAll(".times button").forEach((b) => {
  b.addEventListener("click", () => {
    runSeconds = +b.dataset.time;
    try {
      localStorage.setItem("cornixTime", String(runSeconds));
    } catch {}
    document.querySelectorAll(".times button").forEach((x) => {
      x.classList.toggle("active", x === b);
    });
    engine.idle();
  });
});
// reflect persisted choice on load
document.querySelectorAll(".times button").forEach((b) => {
  b.classList.toggle("active", +b.dataset.time === runSeconds);
});

$("btnDefDl").addEventListener("click", () => {
  if (!window.lastDefJson) {
    alert("まだ定義を読み取っていません");
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([window.lastDefJson], { type: "application/json" }));
  a.download = "vial.json";
  a.click();
});
$("typeline").addEventListener("click", () => {
  // アイドル中はタイピング欄クリックで開始
  if (!engine.running && !engine.counting) engine.start();
});
$("btnAgain").addEventListener("click", () => {
  $("resultDlg").close();
  engine.start();
});
$("selOut").value = outMode;
$("selOut").addEventListener("change", () => {
  outMode = $("selOut").value;
  try {
    localStorage.setItem("cornixOutMode", outMode);
  } catch {}
  charCache.clear();
  updateLegends();
  engine.refreshHint();
});
$("selPref").value = keyPref.v;
$("selPref").addEventListener("change", () => {
  keyPref.v = $("selPref").value;
  try {
    localStorage.setItem("cornixPref", keyPref.v);
  } catch {}
  charCache.clear(); // recompute guidance with the new preference
  engine.refreshHint();
});
for (const [id, key, store] of [
  ["selNumLayer", "num", "cornixNumLayer"],
  ["selSymLayer", "sym", "cornixSymLayer"],
]) {
  $(id).addEventListener("change", () => {
    layerPref[key] = $(id).value;
    try {
      localStorage.setItem(store, layerPref[key]);
    } catch {}
    charCache.clear();
    engine.refreshHint();
  });
}
$("btnSound").addEventListener("click", () => {
  soundOn = !soundOn;
  try {
    localStorage.setItem("cornixSound", soundOn ? "1" : "0");
  } catch {}
  updateSoundBtn();
  if (soundOn) audio.play("type"); // confirmation blip
});
$("btnGuidedReset").addEventListener("click", () => {
  if (!confirm("キー習得モードの練習履歴を消します。よろしいですか？")) return;
  guided.results = [];
  guided.selected = null;
  try {
    localStorage.removeItem(GUIDED_STORE_KEY);
  } catch {}
  guidedRebuildStats();
  guidedUpdateKeys();
  guidedRenderAll();
});

/* ---------- startup ---------- */
if (!restoreSavedKeymap()) showKbPlaceholder(); // 前回のレイアウト+キーマップがあれば自動復元
updateSoundBtn();
guidedLoad();
guidedRebuildStats();
guidedUpdateKeys();
engine.idle();

// ウィンドウ幅に合わせてキーボードを再フィット（キーマップ読込時のみ）
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (PHYS_KEYS.length && KB.layerCount) {
      renderKeyboard();
      if (engine?.hint) paintHint(engine.hint);
    }
    if (!$("guided").hidden) drawKeyChart(guidedSelectedKey());
  }, 120);
});
