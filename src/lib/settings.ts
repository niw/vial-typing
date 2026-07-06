// ユーザー設定。localStorageから起動時に復元し、変更時は各ハンドラが保存する
export type RomajiStyle = "hepburn" | "kunrei";

export const settings = {
  // "us" = US刻印通りの出力解釈, "jis" = JIS刻印通りの出力解釈
  outMode: "us" as "us" | "jis",
  // 入力案内の優先: "auto" = ホールド最少, "shift" = Shift優先, "layer" = レイヤー優先
  keyPref: "auto" as "auto" | "shift" | "layer",
  // 数字/記号カテゴリの案内レイヤー固定（"auto" またはレイヤー番号の文字列）
  layerPref: { num: "auto", sym: "auto" },
  romajiStyle: "hepburn" as RomajiStyle,
  soundOn: true,
  // 1走行の長さ(秒)。0 = 無制限(タイムアウトなし)
  runSeconds: 60,
};

export const isUnlimited = () => settings.runSeconds === 0;

try {
  if (localStorage.getItem("cornixOutMode") === "jis") settings.outMode = "jis";
  const pref = localStorage.getItem("cornixPref");
  if (pref === "shift" || pref === "layer") settings.keyPref = pref;
  const num = localStorage.getItem("cornixNumLayer");
  const sym = localStorage.getItem("cornixSymLayer");
  if (num && num !== "auto" && !Number.isNaN(+num)) settings.layerPref.num = num;
  if (sym && sym !== "auto" && !Number.isNaN(+sym)) settings.layerPref.sym = sym;
  if (localStorage.getItem("cornixRomaji") === "kunrei") settings.romajiStyle = "kunrei";
  settings.soundOn = localStorage.getItem("cornixSound") !== "0";
  const time = +(localStorage.getItem("cornixTime") ?? "");
  if ([0, 30, 60, 90].includes(time)) settings.runSeconds = time;
} catch {}

export function saveSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export interface SettingsSnapshot {
  outMode: "us" | "jis";
  keyPref: "auto" | "shift" | "layer";
  layerPref: { num: string; sym: string };
  romajiStyle: RomajiStyle;
  soundOn: boolean;
  runSeconds: number;
}

// 現在の設定をファイル保存用に取り出す
export function settingsSnapshot(): SettingsSnapshot {
  return {
    outMode: settings.outMode,
    keyPref: settings.keyPref,
    layerPref: { ...settings.layerPref },
    romajiStyle: settings.romajiStyle,
    soundOn: settings.soundOn,
    runSeconds: settings.runSeconds,
  };
}

// 取り込んだ設定を反映して localStorage にも保存する。値ごとに妥当性を検証し、
// 未知/不正なフィールドは無視して既存値を保つ。再計算などの副作用は呼び出し側が行う
export function settingsImport(source: unknown) {
  if (!source || typeof source !== "object") return;
  const s = source as Partial<SettingsSnapshot>;
  if (s.outMode === "us" || s.outMode === "jis") {
    settings.outMode = s.outMode;
    saveSetting("cornixOutMode", s.outMode);
  }
  if (s.keyPref === "auto" || s.keyPref === "shift" || s.keyPref === "layer") {
    settings.keyPref = s.keyPref;
    saveSetting("cornixPref", s.keyPref);
  }
  if (s.layerPref && typeof s.layerPref === "object") {
    for (const [key, store] of [
      ["num", "cornixNumLayer"],
      ["sym", "cornixSymLayer"],
    ] as const) {
      const value = s.layerPref[key];
      if (value === "auto" || (typeof value === "string" && value !== "" && !Number.isNaN(+value))) {
        settings.layerPref[key] = value;
        saveSetting(store, value);
      }
    }
  }
  if (s.romajiStyle === "hepburn" || s.romajiStyle === "kunrei") {
    settings.romajiStyle = s.romajiStyle;
    saveSetting("cornixRomaji", s.romajiStyle);
  }
  if (typeof s.soundOn === "boolean") {
    settings.soundOn = s.soundOn;
    saveSetting("cornixSound", s.soundOn ? "1" : "0");
  }
  if (typeof s.runSeconds === "number" && [0, 30, 60, 90].includes(s.runSeconds)) {
    settings.runSeconds = s.runSeconds;
    saveSetting("cornixTime", String(s.runSeconds));
  }
}
