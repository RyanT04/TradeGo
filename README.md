# TradeGo

A high-performance cryptocurrency trading simulator built with **Go** and **AWS**, designed to let users practise trading with real-time market data and zero financial risk.

**Live:** [trade-go.tech](https://trade-go.tech) ·

---

## What is TradeGo?

TradeGo pairs live Bybit market data with a virtual portfolio, so users can experiment with trading strategies without risking real money. Every trade reports its execution latency in microseconds, making the system observable and measurable.

TradeGo is one half of a comparative study. Its counterpart, [TradeX](https://github.com/RyanT04/TradeX), implements the same features on a Next.js + Supabase + Vercel stack. The two are compared in a BEng Software Engineering dissertation at the University of Southampton.

## Features

- **460+ USDT trading pairs** — 20 via WebSocket (sub-second updates), 440+ via REST polling (5s interval)
- **Spot trading** — buy and sell against live Bybit prices with a virtual balance
- **Leveraged trading** — 2x to 50x, LONG or SHORT, with automatic liquidation
- **Per-trade latency** — every trade response includes execution time in µs
- **Live charts** — candlestick charts with configurable intervals (1m to 1M)
- **Portfolio tracking** — total value, holdings, open positions, PnL, trade history
- **AI assistant** — Gemini-powered chatbot for trading education and app help
- **Mobile responsive** — hamburger sidebar, card layouts, stacked trade panel on small screens
- **Welcome tutorial** — one-time onboarding modal with option to replay from Settings
- **Portfolio reset** — start over with a fresh balance ($1–$100M), limited to 3 resets per day
- **Favourites** — pin coins for quick access
- **Custom domain + HTTPS** — served via AWS ALB with ACM certificate

## Tech Stack

### Backend
- **Go 1.25** — Gin HTTP framework, pgx PostgreSQL driver, gorilla/websocket
- **Authentication** — bcrypt password hashing, signed JWTs
- **Matching engine** — in-process, sub-millisecond trade execution with database transactions
- **Background workers** — Bybit WebSocket consumer, REST poller, liquidation worker (all goroutines)
- **AI chat** — Gemini API proxy with system prompt for trading education

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** — dark theme, responsive breakpoints at `lg` (1024px)
- **lightweight-charts** — TradingView candlestick charts
- **react-router-dom** — SPA with public hero/about pages and protected app routes

### Infrastructure
- **AWS ECS Fargate** — serverless containers, 0.25 vCPU / 512 MB
- **AWS RDS PostgreSQL 15** — private VPC subnet, db.t3.micro
- **AWS Application Load Balancer** — HTTPS on port 443, HTTP→HTTPS redirect
- **AWS CDK (TypeScript)** — entire stack defined as infrastructure-as-code
- **AWS Certificate Manager** — TLS certs for `trade-go.tech` and `tradego.ryantang.dev`
- **AWS Secrets Manager** — database credentials and JWT signing key
- **Docker** — 3-stage build (Node → Go → Alpine runtime), frontend embedded via `go:embed`

## Architecture

```
Browser
   │
   ▼
AWS ALB (HTTPS :443)
   │
   ▼
ECS Fargate (Go binary)
┌──────────────────────────────┐
│  Gin HTTP server             │
│  ├── /api/* REST routes      │
│  ├── SPA static fallback     │
│  Background goroutines       │
│  ├── Bybit WS consumer       │
│  ├── REST poller (5s)        │
│  └── Liquidation worker (2s) │
└──────┬───────────────┬───────┘
       │               │
       ▼               ▼
   AWS RDS PG     Bybit V5 API
```

The frontend React bundle is embedded into the Go binary at compile time using Go's `embed` directive, producing a single self-contained executable that serves both the API and the static assets.

## Getting Started

### Prerequisites

- Go 1.25+
- Node.js 20+
- Docker + Docker Compose
- AWS CLI + CDK (for deployment only)

### Local Development

```bash
# Clone the repo
git clone https://github.com/RyanT04/TradeGo.git
cd TradeGo

# Start the backend + database
docker compose -f deployments/docker-compose.yml up --build -d

# Wait ~30s for the database to initialise, then open:
# http://localhost:8080
```

The Docker Compose setup runs PostgreSQL and the Go backend together. The schema is applied automatically on first startup.

### Environment Variables

| Variable | Description | Default (dev) |
|---|---|---|
| `PORT` | HTTP server port | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | set in docker-compose |
| `JWT_SECRET` | JWT signing key | `tradego-dev-secret` |
| `GEMINI_API_KEY` | Google Gemini API key (for chatbot) | optional |

### Deploy to AWS

```bash
cd infrastructure
npm install
cdk deploy
```

This provisions the full stack (VPC, RDS, Fargate, ALB, ACM, Secrets Manager, CloudWatch) in `eu-west-2`. After deployment, add CNAME records at your domain registrar pointing to the ALB hostname shown in the CDK output.

## Project Structure

```
TradeGo/
├── cmd/server/main.go              # Entry point
├── internal/
│   ├── auth/                       # JWT + bcrypt + middleware
│   ├── config/                     # Environment config
│   ├── database/                   # PostgreSQL connection + schema
│   ├── handler/                    # HTTP handlers (auth, market, order, chat, portfolio, favourites)
│   ├── market/bybit.go             # WebSocket + REST market data
│   ├── matching/                   # Trade engine + leveraged positions + liquidation
│   ├── middleware/                  # Logger, CORS
│   ├── models/                     # Data types
│   └── server/                     # Router setup + static file serving
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Routes + state management
│   │   ├── auth/AuthScreen.tsx     # Login / register / onboarding
│   │   ├── components/             # Sidebar, Chart, ChatBubble, WelcomeModal, etc.
│   │   └── views/                  # Trade, Markets, Portfolio, Settings, Hero, About
│   └── index.html
├── infrastructure/
│   └── lib/infrastructure-stack.ts # AWS CDK stack definition
├── deployments/
│   └── docker-compose.yml          # Local dev environment
├── benchmark/
│   ├── quick_benchmark.py          # Latency benchmark script
│   └── results/                    # Charts + raw data
└── Dockerfile                      # 3-stage build
```

## Benchmark

```bash
cd benchmark
python3 -m venv .venv
source .venv/bin/activate
pip install aiohttp matplotlib numpy
python3 quick_benchmark.py
```

Produces latency distribution charts in `benchmark/results/`. See the [benchmark README](benchmark/README.md) for methodology details.

## Comparison with TradeX

| | TradeGo | TradeX |
|---|---|---|
| Backend | Go (Gin) | None (client-side) |
| Database | PostgreSQL via pgx | Supabase (managed PG) |
| Auth | Bespoke JWT + bcrypt | Supabase Auth |
| Trade execution | Server-side matching engine | Browser-side JS + Supabase RPC |
| Hosting | AWS ECS Fargate | Vercel (serverless) |
| Infrastructure | AWS CDK (IaC) | Vercel dashboard |
| Latency instrumentation | Per-trade µs reporting | None |
| Deploy command | `cdk deploy` | `git push` |

The architectural asymmetry — TradeX has no server-side API surface — is itself a finding of the dissertation. See the report for full analysis.

## Author

**Ryan Tang** — BEng Software Engineering, University of Southampton

- GitHub: [@RyanT04](https://github.com/RyanT04)
- Email: rklt1e22@soton.ac.uk

## License

This project was developed as part of a university dissertation. All rights reserved.
