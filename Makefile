.DEFAULT_GOAL := run

PORT ?= 3000

.PHONY: run
run:
	npm run dev -- --port $(PORT)

.PHONY: build
build:
	npm run build

# macOSアプリ (Tauri) を開発起動する
.PHONY: tauri-dev
tauri-dev:
	npm run tauri:dev

# macOSアプリ (.app / .dmg) をビルドする
.PHONY: tauri-build
tauri-build:
	npm run tauri:build
