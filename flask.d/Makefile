SHELL := /bin/bash -o pipefail
func ?= GetStatisticalDataForDailyReport

.PHONY: build
build:
	docker build -t flask-app:latest .

.PHONY: run
run: build
	docker run -p 9999:80 flask-app:latest
