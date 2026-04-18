import { useState, useEffect } from 'react'
import { setToken, clearToken, login, register, getTickers, getBalance, getHoldings, placeOrder } from './api'

interface Ticker {
  symbol: string
  lastPrice: string
  price24hPcnt: string
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

function App() {
  const [token, setTokenState] = useState(localStorage.getItem('token') || '')
  const [tickers, setTickers] = useState<Record<string, Ticker>>({})
  const [balance, setBalance] = useState(0)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [trades, setTrades] = useState<TradeLog[]>([])
  const [loading, setLoading] = useState(false)

  // Auth form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [authError, setAuthError] = useState('')

  // Trade form
  const [tradeSymbol, setTradeSymbol] = useState('BTCUSDT')
  const [tradeQty, setTradeQty] = useState('0.01')

  useEffect(() => {
    if (token) {
      setToken(token)
      fetchData()
    }
  }, [token])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getTickers()
        setTickers(data)
      } catch {}
    }, 2000)
    getTickers().then(setTickers).catch(() => {})
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      const [bal, hold] = await Promise.all([getBalance(), getHoldings()])
      setBalance(bal.balance)
      setHoldings(hold || [])
    } catch {}
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    try {
      const data = isRegister
        ? await register(email, password, name)
        : await login(email, password)
      localStorage.setItem('token', data.token)
      setToken(data.token)
      setTokenState(data.token)
    } catch {
      setAuthError('Authentication failed')
    }
  }

  function handleLogout() {
    localStorage.removeItem('token')
    clearToken()
    setTokenState('')
    setBalance(0)
    setHoldings([])
    setTrades([])
  }

  async function handleTrade(side: 'BUY' | 'SELL') {
    setLoading(true)
    try {
      const data = await placeOrder(tradeSymbol, side, parseFloat(tradeQty))
      setTrades(prev => [{
        symbol: data.trade.symbol,
        side: data.trade.side,
        quantity: data.trade.quantity,
        price: data.trade.price,
        total: data.trade.total,
        latency_us: data.latency_us,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev])
      await fetchData()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Trade failed')
    }
    setLoading(false)
  }

  const avgLatency = trades.length > 0
    ? Math.round(trades.reduce((sum, t) => sum + t.latency_us, 0) / trades.length)
    : 0

  // Auth screen
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="w-full max-w-sm p-6">
          <h1 className="text-2xl font-bold mb-1">TradeGo</h1>
          <p className="text-gray-400 mb-6 text-sm">High-performance crypto trading simulator</p>
          <form onSubmit={handleAuth} className="space-y-3">
            {isRegister && (
              <input
                type="text" placeholder="Name" value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm focus:outline-none focus:border-gray-600"
              />
            )}
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm focus:outline-none focus:border-gray-600"
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm focus:outline-none focus:border-gray-600"
            />
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button className="w-full py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium">
              {isRegister ? 'Register' : 'Login'}
            </button>
          </form>
          <button onClick={() => setIsRegister(!isRegister)} className="mt-3 text-sm text-gray-400 hover:text-white">
            {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    )
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">TradeGo</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">Balance: <span className="text-white font-medium">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white">Logout</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Live prices */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Live prices</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {Object.values(tickers).sort((a, b) => a.symbol.localeCompare(b.symbol)).map(t => {
              const pct = (parseFloat(t.price24hPcnt) * 100)
              const isUp = pct >= 0
              return (
                <button key={t.symbol} onClick={() => setTradeSymbol(t.symbol)}
                  className={`p-3 rounded border text-left text-sm ${tradeSymbol === t.symbol ? 'border-green-600 bg-green-600/10' : 'border-gray-800 bg-gray-900 hover:border-gray-700'}`}>
                  <div className="font-medium text-xs">{t.symbol.replace('USDT', '')}</div>
                  <div className="font-mono mt-1">${parseFloat(t.lastPrice).toLocaleString()}</div>
                  <div className={`text-xs mt-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? '+' : ''}{pct.toFixed(2)}%
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Trade panel */}
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-3">Trade {tradeSymbol.replace('USDT', '')}</h2>
          <div className="bg-gray-900 border border-gray-800 rounded p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-400">Quantity</label>
              <input
                type="number" step="any" value={tradeQty}
                onChange={e => setTradeQty(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm font-mono focus:outline-none focus:border-gray-600"
              />
              {tickers[tradeSymbol] && (
                <p className="text-xs text-gray-500 mt-1">
                  Total: ${(parseFloat(tradeQty) * parseFloat(tickers[tradeSymbol].lastPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleTrade('BUY')} disabled={loading}
                className="py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm font-medium">
                Buy
              </button>
              <button onClick={() => handleTrade('SELL')} disabled={loading}
                className="py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm font-medium">
                Sell
              </button>
            </div>
          </div>

          {/* Holdings */}
          {holdings.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-medium text-gray-400 mb-2">Holdings</h2>
              <div className="space-y-1">
                {holdings.map(h => (
                  <div key={h.symbol} className="flex justify-between bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm">
                    <span>{h.symbol.replace('USDT', '')}</span>
                    <span className="font-mono">{h.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Latency dashboard */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-4 mb-3">
            <h2 className="text-sm font-medium text-gray-400">Execution latency</h2>
            {trades.length > 0 && (
              <div className="flex gap-4 text-xs">
                <span className="text-gray-500">Avg: <span className="text-yellow-400 font-mono">{avgLatency.toLocaleString()} µs</span></span>
                <span className="text-gray-500">Min: <span className="text-green-400 font-mono">{Math.min(...trades.map(t => t.latency_us)).toLocaleString()} µs</span></span>
                <span className="text-gray-500">Max: <span className="text-red-400 font-mono">{Math.max(...trades.map(t => t.latency_us)).toLocaleString()} µs</span></span>
                <span className="text-gray-500">Trades: <span className="text-white font-mono">{trades.length}</span></span>
              </div>
            )}
          </div>

          {trades.length === 0 ? (
            <p className="text-sm text-gray-600">Place a trade to see execution latency</p>
          ) : (
            <div className="space-y-1">
              {trades.map((t, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded px-4 py-2 text-sm">
                  <span className={`font-medium w-10 ${t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t.side}</span>
                  <span className="w-20">{t.symbol.replace('USDT', '')}</span>
                  <span className="font-mono w-24">{t.quantity}</span>
                  <span className="font-mono w-28">@ ${t.price.toLocaleString()}</span>
                  <span className="font-mono w-28">${t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="ml-auto font-mono text-yellow-400">{t.latency_us.toLocaleString()} µs</span>
                  <span className="text-gray-600 text-xs">{t.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App