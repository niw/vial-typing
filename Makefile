.DEFAULT_GOAL := run

PORT ?= 3000

.PHONY: run
run:
	python3 -m http.server $(PORT)
