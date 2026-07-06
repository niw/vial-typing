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
