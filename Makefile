GO ?= go
BIN ?= app
OUTDIR ?= bin
WEB_DIR ?= web
CGO_ENABLED ?= 0
REMOTE ?= dev
REMOTE_PATH ?= /opt/auto-xhs
SERVICE ?= auto-xhs

.PHONY: build build-web build-linux build-linux-arm64 build-all dev test vet web-lint web-build deploy

build: build-web
	@mkdir -p $(OUTDIR)
	CGO_ENABLED=$(CGO_ENABLED) $(GO) build -tags embed -o $(OUTDIR)/$(BIN) ./cmd/auto-xhs

build-linux: build-web
	@mkdir -p $(OUTDIR)
	GOOS=linux GOARCH=amd64 CGO_ENABLED=$(CGO_ENABLED) $(GO) build -tags embed -o $(OUTDIR)/$(BIN)-linux-amd64 ./cmd/auto-xhs

build-linux-arm64: build-web
	@mkdir -p $(OUTDIR)
	GOOS=linux GOARCH=arm64 CGO_ENABLED=$(CGO_ENABLED) $(GO) build -tags embed -o $(OUTDIR)/$(BIN)-linux-arm64 ./cmd/auto-xhs

build-all: build build-linux build-linux-arm64

build-web:
	cd $(WEB_DIR) && npm install && npm run build

dev:
	$(GO) run ./cmd/auto-xhs

test:
	$(GO) test ./...

vet:
	$(GO) vet ./...

web-lint:
	cd $(WEB_DIR) && npm run lint

web-build:
	cd $(WEB_DIR) && npm run build

deploy: build-linux
	ssh $(REMOTE) "systemctl stop $(SERVICE) || true"
	ssh $(REMOTE) "mkdir -p $(REMOTE_PATH) && mkdir -p $(REMOTE_PATH)/var/db"
	scp $(OUTDIR)/$(BIN)-linux-amd64 $(REMOTE):$(REMOTE_PATH)/$(BIN)
	scp $(SERVICE).service $(REMOTE):/etc/systemd/system/
	ssh $(REMOTE) "systemctl daemon-reload && systemctl enable $(SERVICE) && systemctl start $(SERVICE)"
