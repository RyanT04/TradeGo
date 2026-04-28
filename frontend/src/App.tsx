import { useState, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
  setToken, clearToken, getMe,
  getTickers, getBalance, getHoldings, placeOrder, getTrades,
  openLeveraged, closeLeveraged, getLeveragedPositions,
  getFavourites, addFavourite, removeFavourite,
} from './api'

import { Sidebar } from './components/Sidebar'
import { PublicLayout } from './components/PublicLayout'
import { WelcomeModal } from './components/WelcomeModal'
import { AuthScreen } from './auth/AuthScreen'
import { HeroView } from './views/HeroView'
import { AboutView } from './views/AboutView'
import { TradeView } from './views/TradeView'
import { MarketsView } from './views/MarketsView'
import { SettingsView } from './views/SettingsView'
import { PortfolioView } from './views/PortfolioView'
import { ChatBubble } from './components/ChatBubble'

import type { Ticker, Holding, TradeLog, Position, User } from './types'

const WELCOME_KEY = 'tradego.seenWelcome'

interface AppShellProps {
  children: ReactNode
  user: User | null
  balance: number
}

function AppShell({ children, user, balance }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      <Sidebar user={user} balance={balance} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1a1a25] flex items-center gap-3 px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu"
            className="text-gray-400 hover:text-white transition">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-bold tracking-tight">
            Trade<span className="text-emerald-400">Go</span>
          </span>
          {user && (
            <span className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-lg">{user.avatar}</span>
              <span className="text-xs text-gray-500 font-mono">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </span>
          )}
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <ChatBubble />
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

  const [showWelcome, setShowWelcome] = useState(false)

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
      setTrades((history || []).map((t: any) => ({
        symbol: t.symbol, side: t.side, quantity: t.quantity, price: t.price,
        total: t.total, latency_us: 0,
        timestamp: new Date(t.created_at).toLocaleTimeString(),
      })))
      setOpenPositions(pos.open || [])
      setFavourites(favs || [])
    } catch {}
  }

  function handleLogin(t: string, isNewUser: boolean = false) {
      localStorage.setItem('token', t); setToken(t); setTokenState(t)
      if (isNewUser) {
        localStorage.removeItem(WELCOME_KEY)
      }
      if (!localStorage.getItem(WELCOME_KEY)) {
        setShowWelcome(true)
      }
      navigate(isNewUser ? '/about' : '/trade')
  }

  function handleLogout() {
    localStorage.removeItem('token')
    clearToken(); setTokenState(''); setUser(null)
    navigate('/')
  }

  function dismissWelcome(permanent: boolean) {
    if (permanent) {
        localStorage.setItem(WELCOME_KEY, '1')
      }
      setShowWelcome(false)
  }

  function showTutorialAgain() {
    setShowWelcome(true)
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
    <>
      <WelcomeModal open={showWelcome} onClose={dismissWelcome} />

      <Routes>
        <Route element={<PublicLayout isAuthed={isAuthed} onLogout={handleLogout} />}>
          <Route path="/" element={<HeroView />} />
          {!isAuthed && <Route path="/about" element={<AboutView />} />}
        </Route>

        {isAuthed && (
          <Route path="/about" element={
            <AppShell user={user} balance={balance}>
              <AboutView />
            </AppShell>
          } />
        )}

        <Route path="/login" element={
          isAuthed ? <Navigate to="/trade" replace /> : <AuthScreen onComplete={handleLogin} initialMode="login" />
        } />

        <Route path="/register" element={
          isAuthed ? <Navigate to="/about" replace /> : <AuthScreen onComplete={handleLogin} initialMode="register" />
        } />

        <Route path="/trade" element={
          isAuthed ? (
            <AppShell user={user} balance={balance}>
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
                balance={balance}
              />
            </AppShell>
          ) : <Navigate to="/login" replace />
        } />

        <Route path="/portfolio" element={
          isAuthed ? (
            <AppShell user={user} balance={balance}>
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
            <AppShell user={user} balance={balance}>
              <MarketsView tickers={tickers} favourites={favourites}
                toggleFavourite={toggleFavourite} setSelectedSymbol={setSelectedSymbol} />
            </AppShell>
          ) : <Navigate to="/login" replace />
        } />

        <Route path="/settings" element={
          isAuthed ? (
            <AppShell user={user} balance={balance}>
              <SettingsView user={user} onUpdate={fetchData} onLogout={handleLogout} onShowTutorial={showTutorialAgain} />
            </AppShell>
          ) : <Navigate to="/login" replace />
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App