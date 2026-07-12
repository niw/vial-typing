// UI localization (English / Japanese) via i18next / react-i18next. The locale is resolved once at
// startup: a manual override in localStorage wins, otherwise the browser locale, defaulting to English.
// i18next is initialized synchronously (initAsync: false) so module-level `t(...)` calls work at import time.
// The manual toggle persists the choice and reloads, so the language stays fixed for the lifetime of a page load.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export type Locale = "en" | "ja";

export const LOCALE_STORE_KEY = "cornixLocale";

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORE_KEY);
    if (saved === "en" || saved === "ja") return saved;
    // Honor the browser's preference order: return the first supported language, not merely the
    // first Japanese entry anywhere in the list — ["en", "ja"] must resolve to English.
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const lang of langs) {
      const lower = lang?.toLowerCase();
      if (lower?.startsWith("ja")) return "ja";
      if (lower?.startsWith("en")) return "en";
    }
  } catch {}
  return "en";
}

export const locale: Locale = detectLocale();

// English is the source of truth; `ja` is typed as `typeof en` so tsc fails the build on any missing/mistyped key.
// Interpolated values use i18next `{{var}}` placeholders.
const en = {
  docTitle: "Vial Typing — keymap-linked typing practice",

  header: {
    sub: "Read the layout and keymap from a Vial-compatible keyboard and practice",
    connect: "🔌 Read from keyboard",
    openVil: "📄 Open .vil",
    forget: "🗑 Clear keymap",
    forgetTitle: "Clear the saved layout & keymap and return to the not-loaded state",
    save: "💾 Save",
    saveTitle: "Save the keymap, practice records, and settings to a file",
    restore: "📂 Restore",
    restoreTitle: "Restore the saved keymap, practice records, and settings from a file",
    langTitle: "UI display language",
    langEn: "English",
    langJa: "日本語",
  },

  toolbar: {
    modeLabel: "Mode",
    normal: "Normal",
    keyMastery: "Key Mastery",
    keyMasteryTitle: "Unlock keys based on your typing history and give prompts typable with only the unlocked keys",
    practiceModeLabel: "Practice mode",
    modeEn: "English words & sentences",
    modeJp: "Japanese romaji",
    modeSym: "Symbols & layers",
    modeVim: "Vim commands",
    modeMix: "Mixed",
    playTimeLabel: "Play time",
    time30: "30s",
    time60: "60s",
    time90: "90s",
    unlimited: "Unlimited",
    settingsLabel: "Settings",
    soundOn: "🔊 Sound on",
    soundOff: "🔇 Sound off",
    soundTitle: "Toggle sound effects",
    outLabel: "Layout",
    outTitle:
      "How to interpret typed output. 'US-compatible' = OS set to US with no conversion, or OS set to JIS while the firmware outputs per the US legend. 'JIS-compatible' = OS set to JIS with no conversion, or OS set to US while the firmware outputs per the JIS legend",
    outUs: "US-compatible",
    outJis: "JIS-compatible",
    prefLabel: "Input guide",
    prefTitle: "Which typing method to guide when the same character can be entered several ways",
    prefAuto: "Auto (recommended)",
    prefShift: "Prefer Shift",
    prefLayer: "Prefer layer",
    romajiLabel: "Romaji",
    romajiTitle: "The spelling used to guide Japanese romaji. You can type using either style's spelling",
    romajiHepburn: "Hepburn",
    romajiKunrei: "Kunrei",
    numLabel: "Digits",
    numTitle: "Pin which layer digits are typed on",
    symLabel: "Symbols",
    symTitle: "Pin which layer symbols are typed on",
    layerAuto: "Auto",
  },

  statbar: {
    elapsed: "Elapsed",
    remaining: "Time left",
    accuracy: "Accuracy",
    combo: "Combo",
    miss: "Misses",
  },

  guided: {
    headTitle: "🔓 Keys unlock based on your typing history, and the prompt words change",
    courseEn: "English",
    courseJp: "Japanese",
    courseSym: "Symbols",
    courseVim: "Vim",
    allUnlocked: "🎉 All keys unlocked",
    sep: " · ",
    focusLetter: "Learning: {{key}}",
    focusSymbol: "Symbol: {{sym}}",
    resetTitle: "Clear the key-mastery practice history and return to the unlearned state",
    resetConfirm: "This will erase your key-mastery practice history. Are you sure?",
    resetButton: "🗑 Clear history",
    chipUnmeasured: "{{name}} (unmeasured)",
    chipConfidence: "{{name}} (confidence {{pct}}%)",
    chipLocked: "{{name}} (locked)",
    infoLocked: " 🔒 Locked: unlocks once all earlier keys reach the target speed (35 WPM)",
    infoUnmeasured: " Unmeasured: a bit more keystroke data is needed",
    infoRecent: " Recent ",
    infoConfBest: " (confidence {{pct}}) · best ",
    infoBestPct: " ({{pct}})",
    infoAccuracy: " · accuracy {{pct}}",
    infoLearnRate: " · learning rate {{rate}} WPM/run",
  },

  result: {
    titleDone: "🎉 Well done!",
    titleTimeUp: "🎉 Time's up!",
    scoreFormula: "Score = correct keys×10 + words×100 + max combo×30 − misses×20",
    unlock: "🔓 Unlocked new keys: {{keys}}",
    accuracy: "Accuracy",
    wordsTyped: "Words typed",
    maxCombo: "Max combo",
    missCount: "Misses",
    bonusEarned: "Bonus earned",
    again: "Again",
    escHint: "Press ESC to return to the menu",
  },

  typePanel: {
    startPrompt: "▶ Start",
    startSub: "Click / Space / Enter to begin  ·  ESC to go back while playing",
    hintMissingPre: "⚠ ",
    hintMissingPost: " isn't in this keymap (press Enter to skip)",
    shiftFirst: "① Hold Shift first",
    layerOrdered: "② L{{layer}} key",
    layerHold: "Hold L{{layer}} key",
    altPrefix: "Alt: ",
    altShiftFirst: "Shift-first + L{{layer}} key + ",
    altLayer: "L{{layer}} key + ",
    altShift: "Shift + ",
    altPlain: "as-is ",
    queuePrefix: "Next: ",
  },

  keyboard: {
    legendPressKey: "Key to press",
    legendWithShift: "While holding Shift",
    legendWithLayer: "While holding the layer key",
    bullet: "• ",
    noteReadLabel: "How to read:",
    noteRead:
      " Connect a Vial-compatible keyboard via USB and press “Read from keyboard” to automatically read the layout definition and keymap (requires Chrome/Edge, a WebHID-capable browser).",
    noteFallbackPre: "If reading the layout fails, drop the keyboard's ",
    noteFallbackMid: " to apply the layout, then use ",
    noteFallbackMid2: " to export a ",
    noteFallbackPost: " and drop it here.",
    noteImePre: "In Japanese romaji mode, turn ",
    noteImeBold: "off",
    noteImePost:
      " your IME (Japanese input). You can type romaji in either Hepburn or Kunrei style (switch the guide spelling via the “Romaji” setting).",
    placeholderTitle: "⌨️ No keyboard loaded",
    placeholderBody1:
      "Press “🔌 Read from keyboard” to automatically load the layout and keymap from the connected Vial-compatible keyboard.",
    placeholderBody2: "Or drop vial.json (layout) / .vil (keymap) onto this page.",
    headTitle: "Keyboard (select the layer to view / auto-switches while typing)",
    debugSummary: "🔍 Read log (check here if something isn't working)",
    saveDefBtn: "Save the read definition as vial.json",
    noDefAlert: "No definition has been read yet",
    emptyLog: "(No read has been performed yet)",
  },

  app: {
    dropText: "Drop a .vil / vial.json / backup to load",
  },

  keyChart: {
    empty: "No records yet — typing this character will record it",
    target: "Target {{wpm}}",
    now: "Now",
  },

  fileDialog: {
    backupFilter: "Vial Typing backup",
  },

  device: {
    title: "Select a keyboard",
    unknownName: "(unknown)",
    cancel: "Cancel",
    notFound: "No Vial-compatible keyboard found",
    noResponse: "No response from the device",
  },

  defaultKeyboard: {
    statusText: "Showing the default US keyboard (replace via read/drop)",
    name: "US Keyboard",
  },

  kb: {
    sampleStatus: "No keymap loaded (showing sample)",
    applied: "✓ {{label}} ({{layers}} layers)",
    appliedRestored: " · restored the previous keymap",
    savedKeymapLabel: "Saved keymap",
    fingerNames: { 1: "Thumb", 2: "Index", 3: "Middle", 4: "Ring", 5: "Pinky" } as Record<number, string>,
  },

  engine: {
    notice: "⌨️ Load a keyboard first (“Read from keyboard” or drop a vial.json / .vil)",
  },

  hid: {
    unsupported: "This environment doesn't support HID. Use Chrome/Edge, or load a .vil",
    readingLayout: "Reading layout definition…",
    device: "Device: {{label}}",
    vialResponse: "vial response (FE00): {{hex}}  → protocol v{{version}}",
    noFe00: "No FE00 response (continue)",
    sizeResponse: "Size response (FE01): {{hex}}",
    defSize: "Definition size: {{size}} bytes",
    defHead: "Definition head: {{hex}}",
    xzFormat: " (xz format)",
    nonXz: " (non-xz)",
    decompressed: "Decompressed OK: {{chars}} chars",
    defInfo: "Definition: name={{name}} matrix={{matrix}} layouts={{hasLayouts}}",
    layoutApplied: "Layout applied OK: {{keys}} keys (matrix {{rows}}x{{cols}})",
    fullJsonHeader: "--- Full definition JSON (for bug reports) ---",
    invalidDefSize: "Invalid definition size ({{size}})",
    defReadFailed: "✗ Failed to read definition: {{message}}",
    defReadHint: "Layout unknown, so the keymap won't be read. Drop vial.json then load .vil, or try again.",
    defReadStatus: "Failed to read layout definition: {{message}} (see the read log)",
    readingKeymap: "Reading keymap…",
    keymapRead: "Keymap read OK: {{layers}} layers ({{rows}}x{{cols}})",
    readFailed: "Read failed: {{message}} (check the USB connection or load a .vil)",
    notVialJson: "Not a vial.json format",
    noLayoutKeys: "The layout has no keys",
    layoutOnly: "✓ Layout applied: {{name}} (keymap not loaded)",
    noLayout: "No layout",
    vilParseFailed: "Failed to parse the .vil: {{message}}",
  },

  backup: {
    saved: "✓ Saved the current state to a file",
    notBackup: "This file isn't a Vial Typing backup",
    newerVersion: "This backup is from a newer version of Vial Typing. Please update the app",
    confirmReplace: "This will replace your current practice records with the file's contents. Are you sure?",
    partKeymap: "keymap",
    partRecords: "practice records",
    partSettings: "settings",
    join: ", ",
    nothingImported: "The backup had no importable state",
    restored: "✓ Restored {{label}}",
  },
};

