# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
# Build for production (outputs to /frontend/dist)
RUN npm run build

# Stage 2: Build the Go backend, with the frontend build embedded
FROM golang:1.25-alpine AS backend-builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Copy frontend build output into the Go module so it can be embedded
COPY --from=frontend-builder /frontend/dist ./internal/server/static

RUN go build -o tradego ./cmd/server

# Stage 3: Final runtime image
FROM alpine:latest

WORKDIR /app
COPY --from=backend-builder /app/tradego .
EXPOSE 8080

CMD ["./tradego"]