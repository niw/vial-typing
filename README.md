# Vial Typing

[![Deploy GitHub Pages](https://github.com/niw/vial-typing/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/niw/vial-typing/actions/workflows/deploy-pages.yml)

*[日本語 ](README-ja.md)*

**[Open the app in your browser](https://niw.github.io/vial-typing/)**

A typing practice tool that works with any Vial-compatible keyboard.

It reads the **layout definition and keymap directly** from the connected keyboard, then shows an indicator on the keyboard diagram for the next key to press (including layer keys and Shift press order). Originally built for the [Cornix](https://en.zfrontier.com/products/in-stock-cornix-tented-low-profile-split-ergo-keyboard-by-jezail-funder) (Jezail Funder) and later generalized.

## Features

- **Automatic layout detection**: reads the layout definition (xz-compressed vial.json) and keymap from the connected keyboard over WebHID (the Vial protocol); works with both QMK (Vial) and RMK firmware
- **File loading**: also supports drag-and-drop of `vial.json` (layout) and `.vil` (keymap) files
- **4 modes**: English words/sentences / Japanese romaji (both Hepburn and Kunrei styles) / symbols & layers / mixed
- **Sushida-style scoring**: choose 30/60/90 seconds, +1 second bonus every 30-combo, overall score and rank
- **Customizable input guidance**: Shift-first vs. layer-first, fixed layer for numbers/symbols, dimmed display of the second candidate
- **Sound effects**: keystroke, combo, and miss sounds (toggleable)

## Usage

Open it in a browser (Chrome/Edge recommended; WebHID required) and just click "Read from keyboard."
The macOS app (below) works the same way.

## Development

Vite + React + TypeScript. Source lives under `src/`, with logic and state in `src/lib/`
and UI in `src/components/` (see `docs/app-overview.md` for the overall picture).

```sh
npm install
npm run dev     # dev server (or `make run`)
npm run build   # typecheck + build into dist/
npm run test    # Playwright tests (builds then runs)
npm run lint    # Biome
```

### macOS app (Tauri)

The same frontend can be wrapped with Tauri into a .app (`src-tauri/`). Since WKWebView doesn't
support WebHID, HID access is implemented on the Rust (hidapi) side only, and the web/Tauri
transport is switched at runtime. Requires the Rust toolchain.

```sh
npm run tauri:dev     # run the app in development
npm run tauri:build   # build .app / .dmg
```

## License

The original [Vial Typing](https://github.com/shakushakupanda/vial-typing) is licensed under the [MIT License](LICENSE).

This modified version of Vial Typing is licensed under the [MIT License](LICENSE).
The changes are made with havily using Claude Code Fable 5 and Opus 4.8.

Some of the word lists used for practice (part of `data/en_words.json` and `data/jp_words.json`) are generated from the frequency-ordered word data of [keybr.com](https://github.com/aradzie/keybr.com), which are licensed under the [AGPL-3.0](LICENSE).

The unlock algorithm for the key-mastery mode is also based on [keybr.com](https://github.com/aradzie/keybr.com)'s guided lesson, which are also licensed under the [AGPL-3.0](LICENSE).