const ja: typeof en = {
  docTitle: "Vial Typing — キーマップ連動タイピング練習",

  header: {
    sub: "Vial対応キーボードのレイアウトとキーマップを読み取って練習",
    connect: "🔌 キーボードから読み取る",
    openVil: "📄 .vilを開く",
    forget: "🗑 キーマップを消す",
    forgetTitle: "保存したレイアウト・キーマップを消して未読込に戻す",
    save: "💾 保存",
    saveTitle: "キーマップ・練習記録・設定をファイルに保存",
    restore: "📂 復元",
    restoreTitle: "保存したキーマップ・練習記録・設定をファイルから復元",
    langTitle: "UIの表示言語",
    langEn: "English",
    langJa: "日本語",
  },

  toolbar: {
    modeLabel: "モード",
    normal: "通常",
    keyMastery: "キー習得",
    keyMasteryTitle: "タイピング履歴に応じてキーを解放し、解放済みキーだけで打てるお題を出す",
    practiceModeLabel: "練習モード",
    modeEn: "英単語・英文",
    modeJp: "日本語ローマ字",
    modeSym: "記号・レイヤー",
    modeVim: "Vimコマンド",
    modeMix: "ミックス",
    playTimeLabel: "プレイ時間",
    time30: "30秒",
    time60: "60秒",
    time90: "90秒",
    unlimited: "無制限",
    settingsLabel: "設定",
    soundOn: "🔊 音あり",
    soundOff: "🔇 音なし",
    soundTitle: "効果音のON/OFF",
    outLabel: "配列",
    outTitle:
      "文字の出方の解釈。『US互換』= OSがUS設定で変換なし、またはOSがJIS設定でファームウェアがUS刻印通りに変換する場合。『JIS互換』= OSがJIS設定で変換なし、またはOSがUS設定でファームウェアがJIS刻印通りに変換する場合",
    outUs: "US互換",
    outJis: "JIS互換",
    prefLabel: "入力案内",
    prefTitle: "同じ文字を複数の方法で入力できる場合に、どの打ち方を案内するか",
    prefAuto: "自動（おすすめ）",
    prefShift: "Shift優先",
    prefLayer: "レイヤー優先",
    romajiLabel: "ローマ字",
    romajiTitle: "日本語ローマ字の案内に使う綴り。どちらのスタイルの綴りでも入力はできます",
    romajiHepburn: "ヘボン式",
    romajiKunrei: "訓令式",
    numLabel: "数字",
    numTitle: "数字をどのレイヤーで打つかを固定する",
    symLabel: "記号",
    symTitle: "記号をどのレイヤーで打つかを固定する",
    layerAuto: "自動",
  },

  statbar: {
    elapsed: "経過時間",
    remaining: "残り時間",
    accuracy: "正確率",
    combo: "コンボ",
    miss: "ミス",
  },

  guided: {
    headTitle: "🔓 タイピング履歴に応じてキーが解放され、出題単語が変わります",
    courseEn: "英語",
    courseJp: "日本語",
    courseSym: "記号",
    courseVim: "Vim",
    allUnlocked: "🎉 すべてのキーを解放しました",
    sep: " ・ ",
    focusLetter: "習得中のキー: {{key}}",
    focusSymbol: "記号: {{sym}}",
    resetTitle: "キー習得モードの練習履歴を消して未習得の状態に戻す",
    resetConfirm: "キー習得モードの練習履歴を消します。よろしいですか？",
    resetButton: "🗑 履歴を消す",
    chipUnmeasured: "{{name}}（未計測）",
    chipConfidence: "{{name}}（信頼度 {{pct}}%）",
    chipLocked: "{{name}}（未解放）",
    infoLocked: " 🔒 未解放：前のキーがすべて目標速度（35 WPM）に達すると解放されます",
    infoUnmeasured: " 未計測：もう少し打鍵データが必要です",
    infoRecent: " 直前 ",
    infoConfBest: "（信頼度 {{pct}}）・自己ベスト ",
    infoBestPct: "（{{pct}}）",
    infoAccuracy: "・正確率 {{pct}}",
    infoLearnRate: "・学習率 {{rate}} WPM/走行",
  },

  result: {
    titleDone: "🎉 おつかれさま！",
    titleTimeUp: "🎉 タイムアップ！",
    scoreFormula: "スコア = 正解打鍵×10 ＋ ワード×100 ＋ 最大コンボ×30 − ミス×20",
    unlock: "🔓 新しいキーを解放: {{keys}}",
    accuracy: "正確率",
    wordsTyped: "入力ワード数",
    maxCombo: "最大コンボ",
    missCount: "ミス数",
    bonusEarned: "獲得ボーナス",
    again: "もう一度",
    escHint: "ESCキーでメニューに戻る",
  },

  typePanel: {
    startPrompt: "▶ スタート",
    startSub: "クリック / Space / Enter で開始　・　プレイ中は ESC で戻る",
    hintMissingPre: "⚠ このキーマップでは「",
    hintMissingPost: "」が見つかりません（Enterでスキップ）",
    shiftFirst: "① Shift を先に押しながら",
    layerOrdered: "② L{{layer}} キー",
    layerHold: "L{{layer}} キーを押しながら",
    altPrefix: "別案: ",
    altShiftFirst: "Shift先押し＋L{{layer}}キー＋",
    altLayer: "L{{layer}}キー＋",
    altShift: "Shift＋",
    altPlain: "そのまま ",
    queuePrefix: "次: ",
  },

  keyboard: {
    legendPressKey: "押すキー",
    legendWithShift: "Shiftを押しながら",
    legendWithLayer: "レイヤーキーを押しながら",
    bullet: "・",
    noteReadLabel: "読み取り方法:",
    noteRead:
      " Vial対応キーボードをUSBケーブルで接続し「キーボードから読み取る」を押すと、レイアウト定義とキーマップを自動で読み取ります（Chrome / Edge、WebHID対応ブラウザが必要）。",
    noteFallbackPre: "レイアウトの読み取りに失敗する場合は、キーボードの ",
    noteFallbackMid: " をドロップしてレイアウトを適用後、",
    noteFallbackMid2: " でエクスポートした ",
    noteFallbackPost: " をドロップしてください。",
    noteImePre: "日本語ローマ字モードでは IME（日本語入力）を",
    noteImeBold: "オフ",
    noteImePost:
      "にしてください。ローマ字は ヘボン式/訓令式 どちらでも入力できます（案内に使う綴りは設定の「ローマ字」で切替）。",
    placeholderTitle: "⌨️ キーボードが未読込です",
    placeholderBody1:
      "「🔌 キーボードから読み取る」を押すと、接続中のVial対応キーボードからレイアウトとキーマップを自動で読み込みます。",
    placeholderBody2: "または vial.json（レイアウト）/ .vil（キーマップ）をこのページにドロップしてください。",
    headTitle: "キーボード（表示レイヤーを選択 / 入力時は自動切替）",
    debugSummary: "🔍 読み取りログ（うまく動かないときはここを確認）",
    saveDefBtn: "読み取った定義をvial.jsonとして保存",
    noDefAlert: "まだ定義を読み取っていません",
    emptyLog: "（まだ読み取りを実行していません）",
  },

  app: {
    dropText: ".vil / vial.json / バックアップ をドロップして読み込み",
  },

  keyChart: {
    empty: "まだ記録がありません — この文字を打つと記録されます",
    target: "目標 {{wpm}}",
    now: "今",
  },

  fileDialog: {
    backupFilter: "Vial Typing バックアップ",
  },

  device: {
    title: "キーボードを選択",
    unknownName: "(名称不明)",
    cancel: "キャンセル",
    notFound: "Vial対応キーボードが見つかりません",
    noResponse: "デバイスからの応答がありません",
  },

  defaultKeyboard: {
    statusText: "既定のUS配列キーボードを表示中（読み取り/ドロップで置き換え可）",
    name: "US配列キーボード",
  },

  kb: {
    sampleStatus: "キーマップ未読込（サンプル表示中）",
    applied: "✓ {{label}}（{{layers}}レイヤー）",
    appliedRestored: " · 前回のキーマップを復元",
    savedKeymapLabel: "保存済みキーマップ",
    fingerNames: { 1: "親指", 2: "人差し指", 3: "中指", 4: "薬指", 5: "小指" } as Record<number, string>,
  },

  engine: {
    notice: "⌨️ 先にキーボードを読み込んでください（「キーボードから読み取る」または vial.json / .vil をドロップ）",
  },

  hid: {
    unsupported: "この環境はHID接続に非対応です。Chrome/Edgeを使うか .vil を読み込んでください",
    readingLayout: "レイアウト定義を読み取り中…",
    device: "デバイス: {{label}}",
    vialResponse: "vial応答(FE00): {{hex}}  → プロトコルv{{version}}",
    noFe00: "FE00応答なし（continue）",
    sizeResponse: "サイズ応答(FE01): {{hex}}",
    defSize: "定義サイズ: {{size}} bytes",
    defHead: "定義先頭: {{hex}}",
    xzFormat: " (xz形式)",
    nonXz: " (xz以外)",
    decompressed: "展開OK: {{chars}}文字",
    defInfo: "定義: name={{name}} matrix={{matrix}} layouts={{hasLayouts}}",
    layoutApplied: "レイアウト適用OK: {{keys}}キー（マトリクス {{rows}}x{{cols}}）",
    fullJsonHeader: "--- 定義JSON全文（不具合報告用） ---",
    invalidDefSize: "定義サイズが不正 ({{size}})",
    defReadFailed: "✗ 定義読み取り失敗: {{message}}",
    defReadHint:
      "レイアウト不明のままキーマップは読み取りません。vial.jsonをドロップしてから.vilを読み込むか、再試行してください。",
    defReadStatus: "レイアウト定義の読み取りに失敗: {{message}}（読み取りログ参照）",
    readingKeymap: "キーマップを読み取り中…",
    keymapRead: "キーマップ読み取りOK: {{layers}}レイヤー ({{rows}}x{{cols}})",
    readFailed: "読み取り失敗: {{message}}（USB接続を確認するか .vil を読み込んでください）",
    notVialJson: "vial.json形式ではありません",
    noLayoutKeys: "レイアウトにキーがありません",
    layoutOnly: "✓ レイアウト適用: {{name}}（キーマップは未読込）",
    noLayout: "layoutがありません",
    vilParseFailed: ".vilの解析に失敗: {{message}}",
  },

  backup: {
    saved: "✓ 現在の状態をファイルに保存しました",
    notBackup: "このファイルはVial Typingのバックアップではありません",
    newerVersion: "このバックアップは新しいバージョンのVial Typingのものです。アプリを更新してください",
    confirmReplace: "現在の練習記録を、ファイルの内容で置き換えます。よろしいですか？",
    partKeymap: "キーマップ",
    partRecords: "練習記録",
    partSettings: "設定",
    join: "・",
    nothingImported: "取り込める状態がバックアップにありませんでした",
    restored: "✓ {{label}}を復元しました",
  },
};

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ja: { translation: ja } },
  lng: locale,
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes; avoid double-escaping interpolated values
  initAsync: false, // synchronous init so module-level t(...) works at import time
});

// Typed keys: makes t("header.connect") checked at compile time, and flags missing/mistyped keys.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

export const t = i18n.t;
export default i18n;
