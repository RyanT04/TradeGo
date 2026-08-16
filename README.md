# TradeGo

A high-performance cryptocurrency trading simulator built with **Go**, designed to let users practise trading with real-time market data and zero financial risk.

**Live:** [trade-go.tech](https://trade-go.tech)

---

## What is TradeGo?

TradeGo pairs live Bybit market data with a virtual portfolio, so users can experiment with trading strategies without risking real money. Every trade reports its execution latency in microseconds, making the system observable and measurable.

TradeGo is one half of a comparative study. Its counterpart, [TradeX](https://github.com/RyanT04/TradeX), implements the same features on a Next.js + Supabase + Vercel stack. The two are compared in a BEng Software Engineering dissertation at the University of Southampton.

## Features

- **400+ USDT trading pairs** — 20 via WebSocket (sub-second updates), the rest via REST polling (5s interval)
- **Spot trading** — buy and sell against live Bybit prices with a virtual balance
- **Leveraged trading** — 2x to 50x, LONG or SHORT, with automatic liquidation
- **Transactional correctness** — balance checks and writes happen inside a single transaction under row-level locking, so concurrent orders cannot overdraw an account
- **Per-trade latency** — every trade response includes execution time in µs
- **Live charts** — candlestick charts with configurable intervals (1m to 1M)
- **Portfolio tracking** — total value, holdings, open positions, PnL, trade history
- **Email verification and password reset** — transactional email via Resend
- **AI assistant** — chatbot for trading education and app help
- **Mobile responsive** — hamburger sidebar, card layouts, stacked trade panel on small screens
- **Welcome tutorial** — one-time onboarding modal with option to replay from Settings
- **Portfolio reset** — start over with a fresh balance
- **Favourites** — pin coins for quick access
- **Custom domain + HTTPS** — Nginx reverse proxy with Let's Encrypt TLS

## Tech Stack

### Backend
- **Go 1.25** — Gin HTTP framework, pgx PostgreSQL driver, gorilla/websocket
- **Authentication** — bcrypt password hashing, signed JWTs, email verification, password reset
- **Matching engine** — in-process, sub-millisecond trade execution; balance and holdings checks run inside the same transaction as the write, with `SELECT ... FOR UPDATE` on the affected row
- **Background workers** — Bybit WebSocket consumer, REST poller, liquidation worker (all goroutines)
- **Email** — Resend HTTP API, with a dev mode that logs instead of sending when no API key is set

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** — dark theme, responsive breakpoints at `lg` (1024px)
- **lightweight-charts** — TradingView candlestick charts
- **react-router-dom** — SPA with public hero/about pages and protected app routes

### Infrastructure
- **DigitalOcean droplet** — Ubuntu 24.04, single VM
- **Docker Compose** — Go service and containerised PostgreSQL 15 on a private Docker network
- **Nginx** — reverse proxy, HTTP→HTTPS redirect
- **Let's Encrypt** — TLS certificates for `trade-go.tech` and `www.trade-go.tech`, auto-renewed
- **GitHub Actions** — CI/CD; every push is built, vetted, formatted-checked, and tested under the race detector before deploying
- **Docker** — 3-stage build (Node → Go → Alpine runtime), frontend embedded via `go:embed`

Previously deployed on AWS (ECS Fargate, RDS, Application Load Balancer, provisioned with AWS CDK). The stack was migrated to a self-managed droplet to cut running costs; the CDK definitions remain in `infrastructure/` as a record of that architecture.

## Testing

The matching engine is covered by table-driven unit tests and concurrency tests that run under Go's race detector:

```bash
go test ./... -race
```

Coverage includes order invariants (no fill without sufficient balance, no negative balances, no double-refund when a position is liquidated and closed concurrently), leverage and liquidation arithmetic, input validation, and a regression test that fires 50 concurrent buys at a fixed balance to assert no overdraft.

The engine depends on `Store` and `PriceSource` interfaces rather than concrete types, so tests run against in-memory fakes without a database or a live market connection.

## CI/CD

`.github/workflows/cicd.yml` runs on every push and pull request:

1. `go build ./...`
2. `go vet ./...`
3. `gofmt` check (fails on unformatted files)
4. `go test ./... -race`

On a green build against `main`, the workflow SSHes to the droplet, pulls the new commit, rebuilds the Compose stack, and polls `/health` until the service responds — failing the deploy with container logs if it doesn't come up.

## Architecture

```
Browser
   │
   ▼
Nginx (HTTPS :443, Let's Encrypt)
   │
   ▼
Docker Compose
┌──────────────────────────────┐
│  Go binary (Gin)             │
│  ├── /api/* REST routes      │
│  ├── SPA static fallback     │
│  Background goroutines       │
│  ├── Bybit WS consumer       │
│  ├── REST poller (5s)        │
│  └── Liquidation worker (2s) │
└──────┬───────────────┬───────┘
       │               │
       ▼               ▼
  PostgreSQL 15   Bybit V5 API
 (private network)
```

The frontend React bundle is embedded into the Go binary at compile time using Go's `embed` directive, producing a single self-contained executable that serves both the API and the static assets.

## Getting Started

### Prerequisites

- Go 1.25+
- Node.js 20+
- Docker + Docker Compose

### Local Development

```bash
# Clone the repo
git clone https://github.com/RyanT04/TradeGo.git
cd TradeGo

# Create a .env file at the repo root (see Environment Variables below)

# Start the backend + database
docker compose --env-file .env -f deployments/docker-compose.yml up --build -d

# Wait ~30s for the database to initialise, then open:
# http://localhost:8080
```

The Docker Compose setup runs PostgreSQL and the Go backend together. The schema is applied automatically on first startup.

Note the `--env-file .env` flag: the Compose file lives in `deployments/`, so without it the variable substitutions resolve to empty strings and the backend cannot authenticate against the database.

### Environment Variables

| Variable | Description | Required |
|---|---|---|
| `PORT` | HTTP server port | no (defaults to `8080`) |
| `POSTGRES_PASSWORD` | Password for the Postgres container | yes |
| `DATABASE_URL` | PostgreSQL connection string | yes |
| `JWT_SECRET` | JWT signing key | yes |
| `BASE_URL` | Public URL used in email links | yes in production |
| `RESEND_API_KEY` | Resend API key; emails are logged instead of sent when unset | no |
| `EMAIL_FROM` | Sender address, e.g. `TradeGo <noreply@trade-go.tech>` | no |
| `CLAUDE_API_KEY` | API key for the chatbot | no |

### Deployment

Pushes to `main` deploy automatically via GitHub Actions once tests pass. The workflow needs three repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_SSH_KEY`.

To deploy manually on the droplet:

```bash
cd /root/TradeGo
git pull
docker compose --env-file .env -f deployments/docker-compose.yml up -d --build
```

## Project Structure

```
TradeGo/
├── cmd/server/main.go              # Entry point
├── internal/
│   ├── auth/                       # JWT + bcrypt + middleware
│   ├── config/                     # Environment config
│   ├── database/                   # PostgreSQL connection, schema, transactional writes
│   ├── email/                      # Resend client
│   ├── handler/                    # HTTP handlers (auth, market, order, chat, portfolio, favourites)
│   ├── market/bybit.go             # WebSocket + REST market data
│   ├── matching/                   # Trade engine, leveraged positions, liquidation, tests
│   ├── middleware/                 # Logger, CORS
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
│   └── lib/infrastructure-stack.ts # Former AWS CDK stack (retained for reference)
├── deployments/
│   └── docker-compose.yml          # Compose stack
├── benchmark/
│   ├── quick_benchmark.py          # Latency benchmark script
│   └── results/                    # Charts + raw data
├── .github/workflows/cicd.yml      # CI/CD pipeline
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
| Concurrency control | Row-level locking inside transactions | Delegated to Supabase |
| Hosting | DigitalOcean droplet (Docker Compose) | Vercel (serverless) |
| Latency instrumentation | Per-trade µs reporting | None |
| Automated tests | Unit + concurrency tests under `-race` | None |
| Deploy | GitHub Actions → SSH → Compose rebuild | `git push` |

The architectural asymmetry, where TradeX has no server-side API surface, is itself a finding of the dissertation. See the report for full analysis.

## Author

**Ryan Tang** — BEng Software Engineering, University of Southampton

- Portfolio: [ryantang.dev](https://ryantang.dev)
- GitHub: [@RyanT04](https://github.com/RyanT04)
- Email: contact@ryantang.dev

## License

This project was developed as part of a university dissertation. All rights reserved.
