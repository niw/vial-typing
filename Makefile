.DEFAULT_GOAL := run

PORT ?= 3000

.PHONY: run
run:
	npm run dev -- --port $(PORT)

.PHONY: build
build:
	npm run build
