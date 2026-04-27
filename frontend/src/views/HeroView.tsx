import { Link } from 'react-router-dom'

const stats = [
  { value: '460+', label: 'Trading pairs' },
  { value: '~10ms', label: 'Trade execution' },
  { value: '50x', label: 'Max leverage' },
  { value: '$0', label: 'To get started' },
  { value: '24/7', label: 'Market access' },
]

const features = [
  {
    title: 'Compiled Go backend',
    body: 'Concurrent goroutines and a tight matching engine deliver consistent trade execution well under 20ms — measured on every order.',
  },
  {
    title: 'Live WebSocket prices',
    body: 'Real-time ticker stream from Bybit for the most active coins, plus REST polling for the long tail. The price your chart shows is the price your trade fills at.',
  },
  {
    title: 'Spot + leveraged trading',
    body: 'Buy and hold like a normal exchange, or open 2x–50x long or short positions with automatic liquidation when margin runs out.',
  },
  {
    title: 'AWS production stack',
    body: 'Deployed to ECS Fargate behind an Application Load Balancer with PostgreSQL on RDS. Real cloud infrastructure, not a single VM.',
  },
  {
    title: 'Latency profiling built in',
    body: 'Every trade returns its execution latency in microseconds. Compare runs head-to-head with measurements you can trust.',
  },
  {
    title: 'Zero financial risk',
    body: 'Virtual portfolio with virtual money. Choose your own starting balance, reset whenever you want, and trade as much as you like.',
  },
]

const steps = [
  {
    n: '01',
    title: 'Sign up in 30 seconds',
    body: 'Email and password. Pick an avatar, a username, and the virtual balance you want to start with — $1k, $10k, $100k, or anything in between.',
  },
  {
    n: '02',
    title: 'Pick a coin',
    body: 'Browse 460+ USDT pairs sorted by 24h volume. Star your favourites. Switch between tickers from the trade view in one click.',
  },
  {
    n: '03',
    title: 'Place trades',
    body: 'Spot or leveraged. Watch the live chart, set your size, and hit buy. Every order returns its execution latency in microseconds.',
  },
  {
    n: '04',
    title: 'Track and refine',
    body: 'Your portfolio page shows total value, holdings PnL, open positions, and trade history. Reset and start over whenever a strategy goes sideways.',
  },
]

const techBadges = [
  { name: 'Go', desc: 'Backend language' },
  { name: 'AWS', desc: 'Fargate + RDS' },
  { name: 'PostgreSQL', desc: 'Database' },
  { name: 'React', desc: 'Frontend' },
  { name: 'Bybit', desc: 'Market data' },
]

const comparison = [
  { aspect: 'Live market prices', tradeGo: true, exchange: true },
  { aspect: 'Real money required', tradeGo: false, exchange: true },
  { aspect: 'Trading fees', tradeGo: false, exchange: true },
  { aspect: 'KYC / identity check', tradeGo: false, exchange: true },
  { aspect: 'Spot trading', tradeGo: true, exchange: true },
  { aspect: 'Leverage up to 50x', tradeGo: true, exchange: true },
  { aspect: 'Reset and start over', tradeGo: true, exchange: false },
  { aspect: 'Per-trade latency stats', tradeGo: true, exchange: false },
]

export function HeroView() {
  return (
    <>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight">
          Crypto trading at <span className="text-emerald-400">Go speed</span>.
        </h1>
        <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">
          A high-performance crypto trading simulator built in Go and deployed on AWS.
          460+ live coins, microsecond-precision latency profiling, and zero risk to your real money.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link to="/login" className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
            Start trading
          </Link>
          <Link to="/about" className="px-6 py-3 border border-[#1a1a25] hover:border-gray-700 rounded-lg text-sm font-medium transition">
            Learn more →
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-5 text-center">
              <div className="text-2xl font-bold text-emerald-400">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">How it works</h2>
          <p className="text-gray-500">Four steps from sign-up to your first trade.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map(s => (
            <div key={s.n} className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-6 flex gap-5 items-start">
              <div className="text-3xl font-bold text-emerald-400/40 font-mono shrink-0">{s.n}</div>
              <div>
                <h3 className="text-base font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Built for performance</h2>
          <p className="text-gray-500">Every component chosen and benchmarked for low latency and high throughput.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-6">
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TradeGo vs Exchange comparison */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">TradeGo vs a real exchange</h2>
          <p className="text-gray-500">All the experience, none of the risk.</p>
        </div>
        <div className="bg-[#12121a] border border-[#1a1a25] rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 px-5 py-3 border-b border-[#1a1a25] text-xs uppercase tracking-wider text-gray-500">
            <span>Feature</span>
            <span className="text-center text-emerald-400">TradeGo</span>
            <span className="text-center">Real exchange</span>
          </div>
          {comparison.map((row, i) => (
            <div key={i} className={`grid grid-cols-3 px-5 py-3 text-sm ${i !== comparison.length - 1 ? 'border-b border-[#1a1a25]' : ''}`}>
              <span className="text-gray-300">{row.aspect}</span>
              <span className="text-center">
                {row.tradeGo ? <span className="text-emerald-400">✓</span> : <span className="text-gray-700">—</span>}
              </span>
              <span className="text-center">
                {row.exchange ? <span className="text-gray-400">✓</span> : <span className="text-gray-700">—</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Tech badges */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-2">Built on</h2>
          <p className="text-gray-500 text-sm">Production technologies, real infrastructure.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {techBadges.map(t => (
            <div key={t.name} className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-5 text-center">
              <div className="text-base font-semibold text-white">{t.name}</div>
              <div className="text-xs text-gray-600 mt-1">{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-3xl font-bold mb-3">Ready to trade?</h2>
        <p className="text-gray-500 mb-8">
          Create a free account and start practising with virtual funds. No credit card. No fees. No risk.
        </p>
        <Link to="/login" className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
          Get started for free
        </Link>
      </section>
    </>
  )
}