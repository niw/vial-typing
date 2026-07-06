// ローマ字エンジン: かな→ローマ字候補の表と入力単位への分解

import type { RomajiStyle } from "./settings";
import { settings } from "./settings";

export const ROMAJI: Record<string, string[]> = {
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

// ローマ字の案内表記スタイル。第1候補(=案内に使う綴り)を並べ替えるだけで、
// どちらのスタイルの綴りでも入力自体は常に受け付ける
const ROMAJI_STYLE_PREFS = {
  hepburn: {
    し: "shi",
    ち: "chi",
    つ: "tsu",
    ふ: "fu",
    じ: "ji",
    しゃ: "sha",
    しゅ: "shu",
    しょ: "sho",
    ちゃ: "cha",
    ちゅ: "chu",
    ちょ: "cho",
    じゃ: "ja",
    じゅ: "ju",
    じょ: "jo",
    しぇ: "she",
    ちぇ: "che",
    じぇ: "je",
  },
  kunrei: {
    し: "si",
    ち: "ti",
    つ: "tu",
    ふ: "hu",
    じ: "zi",
    しゃ: "sya",
    しゅ: "syu",
    しょ: "syo",
    ちゃ: "tya",
    ちゅ: "tyu",
    ちょ: "tyo",
    じゃ: "zya",
    じゅ: "zyu",
    じょ: "zyo",
    しぇ: "sye",
    ちぇ: "tye",
    じぇ: "zye",
  },
};

export function applyRomajiStyle(style: RomajiStyle) {
  for (const [kana, preferred] of Object.entries(ROMAJI_STYLE_PREFS[style])) {
    const opts = ROMAJI[kana];
    const at = opts.indexOf(preferred);
    if (at > 0) {
      opts.splice(at, 1);
      opts.unshift(preferred);
    }
  }
}
applyRomajiStyle(settings.romajiStyle);

export interface KanaUnit {
  kana: string;
  opts: string[];
  sok?: boolean;
  done?: string;
}
export function tokenizeKana(word: string): KanaUnit[] {
  const units: KanaUnit[] = [];
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
      let cons: string[] = [];
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
