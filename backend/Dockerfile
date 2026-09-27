# Stage 1: Build binary
FROM golang:1.26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o footguard-backend ./cmd

# Stage 2: Minimal runtime image
FROM alpine:3.19

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/footguard-backend .
COPY --from=builder /app/migrations ./migrations

# Buat folder penyimpanan uploads
RUN mkdir -p uploads/original uploads/overlay

EXPOSE 8080

CMD ["./footguard-backend"]
