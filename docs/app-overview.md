# ソースコード全体構造

Vial Typing のアプリケーション本体。Vial 対応キーボードからレイアウト定義とキーマップを読み取り、
「次に押すべき物理キー」を案内しながらタイピング練習をさせる。
Vite + React + TypeScript 構成で、`npm run build` で `dist/` へバンドルされる。
出題データ（`src/data/*.json`）と xz/lzma デコーダ（npm 依存）もバンドルに含まれ、実行時の外部取得は無い。

## アーキテクチャ

状態は `src/lib/` のモジュールが plain なミュータブルオブジェクトとして持ち、
変更後に `invalidate()`（`lib/store.ts`）を呼ぶと React が `useSyncExternalStore` 経由で再描画される。
コンポーネント（`src/components/`）は状態を読んで宣言的に描画するだけで、自前の状態をほぼ持たない。
エンジンやキーマップのロジックは React 非依存なので、単体でテスト・再利用できる。

```mermaid
flowchart TD
  hid["キーボード (WebHID)<br>lib/hid.ts"] --> km["キーマップ状態 KB<br>lib/kb.ts"]
  vil[".vil / vial.json ドロップ<br>lib/hid.ts"] --> km
  km --> lookup["逆引き findKeyForChar / 指番号 fingerFor<br>lib/kb.ts"]
  data["出題データ<br>lib/data.ts"] --> engine["練習エンジン engine<br>lib/engine.ts"]
  romaji["ローマ字分解 tokenizeKana<br>lib/romaji.ts"] --> engine
  guided["キー習得モード guided<br>lib/guided.ts"] --> engine
  engine -- 走行結果 --> guided
  lookup --> view
  engine --> view["Reactコンポーネント<br>components/*"]
  km --> view
  view -- "invalidate() 購読" --> store["lib/store.ts"]
```

## src/lib/ — ロジックと状態

| モジュール | 役割 |
|---|---|
| `store.ts` | 再描画通知（`invalidate`/`subscribe`）と共通UI状態 `ui`（ステータスピル・読み取りログ・ドロップ表示） |
| `settings.ts` | ユーザー設定 `settings`（配列解釈・入力案内・ローマ字スタイル・効果音・プレイ時間）と localStorage 復元 |
| `data.ts` | 出題コーパス（英単語・英文・日本語単語・日本語文・記号行）の import |
| `layout.ts` | KLE データの型と `parseKLE()`（物理キー配列への変換） |
| `keycodes.ts` | HID/QMK キーコード表、`decodeNum()`・`parseVil()`（数値/.vil文字列 → `KeyDef`）、刻印 `legendFor()` |
| `romaji.ts` | かな → ローマ字候補表 `ROMAJI`、スタイル切替 `applyRomajiStyle()`、`tokenizeKana()` |
| `kb.ts` | キーボード状態 `KB`（物理配置＋キーマップ＋表示レイヤー）、保存/復元、逆引き `findKeyForChar()`、指番号 `fingerFor()` |
| `guided.ts` | キー習得モードの統計・コース別解放判定・出題プール（詳細は後述） |
| `engine.ts` | 練習エンジン `engine`（走行のステートマシン。詳細は後述） |
| `hid.ts` | WebHID (Vial/VIA プロトコル) 読み取り `connectHID()`、`.vil`/vial.json 取り込み `loadVilText()` |
| `audio.ts` | WebAudio による効果音合成（素材ファイル無し） |
| `hint.ts` | 「次に打つ文字とその打ち方」の導出 `currentExpected()` |

### 逆引きと指番号（kb.ts）

- `findKeyForChar()`: 文字 → `{key, layer, shiftKey, layerKey, alt}`。全レイヤーの候補をスコアリング
  （ホールド数・レイヤー深さ・設定 `keyPref`/`layerPref` で重み付け）して最良と別案を返す。
  `charCache` にメモ化され、設定やキーマップ変更時に破棄される。
- `findShiftKey()`: Shift がレイヤー切替前にしか無い場合は「Shift 先押し」(`fromBase`) として扱う。
- `fingerFor()`: 物理配置から指番号（1=親指〜5=小指、ピアノ運指式）を推定。盤面中央で左右に分け、
  分割型は各半分の最終行を親指、残りは列単位で内側から人差し指×2列・中指・薬指・外側を小指とする。

### キー習得モード（guided.ts）— keybr.com 方式のキー解放

keybr.com の guided lesson の移植。1 走行を 1 レッスンとしてキー別の打鍵統計を取り、
習熟したキーから順に「解放」して出題を変えていく。通常⇔キー習得はモード切替（`engine.guided`）で、
練習モード（英語・日本語・記号・ミックス）と直交して組み合わせられる。

- コース（`GUIDED_COURSES`）: 解放順は練習モードごとの「コース」= 対象キー集合＋そのコーパスでの頻度順。
  英語は英単語+英文の英字頻度、日本語は日本語単語を標準ローマ字化した英字頻度、
  記号コースは記号行コーパスの英字トラックと記号・数字トラックの 2 本を持つ。
  **打鍵統計はコース間で共有**され、解放済み集合と注目キーだけがコースごとに変わる。
- 統計: 走行ごとにキー別の `[打鍵数, ミス数, 平均打鍵時間]` を記録（`guidedRecordRun`）。
  現在速度は走行間の指数平滑（`GUIDED_ALPHA = 0.1`）、自己ベストはその最小値（`guidedRebuildStats`）。
