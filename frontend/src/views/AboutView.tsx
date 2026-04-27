import { Link } from 'react-router-dom'

const techStack = [
  { tag: 'Backend', items: ['Go 1.25', 'Gin HTTP', 'pgx (PostgreSQL)', 'gorilla/websocket', 'JWT + bcrypt'] },
  { tag: 'Frontend', items: ['React 18', 'TypeScript', 'Vite', 'Tailwind CSS', 'lightweight-charts', 'react-router-dom'] },
  { tag: 'Infrastructure', items: ['AWS ECS Fargate', 'AWS RDS PostgreSQL', 'AWS CDK (TypeScript)', 'Application Load Balancer', 'Secrets Manager + CloudWatch'] },
  { tag: 'Market data', items: ['Bybit V5 WebSocket', 'Bybit V5 REST', '460+ USDT pairs', 'In-memory ticker cache', 'Tick-by-tick candle updates'] },
]

const features = [
  { title: 'Multi-step onboarding', body: 'Account creation flows into a profile setup (avatar + username) and a starting balance picker.' },
  { title: 'Spot trading', body: 'Standard buy/sell against live Bybit prices. Holdings tracked per symbol with average buy price and live PnL.' },
  { title: 'Leveraged positions', body: '2x–50x long or short positions with isolated margin and a background liquidation worker that runs every two seconds.' },
  { title: 'Per-trade latency', body: 'Every trade returns execution latency in microseconds. The frontend renders min, max, and average across the live session.' },
  { title: 'Persistent state', body: 'PostgreSQL stores users, holdings, trades, orders, leveraged positions, and favourites. Schema migrations run automatically on container start.' },
  { title: 'Cloud deployment', body: 'A single `cdk deploy` provisions the entire stack: VPC with private subnets, RDS, Fargate service, ALB, secrets, and logs.' },
  { title: 'Hot + cold market data', body: '20 active coins streamed via WebSocket for sub-second updates, the remaining 440+ via REST polling every 5 seconds.' },
  { title: 'Portfolio reset', body: 'Blow up your account? One click in Settings rolls everything back with a fresh balance of your choice.' },
]

const faqs = [
  {
    q: 'Is this real money?',
    a: 'No. TradeGo uses a virtual portfolio with virtual money. You can\'t deposit, withdraw, or lose anything real. The market data is live, but every trade you place is simulated.',
  },
  {
    q: 'How accurate are the prices?',
    a: 'Prices come straight from Bybit\'s public market data. Twenty popular coins (BTC, ETH, SOL, etc.) update tick-by-tick over a WebSocket connection. The remaining 440+ USDT pairs refresh every 5 seconds via REST polling. Trade fills use the most recent cached price, the same one shown on your chart.',
  },
  {
    q: 'What does "trade latency" mean?',
    a: 'It\'s the time the backend takes to process a single order — from receiving the request, through validation, through writing to the database, to returning a response. Measured in microseconds and reported in the trade log. It\'s a measure of how fast the engine is, not how fresh the prices are.',
  },
  {
    q: 'Why Go?',
    a: 'Go compiles to a single static binary, runs cheaply in containers, and handles concurrency through goroutines instead of threads or callbacks. The matching engine, the WebSocket relay, and the liquidation worker all run in parallel inside one process with very little overhead.',
  },
  {
    q: 'What happens when I lose all my money?',
    a: 'You can reset your portfolio at any time from Settings. Pick a new starting balance (anything from $1 to $1M), choose whether to also clear your trade history, and you\'re back in the game. There\'s no penalty for going to zero.',
  },
  {
    q: 'Can I trade fractions of a coin?',
    a: 'Yes. The order panel accepts any positive number — you can buy 0.001 BTC, 0.5 ETH, 100 DOGE, whatever fits your balance. The same goes for leveraged positions, where you specify margin in USD rather than coin quantity.',
  },
  {
    q: 'How does liquidation work?',
    a: 'Leveraged positions have a liquidation price calculated at entry. A background worker checks open positions every two seconds against the latest market price. If the price crosses the liquidation level, the position is automatically closed and your margin is forfeited — exactly like a real exchange would do.',
  },
  {
    q: 'Is my data safe?',
    a: 'Passwords are hashed with bcrypt before storage. Authentication uses signed JWTs. The database lives inside a private VPC subnet on AWS, only reachable by the application container. Connections to the database use credentials stored in AWS Secrets Manager, never in code.',
  },
]

