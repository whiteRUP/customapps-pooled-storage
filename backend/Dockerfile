FROM golang:1.21-alpine AS builder

# Install dependencies
RUN apk add --no-cache git gcc musl-dev fuse-dev

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY . .

# Build application
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o pooled-storage .

# Final stage
FROM alpine:latest

# Install rclone and dependencies
RUN apk add --no-cache ca-certificates fuse curl bash && \
    curl https://rclone.org/install.sh | bash

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/pooled-storage .

# Create necessary directories
RUN mkdir -p /app/data /app/config /mnt/pooled-storage

# Expose port
EXPOSE 8080

# Run application
CMD ["./pooled-storage"]
