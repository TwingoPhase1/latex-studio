# ============================================================
# Stage 1: Build Go binary (with embedded web/ assets)
# ============================================================
FROM golang:1.23-alpine AS builder
WORKDIR /src

COPY go.mod ./
COPY main.go ./
COPY internal ./internal
COPY web ./web

RUN go test ./... \
    && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/latex-studio .

# ============================================================
# Stage 2: Minimal Alpine runtime
# ============================================================
FROM alpine:3.21 AS runner
WORKDIR /app

RUN apk add --no-cache ca-certificates wget \
    && addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/data \
    && chown -R app:app /app

COPY --from=builder --chown=app:app /out/latex-studio /app/latex-studio

ENV PORT=8080
ENV DATA_DIR=/app/data

EXPOSE 8080
VOLUME ["/app/data"]

USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1

CMD ["/app/latex-studio"]
