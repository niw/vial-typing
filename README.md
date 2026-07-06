# Vial Typing

Vial対応キーボード全般で使えるタイピング練習ソフト。

接続したキーボードから**レイアウト定義とキーマップを直接読み取り**、次に押すべきキー（レイヤーキー・Shiftの押し順を含む）をキーボード図上にインジケータ表示します。[Cornix](https://en.zfrontier.com/products/in-stock-cornix-tented-low-profile-split-ergo-keyboard-by-jezail-funder)（Jezail Funder）向けに開発し、汎用化したものです。

## 特徴

- **レイアウト自動認識**: WebHID（Vialプロトコル）で接続キーボードからレイアウト定義（xz圧縮vial.json）とキーマップを読み取り。QMK(Vial)/RMKどちらのファームウェアにも対応
- **ファイル読み込み**: `vial.json`（レイアウト）と `.vil`（キーマップ）のドラッグ＆ドロップにも対応
- **4モード**: 英単語・英文 / 日本語ローマ字（ヘボン式・訓令式両対応）/ 記号・レイヤー練習 / ミックス
- **寿司打スタイル**: 30・60・90秒選択、30コンボごとに+1秒ボーナス、総合スコアとランク判定
- **入力案内のカスタマイズ**: Shift優先/レイヤー優先、数字・記号のレイヤー固定、第2候補の薄表示
- **効果音**: タイプ音・コンボ音・ミス音（ON/OFF切替可）

## 使い方

ブラウザ（Chrome / Edge 推奨。WebHIDが必要）で開き、「キーボードから読み取る」を押すだけ。
macOS アプリ（下記）でも同じように使えます。

## 開発

Vite + React + TypeScript 構成。ソースは `src/` にあり、ロジックと状態は `src/lib/`、
UI は `src/components/` に分かれています（全体像は `docs/app-overview.md`）。

```sh
npm install
npm run dev     # 開発サーバー（make run でも可）
npm run build   # 型チェック + dist/ へビルド
npm run test    # Playwrightテスト（ビルドして実行）
npm run lint    # Biome
```

### macOS アプリ (Tauri)

同じフロントを Tauri で包んで .app 化できます（`src-tauri/`）。WKWebView は WebHID 非対応なので、
HIDアクセスだけ Rust (hidapi) 側に実装し、実行時に web/Tauri のトランスポートを切り替えています。
Rust ツールチェーンが必要です。

```sh
npm run tauri:dev     # アプリを開発起動
npm run tauri:build   # .app / .dmg をビルド
```

## License

The original [Vial Typing](https://github.com/shakushakupanda/vial-typing) is licensed under the [MIT License](LICENSE).

This modified version of Vial Typing is licensed under the [MIT License](LICENSE).
The changes are made with havily using Claude Code Fable 5 and Opus 4.8.

Some of the word lists used for practice (part of `data/en_words.json` and `data/jp_words.json`) are generated from the frequency-ordered word data of [keybr.com](https://github.com/aradzie/keybr.com), which are licensed under the [AGPL-3.0](LICENSE).

The unlock algorithm for the key-mastery mode is also based on [keybr.com](https://github.com/aradzie/keybr.com)'s guided lesson, which are also licensed under the [AGPL-3.0](LICENSE).
