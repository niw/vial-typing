.DEFAULT_GOAL := run

PORT ?= 3000

.PHONY: run
run:
	npm run dev -- --port $(PORT)

.PHONY: build
build:
	npm run build

# Run the macOS app (Tauri) in development
.PHONY: tauri-dev
tauri-dev:
	npm run tauri:dev

# Build the macOS app (.app / .dmg)
.PHONY: tauri-build
tauri-build:
	npm run tauri:build

# Remove all untracked and ignored files (node_modules, dist/, src-tauri/target/, etc.)
.PHONY: clean
clean:
	git clean -dffx
