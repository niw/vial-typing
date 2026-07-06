# Vial Typing

Vial対応キーボード全般で使えるタイピング練習サイト。

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

## 開発

Vite + TypeScript 構成。ソースは `src/`（`main.ts` / `style.css` / `index.html` / `data/*.json`）にあります。

```sh
npm install
npm run dev     # 開発サーバー（make run でも可）
npm run build   # 型チェック + dist/ へビルド
npm run test    # Playwrightテスト（ビルドして実行）
npm run lint    # Biome
```

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

- 出題単語リスト（`data/en_words.json` と `data/jp_words.json` の一部）は
  [keybr.com](https://github.com/aradzie/keybr.com)（AGPL-3.0）の頻度順単語データから生成しています。
- キー習得モードの解放アルゴリズムも keybr.com の guided lesson を参考にしています。
