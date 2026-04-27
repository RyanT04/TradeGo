import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatNum } from '../utils'
import { CoinIcon } from '../components/CoinIcon'
import type { Ticker } from '../types'

interface MarketsViewProps {
  tickers: Record<string, Ticker>
  favourites: string[]
  toggleFavourite: (symbol: string) => void
  setSelectedSymbol: (s: string) => void
}

const HOT_COINS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
  'LINKUSDT', 'UNIUSDT', 'LTCUSDT', 'ATOMUSDT', 'NEARUSDT',
  'APTUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'SUIUSDT',
]

const PAGE_SIZE = 20

export function MarketsView({ tickers, favourites, toggleFavourite, setSelectedSymbol }: MarketsViewProps) {
  const [tab, setTab] = useState<'all' | 'favourites'>('all')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const navigate = useNavigate()

  const sortedTickers = useMemo(() => {
    const all = Object.values(tickers)
    const hotOrder = new Map(HOT_COINS.map((s, i) => [s, i]))
    return all.sort((a, b) => {
      const aHot = hotOrder.has(a.symbol)
      const bHot = hotOrder.has(b.symbol)
      if (aHot && bHot) return hotOrder.get(a.symbol)! - hotOrder.get(b.symbol)!
      if (aHot) return -1
      if (bHot) return 1
      const va = parseFloat(a.volume24h) || 0
      const vb = parseFloat(b.volume24h) || 0
      return vb - va
    })
  }, [tickers])

  const filtered = useMemo(() => {
    return sortedTickers.filter(t => {
      if (tab === 'favourites' && !favourites.includes(t.symbol)) return false
      if (search && !t.symbol.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [sortedTickers, tab, favourites, search])

  const usePagination = tab === 'all' && search === ''
  const visible = usePagination ? filtered.slice(0, visibleCount) : filtered
  const canShowMore = usePagination && visibleCount < filtered.length
  const canShowLess = usePagination && visibleCount > PAGE_SIZE

  function handleTrade(symbol: string) {
    setSelectedSymbol(symbol)
    navigate('/trade')
  }

  function showMore() { setVisibleCount(c => Math.min(c + PAGE_SIZE, filtered.length)) }
  function showLess() {
    setVisibleCount(PAGE_SIZE)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-4 lg:mb-6">Markets</h1>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center border-b border-[#1a1a25] mb-4 pb-2 sm:pb-0">
        <div className="flex gap-4">
          <button onClick={() => { setTab('all'); setVisibleCount(PAGE_SIZE) }}
            className={`pb-2 text-sm transition ${tab === 'all' ? 'text-white border-b border-emerald-400' : 'text-gray-600 hover:text-gray-300'}`}>
            All ({sortedTickers.length})
          </button>
          <button onClick={() => setTab('favourites')}
            className={`pb-2 text-sm transition ${tab === 'favourites' ? 'text-white border-b border-emerald-400' : 'text-gray-600 hover:text-gray-300'}`}>
            ⭐ Favourites ({favourites.length})
          </button>
        </div>
        <input type="text" placeholder="Search symbol..." value={search} onChange={e => setSearch(e.target.value)}
          className="sm:ml-auto px-3 py-1.5 bg-[#12121a] border border-[#1a1a25] rounded text-xs w-full sm:w-48 focus:outline-none focus:border-emerald-600 transition" />
      </div>

      {/* Desktop header — hidden on mobile */}
      <div className="hidden lg:flex items-center gap-4 px-4 py-2 text-xs text-gray-500">
        <span className="w-8"></span>
        <span className="w-8"></span>
        <span className="w-24">Symbol</span>
        <span className="w-32">Price</span>
        <span className="w-24">24h %</span>
        <span className="w-32">24h High</span>
        <span className="w-32">24h Low</span>
        <span className="w-32">Volume</span>
        <span className="ml-auto"></span>
      </div>

      <div className="space-y-2 lg:space-y-1">
        {visible.length === 0 && (
          <p className="text-sm text-gray-500 px-4 py-8 text-center">
            {tab === 'favourites' ? 'No favourites yet. Click the ☆ next to a coin to add it.' : 'No coins match your search'}
          </p>
        )}
        {visible.map(t => {
          const pct = parseFloat(t.price24hPcnt) * 100
          const isFav = favourites.includes(t.symbol)
          return (
            <div key={t.symbol} className="bg-[#12121a] border border-[#1a1a25] rounded-lg hover:border-gray-700 transition">
              {/* Desktop layout (lg+) — single row */}
              <div className="hidden lg:flex items-center gap-4 px-4 py-3">
                <button onClick={() => toggleFavourite(t.symbol)} className="text-lg w-8" title={isFav ? 'Remove favourite' : 'Add favourite'}>
                  {isFav ? '⭐' : '☆'}
                </button>
                <CoinIcon symbol={t.symbol} size={24} />
                <span className="w-24 font-semibold">{t.symbol.replace('USDT', '')}</span>
                <span className="w-32 font-mono">${formatNum(parseFloat(t.lastPrice))}</span>
                <span className={`w-24 font-mono ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
                <span className="w-32 text-xs text-gray-500 font-mono">${formatNum(parseFloat(t.highPrice24h))}</span>
                <span className="w-32 text-xs text-gray-500 font-mono">${formatNum(parseFloat(t.lowPrice24h))}</span>
                <span className="w-32 text-xs text-gray-500 font-mono">{parseFloat(t.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <button onClick={() => handleTrade(t.symbol)}
                  className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded text-xs font-medium transition">
                  Trade
                </button>
              </div>

              {/* Mobile layout (below lg) — stacked card */}
              <div className="lg:hidden p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <CoinIcon symbol={t.symbol} size={28} />
                  <div className="flex-1">
                    <div className="font-semibold text-base">{t.symbol.replace('USDT', '')}</div>
                    <div className={`text-xs font-mono ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-base">${formatNum(parseFloat(t.lastPrice))}</div>
                  </div>
                  <button onClick={() => toggleFavourite(t.symbol)} className="text-lg" title={isFav ? 'Remove favourite' : 'Add favourite'}>
                    {isFav ? '⭐' : '☆'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 font-mono">
                  <div><div className="text-[10px] text-gray-600">24h High</div>${formatNum(parseFloat(t.highPrice24h))}</div>
                  <div><div className="text-[10px] text-gray-600">24h Low</div>${formatNum(parseFloat(t.lowPrice24h))}</div>
                  <div><div className="text-[10px] text-gray-600">Volume</div>{parseFloat(t.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <button onClick={() => handleTrade(t.symbol)}
                  className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm font-medium transition">
                  Trade
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {usePagination && filtered.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          <span className="text-xs text-gray-600">Showing {visible.length} of {filtered.length}</span>
          <div className="flex gap-2">
            {canShowMore && (
              <button onClick={showMore}
                className="px-4 py-1.5 bg-[#12121a] border border-[#1a1a25] hover:border-gray-700 rounded text-xs text-gray-300 transition">
                Show more
              </button>
            )}
            {canShowLess && (
              <button onClick={showLess}
                className="px-4 py-1.5 bg-[#12121a] border border-[#1a1a25] hover:border-gray-700 rounded text-xs text-gray-500 transition">
                Show less
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}