- 信頼度: `目標打鍵時間 ÷ 平滑打鍵時間`。目標は 175CPM = 35WPM（`GUIDED_TARGET_TIME`）。1.0 以上で「習得済み」。
- 解放判定（`guidedTrackKeys`）: トラックごとに頻度順で走査し、①最初の 6 キーは常に解放
  ②自己ベスト信頼度 1.0 到達キーは維持 ③解放済みが全て 1.0 に達したときだけ次の 1 キーを解放。
  最弱キーを「注目キー」にする。
- 出題（`guidedBuildPools`）: 各コースの解放済み集合でプールを作る。不足分は疑似単語・疑似かな・
  解放済み記号で識別子をつないだ生成行で補う。ミックスはお題の種別ごとに対応コースのプールを使う。
- 永続化: localStorage `vialTypingGuided` に直近 300 走行分を保存。

### 練習エンジン（engine.ts）

`engine` オブジェクトが走行の全状態を持つステートマシン。DOM には触れず、
タイプライン・統計・ヒントはすべてコンポーネント側が状態から導出する。

```mermaid
stateDiagram-v2
  [*] --> 待機
  待機 --> カウントダウン: クリック / Space / Enter（start）
  カウントダウン --> 走行中: 3-2-1 → GO（beginRun）
  カウントダウン --> 待機: Esc（idle）
  走行中 --> 待機: Esc・時間制は記録を破棄（idle）
  走行中 --> 結果表示: 残り時間0、無制限はEsc（finish）
  結果表示 --> カウントダウン: もう一度
  結果表示 --> 待機: Esc / ダイアログを閉じる
```

- 出題: `makeItem()` がモード（en/jp/sym/mix）に応じて選ぶ。キー習得モード中は解放済みキーのプールに
  差し替える。`drawFrom()` はシャッフル済みの袋から引いて偏りと連続重複を防ぐ。
- 入力: `input()` → 英文系 `inputText()`／日本語 `inputJP()`。日本語は unit 単位でローマ字候補と
  前方一致照合し、「ん」の n 1 打ち確定（`softDone` → `finishUnit`）も扱う。
  `expect()` が次に打つべき 1 文字を返し、ヒント表示と打鍵記録（`recordStep`）が使う。
- 走行制御: `start()`（カウントダウン）→ `beginRun()` → 100ms 毎の `tick()` →
  `finish()`（スコア集計と `result` 設定。キー習得モードは打鍵記録の確定）／`idle()`。
- コンボボーナス: 30 連続正解ごとに +1 秒（無制限モードでは付与しない）。
- `runSeconds`: 30/60/90 秒、0 は無制限（Esc で終了して結果表示）。

## src/components/ — React コンポーネント

| コンポーネント | 描画対象 |
|---|---|
| `useApp.ts` | `invalidate()` を購読するフック（`useSyncExternalStore`。App が購読しツリー全体を再描画） |
| `App.tsx` | 全体レイアウト、グローバル keydown・ドラッグ&ドロップ、表示レイヤー自動切替 |
| `Header.tsx` | タイトル・ステータスピル・読み取り/開く/消すボタン |
| `Toolbar.tsx` | モード切替・練習モード・プレイ時間・設定セレクト群 |
| `StatBar.tsx` | 残り時間(経過時間)・WPM・正確率・コンボ・ミス・+1s ポップ |
| `GuidedPanel.tsx` | キー習得パネル（コースタブ・キーチップ・詳細・グラフ） |
| `keyChartDraw.ts` | キー別速度推移グラフの canvas 描画（散布図＋平滑曲線＋目標線） |
| `TypePanel.tsx` | 出題表示・タイプライン・操作ヒントチップ（指番号付き）・次語キュー |
| `KeyboardPanel.tsx` | キーボード図（キー配置・刻印・ハイライト・指番号バッジ）・読み取りログ |
| `ResultDialog.tsx` | 結果ダイアログ（スコア・ランク・キー解放アナウンス） |

再描画はキーストロークと 100ms のタイマー毎に全体で走るが、UI が小さいので問題にならない。
canvas グラフだけは選択キーのオブジェクト同一性を effect の依存にして、統計が変わったときのみ再描画する。
キーボード盤面も `useMemo`（依存: ヒント・キーマップ参照・レイヤー・コンテナ幅）で、tick では組み立て直さない。

## スタイル

共通スタイル（テーマ変数・リセット・ページ骨格・ボタン共通）は `src/styles/base.css` に置き、
`main.tsx` が最初に import して cascade の土台を固定する。コンポーネント固有のスタイルは
`src/components/<名前>.css` として各コンポーネントの隣に置き、その `.tsx` が import する（コロケーション）。
クラス名はグローバルのままなので、E2E テストのセレクタや DOM 構造には影響しない。

## 起動処理（src/main.tsx）

キー習得モードの履歴読込（`guidedLoad` → `guidedRebuildStats` → `guidedUpdateKeys`）→
保存済みキーマップの復元（`restoreSavedKeymap`。無ければプレースホルダ表示のまま）→
`createRoot` で `<App />` をマウント。以降の画面更新はすべて `invalidate()` 経由。

## localStorage キー一覧

| キー | 内容 |
|---|---|
| `vialTypingKeymap` | 読み取ったレイアウト定義＋キーマップ（次回自動復元） |
| `vialTypingGuided` | キー習得モードの走行履歴（直近 300 件） |
| `cornixTime` | プレイ時間（0/30/60/90） |
| `cornixOutMode` | 配列解釈（us/jis） |
| `cornixPref` | 入力案内の優先（auto/shift/layer） |
| `cornixRomaji` | ローマ字の案内表記（hepburn/kunrei） |
| `cornixNumLayer` / `cornixSymLayer` | 数字/記号のレイヤー固定 |
| `cornixSound` | 効果音 ON/OFF |
