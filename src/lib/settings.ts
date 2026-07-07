// User settings. Restored from localStorage at startup; each handler saves on change.
export type RomajiStyle = "hepburn" | "kunrei";

export const settings = {
  // "us" = interpret output per US legend, "jis" = interpret output per JIS legend
  outMode: "us" as "us" | "jis",
  // guidance preference: "auto" = fewest holds, "shift" = prefer Shift, "layer" = prefer layer
  keyPref: "auto" as "auto" | "shift" | "layer",
  // fixed guidance layer for the digit/symbol categories ("auto" or a layer-number string)
  layerPref: { num: "auto", sym: "auto" },
  romajiStyle: "hepburn" as RomajiStyle,
  soundOn: true,
  // length of one run (seconds). 0 = unlimited (no timeout)
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

// extract the current settings for saving to a file
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

// Apply imported settings and also save them to localStorage. Each value is validated;
// unknown/invalid fields are ignored and keep their existing value. Side effects like recomputation are the caller's responsibility.
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
