import { useState, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import {
  setToken, clearToken, getMe,
  getTickers, getBalance, getHoldings, placeOrder, getTrades,
  openLeveraged, closeLeveraged, getLeveragedPositions,
  getFavourites, addFavourite, removeFavourite,
} from './api'

import { Sidebar } from './components/Sidebar'
import { PublicLayout } from './components/PublicLayout'
import { AuthScreen } from './auth/AuthScreen'
import { HeroView } from './views/HeroView'
import { AboutView } from './views/AboutView'
import { TradeView } from './views/TradeView'
import { MarketsView } from './views/MarketsView'
import { SettingsView } from './views/SettingsView'
import { PortfolioView } from './views/PortfolioView'

import type { Ticker, Holding, TradeLog, Position, User } from './types'

interface AppShellProps {
  children: ReactNode
  user: User | null
  balance: number
  onLogout: () => void
}
function AppShell({ children, user, balance, onLogout }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      <Sidebar user={user} balance={balance} onLogout={onLogout} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}

function App() {
  const [token, setTokenState] = useState(localStorage.getItem('token') || '')
  const [user, setUser] = useState<User | null>(null)
  const [tickers, setTickers] = useState<Record<string, Ticker>>({})
  const [balance, setBalance] = useState(0)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [trades, setTrades] = useState<TradeLog[]>([])
  const [openPositions, setOpenPositions] = useState<Position[]>([])
  const [favourites, setFavourites] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('60')

  const [tradeMode, setTradeMode] = useState<'spot' | 'leveraged'>('spot')
  const [tradeQty, setTradeQty] = useState('0.01')
  const [levDirection, setLevDirection] = useState<'LONG' | 'SHORT'>('LONG')
  const [levLeverage, setLevLeverage] = useState(10)
  const [levMargin, setLevMargin] = useState('100')
  const [tab, setTab] = useState<'trades' | 'holdings' | 'positions'>('trades')

  const navigate = useNavigate()

  useEffect(() => { if (token) { setToken(token); fetchData() } }, [token])

  useEffect(() => {
    const id = window.setInterval(async () => {
      try { setTickers(await getTickers()) } catch {}
    }, 2000)
    getTickers().then(setTickers).catch(() => {})
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!token) return
    const id = window.setInterval(async () => {
      try {
        const pos = await getLeveragedPositions()
        setOpenPositions(pos.open || [])
      } catch {}
    }, 3000)
    return () => window.clearInterval(id)
  }, [token])

  async function fetchData() {
    try {
      const [bal, hold, me, history, pos, favs] = await Promise.all([
        getBalance(), getHoldings(), getMe(), getTrades(), getLeveragedPositions(), getFavourites(),
      ])
      setBalance(bal.balance)
      setHoldings(hold || [])
      setUser(me)
      // Replace trades fully on fetch (handles reset that clears history)
      setTrades((history || []).map((t: any) => ({
        symbol: t.symbol, side: t.side, quantity: t.quantity, price: t.price,
        total: t.total, latency_us: 0,
        timestamp: new Date(t.created_at).toLocaleTimeString(),
      })))
      setOpenPositions(pos.open || [])
      setFavourites(favs || [])
    } catch {}
  }

  function handleLogin(t: string) {
    localStorage.setItem('token', t); setToken(t); setTokenState(t)
    navigate('/trade')
  }
  function handleLogout() {
    localStorage.removeItem('token'); clearToken(); setTokenState(''); setUser(null)
    navigate('/')
  }

  async function handleSpotTrade(side: 'BUY' | 'SELL') {
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

  async function handleLeveragedOpen() {
    setLoading(true)
    try {
      const margin = parseFloat(levMargin)
      if (!margin || margin <= 0) throw new Error('invalid margin')
      await openLeveraged(selectedSymbol, levDirection, levLeverage, margin)
      await fetchData()
      setTab('positions')
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to open position')
    }
    setLoading(false)
  }

  async function handleClosePosition(id: string) {
    try { await closeLeveraged(id); await fetchData() }
    catch (err: any) { alert(err.response?.data?.error || 'Failed to close position') }
  }

  async function toggleFavourite(symbol: string) {
    try {
      if (favourites.includes(symbol)) {
        await removeFavourite(symbol)
        setFavourites(prev => prev.filter(s => s !== symbol))
      } else {
        await addFavourite(symbol)
        setFavourites(prev => [symbol, ...prev])
      }
    } catch {}
  }

  const isAuthed = !!token

  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout isAuthed={isAuthed} />}>
        <Route path="/" element={<HeroView />} />
        <Route path="/about" element={<AboutView />} />
      </Route>

      <Route path="/login" element={
        isAuthed ? <Navigate to="/trade" replace /> : <AuthScreen onComplete={handleLogin} />
      } />

      <Route path="/trade" element={
        isAuthed ? (
          <AppShell user={user} balance={balance} onLogout={handleLogout}>
            <TradeView
              tickers={tickers} selectedSymbol={selectedSymbol} setSelectedSymbol={setSelectedSymbol}
              interval={interval} setInterval={setInterval}
              tradeMode={tradeMode} setTradeMode={setTradeMode}
              tradeQty={tradeQty} setTradeQty={setTradeQty}
              levDirection={levDirection} setLevDirection={setLevDirection}
              levLeverage={levLeverage} setLevLeverage={setLevLeverage}
              levMargin={levMargin} setLevMargin={setLevMargin}
              holdings={holdings} trades={trades} openPositions={openPositions}
              tab={tab} setTab={setTab} loading={loading}
              handleSpotTrade={handleSpotTrade} handleLeveragedOpen={handleLeveragedOpen}
              handleClosePosition={handleClosePosition}
              favourites={favourites} toggleFavourite={toggleFavourite}
            />
          </AppShell>
        ) : <Navigate to="/login" replace />
      } />

      <Route path="/portfolio" element={
        isAuthed ? (
          <AppShell user={user} balance={balance} onLogout={handleLogout}>
            <PortfolioView
              tickers={tickers} balance={balance} holdings={holdings}
              trades={trades} openPositions={openPositions}
              setSelectedSymbol={setSelectedSymbol}
            />
          </AppShell>
        ) : <Navigate to="/login" replace />
      } />

      <Route path="/markets" element={
        isAuthed ? (
          <AppShell user={user} balance={balance} onLogout={handleLogout}>
            <MarketsView tickers={tickers} favourites={favourites}
              toggleFavourite={toggleFavourite} setSelectedSymbol={setSelectedSymbol} />
          </AppShell>
        ) : <Navigate to="/login" replace />
      } />

      <Route path="/settings" element={
        isAuthed ? (
          <AppShell user={user} balance={balance} onLogout={handleLogout}>
            <SettingsView user={user} onUpdate={fetchData} />
          </AppShell>
        ) : <Navigate to="/login" replace />
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App