export function AboutView() {
  return (
    <>
      {/* Intro */}
      <section className="max-w-3xl mx-auto px-6 pt-12 lg:pt-20 pb-16">
        <div className="text-xs text-emerald-400 mb-3 uppercase tracking-wider">About</div>
        <h1 className="text-4xl font-bold mb-6">What is TradeGo?</h1>
        <p className="text-gray-400 text-lg leading-relaxed mb-4">
          TradeGo is a cryptocurrency trading simulator that pairs live Bybit market data with a virtual portfolio,
          so users can practise trading strategies without risking real money.
        </p>
        <p className="text-gray-400 text-lg leading-relaxed">
          Under the hood, it's a high-performance Go backend deployed on AWS — designed for low-latency trade execution
          and built to be measured. Every trade reports its end-to-end latency, every metric is observable, every component
          chosen for predictable performance.
        </p>
      </section>

      {/* Performance focus */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-6">Why Go and AWS?</h2>
        <div className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-6 space-y-4 text-gray-400 leading-relaxed">
          <p>
            Most modern web apps run on JavaScript-first stacks chosen for developer speed.
            That works — but at scale, runtime overhead, cold starts, and request multiplexing all start to matter.
          </p>
          <p>
            TradeGo takes the opposite approach. The backend is a compiled Go binary running in a single Fargate task.
            Goroutines handle concurrent traders, the matching engine runs in-process, and a long-lived WebSocket
            keeps prices fresh in memory. PostgreSQL on RDS handles persistence, with the schema applied automatically
            on container start.
          </p>
          <p>
            The result: simple deployment, predictable latency, and full observability through CloudWatch logs.
          </p>
        </div>
      </section>

      {/* Tech stack */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">Tech stack</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {techStack.map(s => (
            <div key={s.tag} className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-6">
              <div className="text-xs text-emerald-400 mb-3 uppercase tracking-wider">{s.tag}</div>
              <ul className="space-y-1.5">
                {s.items.map(item => (
                  <li key={item} className="text-sm text-gray-300 flex items-center gap-2">
                    <span className="text-gray-700">→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-2">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture diagram */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-6">Architecture</h2>
        <div className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-6 font-mono text-xs text-gray-400 leading-relaxed overflow-x-auto">
          <pre>{`Browser ─→ AWS ALB (HTTP)
            │
            ▼
         ECS Fargate
        ┌────────────────────────────────┐
        │  Go server (Gin)               │
        │  ├─ JWT auth + bcrypt          │
        │  ├─ HTTP handlers              │
        │  ├─ Matching engine            │
        │  └─ Background workers         │
        │      (liquidation, ticker)     │
        └─────────┬─────────────┬────────┘
                  │             │
                  ▼             ▼
           AWS RDS (PG)    Bybit V5 WS+REST
            (private VNet) (live prices)`}</pre>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-6">Frequently asked questions</h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details key={i} className="bg-[#12121a] border border-[#1a1a25] rounded-xl group">
              <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-gray-200 flex items-center justify-between hover:text-white transition list-none">
                {f.q}
                <span className="text-gray-600 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
              </summary>
              <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold mb-3">Try it for yourself</h2>
        <p className="text-gray-500 mb-6">Spin up an account, fund it with virtual money, and place a few trades.</p>
        <Link to="/login" className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
          Get started
        </Link>
      </section>
    </>
  )
}