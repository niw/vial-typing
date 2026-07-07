// Keycode tables and decoding (QMK/Vial numeric codes + .vil strings)

// Decoded keycode. t indicates the kind; only the fields needed for that kind are set
export interface KeyDef {
  t: string;
  code?: number;
  mods?: number;
  layer?: number;
  tap?: number;
  label?: string;
}

// HID usage -> [unshifted char, shifted char] (US layout)
const HID_CHARS: Record<number, [string, string]> = {};
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
const HID_CHARS_JIS: Record<number, [string, string]> = {
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

// Keycode -> character under the current layout interpretation (US/JIS). jis=true prefers the JIS table
export function charsOf(code: number, jis: boolean): [string, string] | undefined {
  if (jis) {
    if (code in HID_CHARS_JIS) return HID_CHARS_JIS[code];
    if (code === 0x35) return undefined; // JIS: Hankaku/Zenkaku — no character output
  }
  return HID_CHARS[code];
}

// labels for non-character HID codes
const KEYLABELS: Record<number, string> = {
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
  0x91: "IME OFF", // LANG1 / LANG2 (macOS's Kana / Eisu-Alphanumeric keys)
};
for (let i = 0; i < 12; i++) KEYLABELS[0x3a + i] = "F" + (i + 1); // F1-F12
for (let i = 0; i < 12; i++) KEYLABELS[0x68 + i] = "F" + (i + 13); // F13-F24 (HID 0x68-0x73)

export const modsHaveShift = (m: number) => !!(m & 0x02);
export function modsLabel(m: number) {
  const p: string[] = [];
  if (m & 1) p.push("Ctrl");
  if (m & 2) p.push("Sft");
  if (m & 4) p.push("Alt");
  if (m & 8) p.push("GUI");
  return p.join("+");
}

// shifted-symbol aliases (vial writes these in .vil files too)
const SHIFTED_ALIAS: Record<string, string> = {
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

// KC_ name -> HID code (for .vil parsing)
const KC_NAMES: Record<string, number> = {};
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
export const K_NONE: KeyDef = { t: "none" };
export const K_TRANS: KeyDef = { t: "trans" };

// numeric QMK/Vial keycode -> decoded object (handles both old-Vial and new-QMK layer ranges)
export function decodeNum(n: number): KeyDef {
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
const MT_MODS: Record<string, number> = {
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
export function parseVil(s: string | number | null): KeyDef {
  if (s === -1 || s === "-1" || s == null) return K_NONE;
  if (typeof s === "number") return decodeNum(s);
  s = String(s).trim();
  if (SHIFTED_ALIAS?.[s]) s = SHIFTED_ALIAS[s];
  if (s === "" || s === "KC_NO" || s === "KC_NONE") return K_NONE;
  if (s === "KC_TRNS" || s === "KC_TRANSPARENT") return K_TRANS;
  if (s in KC_NAMES) return { t: "kc", code: KC_NAMES[s], mods: 0 };
  let m: RegExpMatchArray | null;
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
    return { t: "lt", layer: +m[1], tap: inner.t === "kc" ? inner.code : 0 } as KeyDef;
  }
  if ((m = s.match(/^([A-Z_]+)_T\((.+)\)$/))) {
    const inner = parseVil(m[2]);
    return { t: "mt", mods: MT_MODS[m[1]] || 0, tap: inner.t === "kc" ? inner.code : 0 } as KeyDef;
  }
  if (
    (m = s.match(/^(LCTL|LSFT|LALT|LGUI|RCTL|RSFT|RALT|RGUI|C|S|A|G|LCA|LSA|LCAG|LCG|LSG|LAG|SGUI|MEH|HYPR)\((.+)\)$/))
  ) {
    const inner = parseVil(m[2]);
    if (inner.t === "kc") return { t: "kc", code: inner.code, mods: (inner.mods ?? 0) | (MT_MODS[m[1]] || 0) };
    return { t: "custom", label: s };
  }
  return { t: "custom", label: s.replace(/^KC_/, "") };
}

// tap output of a decoded key: {code, mods} or null
export function tapOf(k: KeyDef): { code: number; mods: number } | null {
  if (k.t === "kc") return { code: k.code ?? 0, mods: k.mods ?? 0 };
  if (k.t === "mt" || k.t === "lt") return { code: k.tap ?? 0, mods: 0 };
  return null;
}

export function legendFor(k: KeyDef, jis: boolean): string {
  switch (k.t) {
    case "none":
      return "";
    case "trans":
      return "▽";
    case "kc": {
      const ch = charsOf(k.code ?? 0, jis);
      if (ch) {
        // Keys with modifiers other than Shift (Ctrl/Alt/GUI) are treated as shortcuts:
        // show all modifiers (including Shift) + the base key before shifting (e.g. LSG(3) -> Sft+GUI+3)
        if ((k.mods ?? 0) & 0x0d) {
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
          return modsLabel(k.mods ?? 0) + "+" + baseKey;
        }
        const c = modsHaveShift(k.mods ?? 0) ? ch[1] : ch[0];
        if (c === " ") return "Space";
        if (c === "\n") return "⏎";
        if (c === "\t") return "Tab";
        return /^[a-z]$/.test(c) ? c.toUpperCase() : c;
      }
      const lbl = KEYLABELS[k.code ?? 0] || "0x" + (k.code ?? 0).toString(16);
      return k.mods ? modsLabel(k.mods) + "+" + lbl : lbl;
    }
    case "mt":
      return (modsLabel(k.mods ?? 0) || "Mod") + "\n" + legendFor({ t: "kc", code: k.tap, mods: 0 }, jis);
    case "lt":
      return "L" + k.layer + "\n" + legendFor({ t: "kc", code: k.tap, mods: 0 }, jis);
    case "mo":
      return "MO(" + k.layer + ")";
    case "lm":
      return "LM(" + k.layer + (modsHaveShift(k.mods ?? 0) ? ",Sft" : "") + ")";
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
      return (k.label ?? "").length > 7 ? (k.label ?? "").slice(0, 7) : (k.label ?? "");
    default:
      return "?";
  }
}

// shifted character printed in the keycap corner (5 -> %, ; -> : ...)
export function shiftedSub(k: KeyDef, jis: boolean): string {
  const tap = tapOf(k);
  if (!tap || tap.mods) return "";
  const chars = charsOf(tap.code, jis);
  if (!chars || chars[0] === chars[1]) return "";
  if (/^[a-z]$/.test(chars[0])) return ""; // A-Z: obvious, keep keycaps clean
  return chars[1];
}

export function dispChar(c: string) {
  return c === " " ? "Space" : c === "\n" ? "Enter" : c === "\t" ? "Tab" : c;
}
