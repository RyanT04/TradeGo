import { Link } from 'react-router-dom'

const techStack = [
  { tag: 'Backend', items: ['Go 1.25', 'Gin HTTP', 'pgx (PostgreSQL)', 'gorilla/websocket', 'JWT + bcrypt'] },
  { tag: 'Frontend', items: ['React 18', 'TypeScript', 'Vite', 'Tailwind CSS', 'lightweight-charts'] },
  { tag: 'Infrastructure', items: ['AWS ECS Fargate', 'AWS RDS PostgreSQL', 'AWS CDK (TypeScript)', 'Application Load Balancer', 'Secrets Manager + CloudWatch'] },
  { tag: 'Market data', items: ['Bybit V5 WebSocket', '20 USDT pairs streamed live', 'In-memory ticker cache', 'Tick-by-tick candle updates'] },
]

const features = [
  { title: 'Multi-step onboarding', body: 'Account creation flows into a profile setup (avatar + username) and a starting balance picker.' },
  { title: 'Spot trading', body: 'Standard buy/sell against live Bybit prices. Holdings tracked per symbol with average buy price and live PnL.' },
  { title: 'Leveraged positions', body: '2x–50x long or short positions with isolated margin and a background liquidation worker that runs every two seconds.' },
  { title: 'Per-trade latency', body: 'Every trade returns execution latency in microseconds. The frontend renders min, max, and average across the live session.' },
  { title: 'Persistent state', body: 'PostgreSQL stores users, holdings, trades, orders, leveraged positions, and favourites. Schema migrations run automatically on container start.' },
  { title: 'Cloud deployment', body: 'A single `cdk deploy` provisions the entire stack: VPC with private subnets, RDS, Fargate service, ALB, secrets, and logs.' },
]

const steps = [
  { n: '01', title: 'Sign up', body: 'Create an account with an email and password. Pick an avatar, a username, and a starting virtual balance.' },
  { n: '02', title: 'Browse markets', body: 'Live prices stream over WebSocket. Add coins to your favourites for quick access from anywhere in the app.' },
  { n: '03', title: 'Trade', body: 'Spot or leveraged. Both modes share a unified UI with the chart, the order panel, and live position tracking.' },
  { n: '04', title: 'Measure', body: 'Every trade reports its end-to-end latency. Use the performance card to compare averages across runs.' },
]

export function AboutView() {
  return (
    <>
      {/* Intro */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16">
        <div className="text-xs text-emerald-400 mb-3 uppercase tracking-wider">About</div>
        <h1 className="text-4xl font-bold mb-6">What is TradeGo?</h1>
        <p className="text-gray-400 text-lg leading-relaxed mb-4">
          TradeGo is a cryptocurrency trading simulator that pairs live Bybit market data with a virtual portfolio,
          so users can practice trading strategies without risking real money.
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

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">How it works</h2>
        <div className="space-y-4">
          {steps.map(s => (
            <div key={s.n} className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-6 flex gap-5 items-start">
              <div className="text-3xl font-bold text-emerald-400/30 font-mono shrink-0">{s.n}</div>
              <div>
                <h3 className="text-base font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
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
           AWS RDS (PG)    Bybit V5 WS
            (private VNet) (live prices)`}</pre>
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