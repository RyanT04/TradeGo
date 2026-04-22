import { useState, useEffect, useRef, useCallback } from 'react'
import { setToken, clearToken, login, register, getMe, updateProfile, setStartingBalance, getTickers, getBalance, getHoldings, placeOrder, getTrades } from './api'
import axios from 'axios'

interface Ticker {
  symbol: string
  lastPrice: string
  price24hPcnt: string
  highPrice24h: string
  lowPrice24h: string
  volume24h: string
}

interface Holding {
  symbol: string
  quantity: number
  avg_buy_price: number
}

interface TradeLog {
  symbol: string
  side: string
  quantity: number
  price: number
  total: number
  latency_us: number
  timestamp: string
}

const INTERVALS = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
]

function formatNum(n: number, decimals = 2) {
  if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

// ── Auth Screen (multi-step wizard) ──
function AuthScreen({ onComplete }: { onComplete: (token: string) => void }) {
  const [step, setStep] = useState<'auth' | 'profile' | 'balance'>('auth')
  const [token, setLocalToken] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isRegister, setIsRegister] = useState(true)
  const [error, setError] = useState('')

  const [username, setUsername] = useState('')
  const [avatar, setAvatar] = useState('🚀')
  const avatars = ['🚀', '💎', '🔥', '⚡', '🌟', '🦄', '🐸', '🦊', '🐺', '🦁', '🐻', '🐼']

  const [selectedBalance, setSelectedBalance] = useState<number | null>(null)
  const balanceOptions = [
    { value: 1000, label: '$1,000', subtitle: 'Small portfolio' },
    { value: 10000, label: '$10,000', subtitle: 'Balanced (recommended)' },
    { value: 100000, label: '$100,000', subtitle: 'High roller' },
  ]

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      const data = isRegister
        ? await register(email, password)
        : await login(email, password)

      localStorage.setItem('token', data.token)
      setToken(data.token)
      setLocalToken(data.token)

      if (data.user.onboarded) {
        onComplete(data.token)
      } else {
        setStep('profile')
      }
    } catch (err: any) {
      const backendError = err.response?.data?.error
      setError(backendError ? backendError.charAt(0).toUpperCase() + backendError.slice(1) : 'Authentication failed')
    }
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await updateProfile(username, avatar)
      setStep('balance')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile')
    }
  }

  async function handleBalance() {
    if (!selectedBalance) return
    setError('')
    try {
      await setStartingBalance(selectedBalance)
      onComplete(token)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to set balance')
    }
  }

  if (step === 'auth') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Trade<span className="text-emerald-400">Go</span></h1>
            <p className="text-gray-500 text-sm mt-2">High-performance crypto trading simulator</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-3">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
            {isRegister && (
              <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>
          <button onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="mt-4 text-sm text-gray-500 hover:text-gray-300 w-full text-center transition">
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'profile') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="w-full max-w-md px-6">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
            <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
            <div className="h-1.5 w-8 bg-gray-700 rounded-full" />
          </div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Set up your profile</h2>
            <p className="text-gray-500 text-sm mt-1">Choose a username and avatar</p>
          </div>
          <form onSubmit={handleProfile} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-2">Avatar</label>
              <div className="grid grid-cols-6 gap-2">
                {avatars.map(a => (
                  <button type="button" key={a} onClick={() => setAvatar(a)}
                    className={`aspect-square text-2xl rounded-lg border transition ${avatar === a ? 'bg-emerald-500/10 border-emerald-500' : 'bg-[#12121a] border-gray-800 hover:border-gray-700'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">Username</label>
              <input type="text" placeholder="cryptotrader123" value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                minLength={3} maxLength={20} required
                className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
              <p className="text-xs text-gray-600 mt-1">3-20 characters, lowercase, no spaces</p>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
          <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
          <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
        </div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">Choose your starting balance</h2>
          <p className="text-gray-500 text-sm mt-1">This is virtual money for practice trading</p>
        </div>
        <div className="space-y-2">
          {balanceOptions.map(opt => (
            <button key={opt.value} onClick={() => setSelectedBalance(opt.value)}
              className={`w-full p-4 rounded-lg border text-left transition ${selectedBalance === opt.value ? 'bg-emerald-500/10 border-emerald-500' : 'bg-[#12121a] border-gray-800 hover:border-gray-700'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-bold">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.subtitle}</div>
                </div>
                {selectedBalance === opt.value && (
                  <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-black" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        <button onClick={handleBalance} disabled={!selectedBalance}
          className="w-full mt-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition">
          Start Trading
        </button>
      </div>
    </div>
  )
}

// ── Chart Component ──
function Chart({ symbol, interval, ticker }: { symbol: string; interval: string; ticker?: Ticker }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const lastCandleRef = useRef<any>(null)

  const loadChart = useCallback(async () => {
    if (!containerRef.current) return

    const { createChart, CandlestickSeries } = await import('lightweight-charts')

    if (chartRef.current) {
      chartRef.current.remove()
    }

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0a0a0f' }, textColor: '#6b7280' },
      grid: { vertLines: { color: '#1a1a25' }, horzLines: { color: '#1a1a25' } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: '#1a1a25' },
      timeScale: { borderColor: '#1a1a25', timeVisible: true },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    seriesRef.current = series

    try {
      const { data } = await axios.get(`/api/kline?symbol=${symbol}&interval=${interval}&limit=200`)
      if (data?.result?.list) {
        const candles = data.result.list
          .map((k: string[]) => ({
            time: parseInt(k[0]) / 1000,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
          }))
          .reverse()
        series.setData(candles)
        chart.timeScale().fitContent()
        if (candles.length > 0) {
          lastCandleRef.current = candles[candles.length - 1]
        }
      }
    } catch {}

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [symbol, interval])

  useEffect(() => { loadChart() }, [loadChart])

  useEffect(() => {
    if (!ticker || !seriesRef.current || !lastCandleRef.current) return

    const price = parseFloat(ticker.lastPrice)
    const now = Math.floor(Date.now() / 1000)

    const intervalMap: Record<string, number> = {
      '1': 60, '5': 300, '15': 900, '60': 3600, '240': 14400, 'D': 86400,
    }
    const secs = intervalMap[interval] || 3600
    const currentBucket = Math.floor(now / secs) * secs

    const lastCandle = lastCandleRef.current

    if (currentBucket > lastCandle.time) {
      const newCandle = { time: currentBucket, open: price, high: price, low: price, close: price }
      seriesRef.current.update(newCandle)
      lastCandleRef.current = newCandle
    } else {
      const updated = {
        ...lastCandle,
        close: price,
        high: Math.max(lastCandle.high, price),
        low: Math.min(lastCandle.low, price),
      }
      seriesRef.current.update(updated)
      lastCandleRef.current = updated
    }
  }, [ticker, interval])

  useEffect(() => {
    return () => { chartRef.current?.remove() }
  }, [])

  return <div ref={containerRef} className="w-full h-[400px]" />
}

// ── Main App ──
function App() {
  const [token, setTokenState] = useState(localStorage.getItem('token') || '')
  const [user, setUser] = useState<{ username?: string; avatar?: string } | null>(null)
  const [tickers, setTickers] = useState<Record<string, Ticker>>({})
  const [balance, setBalance] = useState(0)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [trades, setTrades] = useState<TradeLog[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('60')
  const [tradeQty, setTradeQty] = useState('0.01')
  const [tab, setTab] = useState<'trades' | 'holdings'>('trades')

  useEffect(() => {
    if (token) {
      setToken(token)
      fetchData()
    }
  }, [token])

  useEffect(() => {
    const id = window.setInterval(async () => {
      try { setTickers(await getTickers()) } catch {}
    }, 2000)
    getTickers().then(setTickers).catch(() => {})
    return () => window.clearInterval(id)
  }, [])

  async function fetchData() {
    try {
      const [bal, hold, me, history] = await Promise.all([getBalance(), getHoldings(), getMe(), getTrades()])
      setBalance(bal.balance)
      setHoldings(hold || [])
      setUser(me)
      if (history && history.length > 0) {
        setTrades(history.map((t: any) => ({
          symbol: t.symbol,
          side: t.side,
          quantity: t.quantity,
          price: t.price,
          total: t.total,
          latency_us: 0,
          timestamp: new Date(t.created_at).toLocaleTimeString(),
        })))
      }
    } catch {}
  }

  function handleLogin(t: string) {
    localStorage.setItem('token', t)
    setToken(t)
    setTokenState(t)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    clearToken()
    setTokenState('')
    setUser(null)
  }

  async function handleTrade(side: 'BUY' | 'SELL') {
    setLoading(true)
    try {
      const data = await placeOrder(selectedSymbol, side, parseFloat(tradeQty))
      setTrades(prev => [{
        symbol: data.trade.symbol, side: data.trade.side,
        quantity: data.trade.quantity, price: data.trade.price,
        total: data.trade.total, latency_us: data.latency_us,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev])
      await fetchData()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Trade failed')
    }
    setLoading(false)
  }

  if (!token) return <AuthScreen onComplete={handleLogin} />

  const ticker = tickers[selectedSymbol]
  const pct = ticker ? parseFloat(ticker.price24hPcnt) * 100 : 0
  const isUp = pct >= 0
  const avgLatency = trades.length > 0 ? Math.round(trades.reduce((s, t) => s + t.latency_us, 0) / trades.length) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-[#1a1a25] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold tracking-tight">Trade<span className="text-emerald-400">Go</span></h1>
          <div className="flex gap-1 overflow-x-auto">
            {Object.values(tickers).sort((a, b) => a.symbol.localeCompare(b.symbol)).map(t => {
              const p = parseFloat(t.price24hPcnt) * 100
              return (
                <button key={t.symbol} onClick={() => setSelectedSymbol(t.symbol)}
                  className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition ${selectedSymbol === t.symbol ? 'bg-[#1a1a25] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t.symbol.replace('USDT', '')} <span className={p >= 0 ? 'text-emerald-400' : 'text-red-400'}>{p >= 0 ? '+' : ''}{p.toFixed(1)}%</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">Balance: <span className="text-white font-mono">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
          {user && user.username && (
            <div className="flex items-center gap-2 bg-[#12121a] border border-[#1a1a25] rounded-full pl-1 pr-3 py-1">
              <span className="text-lg leading-none">{user.avatar}</span>
              <span className="text-white text-xs">{user.username}</span>
            </div>
          )}
          <button onClick={handleLogout} className="text-gray-500 hover:text-white transition">Logout</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          {ticker && (
            <div className="flex items-baseline gap-4 mb-2 px-1">
              <span className="text-xl font-bold">{selectedSymbol.replace('USDT', '')}/USDT</span>
              <span className="text-xl font-mono">${formatNum(parseFloat(ticker.lastPrice))}</span>
              <span className={`text-sm ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>{isUp ? '+' : ''}{pct.toFixed(2)}%</span>
              <span className="text-xs text-gray-600">H: ${formatNum(parseFloat(ticker.highPrice24h))}</span>
              <span className="text-xs text-gray-600">L: ${formatNum(parseFloat(ticker.lowPrice24h))}</span>
              <span className="text-xs text-gray-600">Vol: {parseFloat(ticker.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          )}

          <div className="flex gap-1 mb-2">
            {INTERVALS.map(iv => (
              <button key={iv.value} onClick={() => setInterval(iv.value)}
                className={`px-3 py-1 rounded text-xs transition ${interval === iv.value ? 'bg-[#1a1a25] text-white' : 'text-gray-600 hover:text-gray-300'}`}>
                {iv.label}
              </button>
            ))}
          </div>

          <div className="border border-[#1a1a25] rounded-lg overflow-hidden">
            <Chart symbol={selectedSymbol} interval={interval} ticker={ticker} />
          </div>

          <div className="mt-4">
            <div className="flex gap-4 border-b border-[#1a1a25] mb-3">
              <button onClick={() => setTab('trades')}
                className={`pb-2 text-sm transition ${tab === 'trades' ? 'text-white border-b border-emerald-400' : 'text-gray-600 hover:text-gray-300'}`}>
                Trade log {trades.length > 0 && <span className="text-gray-600 ml-1">({trades.length})</span>}
              </button>
              <button onClick={() => setTab('holdings')}
                className={`pb-2 text-sm transition ${tab === 'holdings' ? 'text-white border-b border-emerald-400' : 'text-gray-600 hover:text-gray-300'}`}>
                Holdings {holdings.length > 0 && <span className="text-gray-600 ml-1">({holdings.length})</span>}
              </button>
            </div>

            {tab === 'trades' && (
              <>
                {trades.length > 0 && (
                  <div className="flex gap-4 text-xs mb-2 text-gray-500">
                    <span>Avg latency: <span className="text-amber-400 font-mono">{avgLatency.toLocaleString()} µs</span></span>
                    <span>Min: <span className="text-emerald-400 font-mono">{Math.min(...trades.map(t => t.latency_us)).toLocaleString()} µs</span></span>
                    <span>Max: <span className="text-red-400 font-mono">{Math.max(...trades.map(t => t.latency_us)).toLocaleString()} µs</span></span>
                  </div>
                )}
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {trades.length === 0 && <p className="text-sm text-gray-700">No trades yet</p>}
                  {trades.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[#12121a] rounded px-3 py-2 text-xs font-mono">
                      <span className={`w-10 font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</span>
                      <span className="w-16 text-gray-300">{t.symbol.replace('USDT', '')}</span>
                      <span className="w-20">{t.quantity}</span>
                      <span className="w-28">@ ${t.price.toLocaleString()}</span>
                      <span className="w-28">${t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span className="ml-auto text-amber-400">{t.latency_us.toLocaleString()} µs</span>
                      <span className="text-gray-700 w-16 text-right">{t.timestamp}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'holdings' && (
              <div className="space-y-1">
                {holdings.length === 0 && <p className="text-sm text-gray-700">No holdings</p>}
                {holdings.map(h => {
                  const currentPrice = tickers[h.symbol] ? parseFloat(tickers[h.symbol].lastPrice) : 0
                  const value = h.quantity * currentPrice
                  const pnl = (currentPrice - h.avg_buy_price) * h.quantity
                  const pnlPct = h.avg_buy_price > 0 ? ((currentPrice - h.avg_buy_price) / h.avg_buy_price) * 100 : 0
                  return (
                    <div key={h.symbol} className="flex items-center gap-3 bg-[#12121a] rounded px-3 py-2 text-xs font-mono">
                      <span className="w-16 text-gray-300 font-semibold">{h.symbol.replace('USDT', '')}</span>
                      <span className="w-24">Qty: {h.quantity}</span>
                      <span className="w-32">Avg: ${formatNum(h.avg_buy_price)}</span>
                      <span className="w-28">Value: ${formatNum(value)}</span>
                      <span className={`ml-auto ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-[#12121a] border border-[#1a1a25] rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Trade {selectedSymbol.replace('USDT', '')}</h3>

            {ticker && (
              <div className="text-2xl font-bold font-mono mb-4">
                ${formatNum(parseFloat(ticker.lastPrice))}
              </div>
            )}

            <div className="mb-3">
              <label className="text-xs text-gray-500 block mb-1">Quantity</label>
              <input type="number" step="any" value={tradeQty} onChange={e => setTradeQty(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1a1a25] rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-800 transition" />
            </div>

            {ticker && (
              <div className="text-xs text-gray-600 mb-4">
                Total: <span className="text-gray-400">${(parseFloat(tradeQty || '0') * parseFloat(ticker.lastPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => handleTrade('BUY')} disabled={loading}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-medium transition">
                Buy
              </button>
              <button onClick={() => handleTrade('SELL')} disabled={loading}
                className="py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium transition">
                Sell
              </button>
            </div>

            <div className="flex gap-1">
              {['0.001', '0.01', '0.1', '1'].map(q => (
                <button key={q} onClick={() => setTradeQty(q)}
                  className={`flex-1 py-1.5 rounded text-xs transition ${tradeQty === q ? 'bg-[#1a1a25] text-white' : 'text-gray-600 hover:text-gray-300 border border-[#1a1a25]'}`}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          {holdings.length > 0 && (
            <div className="mt-4 bg-[#12121a] border border-[#1a1a25] rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Holdings</h3>
              <div className="space-y-2">
                {holdings.map(h => {
                  const cp = tickers[h.symbol] ? parseFloat(tickers[h.symbol].lastPrice) : 0
                  const pnl = (cp - h.avg_buy_price) * h.quantity
                  return (
                    <button key={h.symbol} onClick={() => setSelectedSymbol(h.symbol)}
                      className="w-full flex justify-between items-center text-xs hover:bg-[#1a1a25] rounded px-2 py-1.5 transition">
                      <span className="font-medium">{h.symbol.replace('USDT', '')}</span>
                      <span className="font-mono text-gray-400">{h.quantity}</span>
                      <span className={`font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {trades.length > 0 && (
            <div className="mt-4 bg-[#12121a] border border-[#1a1a25] rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Performance</h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-amber-400 font-mono text-lg">{avgLatency.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Avg µs</div>
                </div>
                <div>
                  <div className="text-emerald-400 font-mono text-lg">{Math.min(...trades.map(t => t.latency_us)).toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Min µs</div>
                </div>
                <div>
                  <div className="text-red-400 font-mono text-lg">{Math.max(...trades.map(t => t.latency_us)).toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Max µs</div>
                </div>
                <div>
                  <div className="text-white font-mono text-lg">{trades.length}</div>
                  <div className="text-xs text-gray-600">Trades</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App