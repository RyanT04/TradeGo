import { Link } from 'react-router-dom'

const stats = [
  { value: '20', label: 'Live coins' },
  { value: '~10ms', label: 'Trade execution' },
  { value: '50x', label: 'Max leverage' },
  { value: 'Go', label: 'Backend' },
  { value: 'AWS', label: 'Fargate + RDS' },
]

const features = [
  {
    title: 'Compiled Go backend',
    body: 'Concurrent goroutines and a tight matching engine deliver consistent trade execution well under 20ms — measured on every order.',
  },
  {
    title: 'Live WebSocket prices',
    body: 'Real-time ticker stream from Bybit, no polling. The same price your chart shows is the price your trade fills at.',
  },
  {
    title: 'Spot + leveraged trading',
    body: 'Buy and hold like a normal exchange, or open 2x–50x leveraged positions with automatic liquidation when margin runs out.',
  },
  {
    title: 'AWS production stack',
    body: 'Deployed to ECS Fargate behind an Application Load Balancer with PostgreSQL on RDS. Real cloud infrastructure, not a single VM.',
  },
  {
    title: 'Latency profiling built in',
    body: 'Every trade returns its execution latency in microseconds. Compare backends head-to-head with measurements you can trust.',
  },
  {
    title: 'Zero financial risk',
    body: 'Virtual portfolio with virtual money. Practice strategies, learn the mechanics, build intuition — all without losing a cent.',
  },
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
          TradeGo is a high-performance crypto trading simulator built in Go and deployed on AWS.
          Production stack, microsecond latency profiling, zero risk.
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

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-bold mb-3 text-center">Built for performance</h2>
        <p className="text-gray-500 text-center mb-12">Every component chosen and benchmarked for low latency and high throughput.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-6">
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-3xl font-bold mb-3">Ready to trade?</h2>
        <p className="text-gray-500 mb-8">Create a free account and start practicing with virtual funds. No credit card. No fees. No risk.</p>
        <Link to="/login" className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
          Get started for free
        </Link>
      </section>
    </>
  )
}