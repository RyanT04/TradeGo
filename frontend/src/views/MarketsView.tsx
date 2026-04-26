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

// Hot coins (WebSocket-subscribed). Pinned to the top in this order.
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

  // Sort: hot coins first (in HOT_COINS order), then everything else by 24h volume desc
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

  // Paginate only on the All tab without an active search
  const usePagination = tab === 'all' && search === ''
  const visible = usePagination ? filtered.slice(0, visibleCount) : filtered
  const canShowMore = usePagination && visibleCount < filtered.length
  const canShowLess = usePagination && visibleCount > PAGE_SIZE

  function handleTrade(symbol: string) {
    setSelectedSymbol(symbol)
    navigate('/trade')
  }

  function showMore() {
    setVisibleCount(c => Math.min(c + PAGE_SIZE, filtered.length))
  }

  function showLess() {
    setVisibleCount(PAGE_SIZE)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Markets</h1>

      <div className="flex gap-4 border-b border-[#1a1a25] mb-4 items-center">
        <button onClick={() => { setTab('all'); setVisibleCount(PAGE_SIZE) }}
          className={`pb-2 text-sm transition ${tab === 'all' ? 'text-white border-b border-emerald-400' : 'text-gray-600 hover:text-gray-300'}`}>
          All ({sortedTickers.length})
        </button>
        <button onClick={() => setTab('favourites')}
          className={`pb-2 text-sm transition ${tab === 'favourites' ? 'text-white border-b border-emerald-400' : 'text-gray-600 hover:text-gray-300'}`}>
          ⭐ Favourites ({favourites.length})
        </button>
        <input type="text" placeholder="Search symbol..." value={search} onChange={e => setSearch(e.target.value)}
          className="ml-auto px-3 py-1.5 bg-[#12121a] border border-[#1a1a25] rounded text-xs w-48 focus:outline-none focus:border-emerald-600 transition" />
      </div>

      {/* Header row */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs text-gray-500">
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

      <div className="space-y-1">
        {visible.length === 0 && (
          <p className="text-sm text-gray-500 px-4 py-8 text-center">
            {tab === 'favourites' ? 'No favourites yet. Click the ☆ next to a coin to add it.' : 'No coins match your search'}
          </p>
        )}
        {visible.map(t => {
          const pct = parseFloat(t.price24hPcnt) * 100
          const isFav = favourites.includes(t.symbol)
          return (
            <div key={t.symbol} className="flex items-center gap-4 bg-[#12121a] border border-[#1a1a25] rounded-lg px-4 py-3 hover:border-gray-700 transition">
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
          )
        })}
      </div>

      {/* Pagination controls */}
      {usePagination && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className="text-xs text-gray-600">
            Showing {visible.length} of {filtered.length}
          </span>
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
      )}
    </div>
  )
}