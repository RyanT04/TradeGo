import { useState } from 'react'
import { Chart } from '../components/Chart'
import { CoinIcon } from '../components/CoinIcon'
import { formatNum } from '../utils'
import { INTERVALS, LEVERAGE_OPTIONS } from '../constants'
import type { Ticker, Holding, TradeLog, Position } from '../types'

interface TradeViewProps {
  tickers: Record<string, Ticker>
  selectedSymbol: string
  setSelectedSymbol: (s: string) => void
  interval: string
  setInterval: (i: string) => void
  tradeMode: 'spot' | 'leveraged'
  setTradeMode: (m: 'spot' | 'leveraged') => void
  tradeQty: string
  setTradeQty: (q: string) => void
  levDirection: 'LONG' | 'SHORT'
  setLevDirection: (d: 'LONG' | 'SHORT') => void
  levLeverage: number
  setLevLeverage: (l: number) => void
  levMargin: string
  setLevMargin: (m: string) => void
  holdings: Holding[]
  trades: TradeLog[]
  openPositions: Position[]
  tab: 'trades' | 'holdings' | 'positions'
  setTab: (t: 'trades' | 'holdings' | 'positions') => void
  loading: boolean
  handleSpotTrade: (side: 'BUY' | 'SELL') => void
  handleLeveragedOpen: () => void
  handleClosePosition: (id: string) => void
  favourites: string[]
  toggleFavourite: (symbol: string) => void
  balance:number
}

export function TradeView(props: TradeViewProps) {
  const {
    tickers, selectedSymbol, setSelectedSymbol, interval, setInterval,
    tradeMode, setTradeMode, tradeQty, setTradeQty,
    levDirection, setLevDirection, levLeverage, setLevLeverage, levMargin, setLevMargin,
    holdings, trades, openPositions, tab, setTab, loading,
    handleSpotTrade, handleLeveragedOpen, handleClosePosition,
    favourites, toggleFavourite, balance
  } = props

  const ticker = tickers[selectedSymbol]
  const pct = ticker ? parseFloat(ticker.price24hPcnt) * 100 : 0
  const isUp = pct >= 0

  const [spotInputMode, setSpotInputMode] = useState<'coin' | 'usd'>('coin')

  const coinName = selectedSymbol.replace('USDT', '')
  const tradeQtyNum = parseFloat(tradeQty) || 0
  const lastPrice = ticker ? parseFloat(ticker.lastPrice) : 0
  const effectiveCoinQty = spotInputMode === 'usd' && lastPrice > 0
    ? tradeQtyNum / lastPrice
    : tradeQtyNum
  const effectiveUsdTotal = spotInputMode === 'usd'
    ? tradeQtyNum
    : tradeQtyNum * lastPrice

  const liveTrades = trades.filter(t => t.latency_us > 0)
  const avgLatency = liveTrades.length > 0
    ? Math.round(liveTrades.reduce((s, t) => s + t.latency_us, 0) / liveTrades.length)
    : 0

  const positionsWithPnL = openPositions.map(p => {
    const currentPrice = tickers[p.symbol] ? parseFloat(tickers[p.symbol].lastPrice) : p.entry_price
    const livePnL = p.direction === 'LONG'
      ? p.size_usd * ((currentPrice - p.entry_price) / p.entry_price)
      : p.size_usd * ((p.entry_price - currentPrice) / p.entry_price)
    const pnlPct = (livePnL / p.margin_usd) * 100
    return { ...p, currentPrice, livePnL, pnlPct }
  })

  const levPreview = ticker ? (() => {
    const price = parseFloat(ticker.lastPrice)
    const margin = parseFloat(levMargin) || 0
    const size = margin * levLeverage
    const liqPrice = levDirection === 'LONG' ? price * (1 - 1 / levLeverage) : price * (1 + 1 / levLeverage)
    return { price, size, liqPrice }
  })() : null

  const isFav = favourites.includes(selectedSymbol)
  const [coinOpen, setCoinOpen] = useState(false)
  const [coinSearch, setCoinSearch] = useState('')

  const sortedTickers = Object.values(tickers).sort((a, b) => {
    const va = parseFloat(a.volume24h) || 0
    const vb = parseFloat(b.volume24h) || 0
    return vb - va
  })
  const filteredDropdown = sortedTickers.filter(t =>
    !coinSearch || t.symbol.toLowerCase().includes(coinSearch.toLowerCase())
  )

  function onSpotTrade(side: 'BUY' | 'SELL') {
    if (spotInputMode === 'usd') {
      if (lastPrice <= 0 || tradeQtyNum <= 0) { alert('Invalid amount'); return }
      const coinQty = tradeQtyNum / lastPrice
      setTradeQty(coinQty.toString())
      setTimeout(() => handleSpotTrade(side), 0)
    } else {
      handleSpotTrade(side)
    }
  }

  const tradePanel = (
    <div className="bg-[#12121a] border border-[#1a1a25] rounded-lg p-4">
      <div className="flex gap-1 mb-4 bg-[#0a0a0f] p-1 rounded-lg">
        <button onClick={() => setTradeMode('spot')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition ${tradeMode === 'spot' ? 'bg-[#1a1a25] text-white' : 'text-gray-500 hover:text-gray-300'}`}>Spot</button>
        <button onClick={() => setTradeMode('leveraged')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition ${tradeMode === 'leveraged' ? 'bg-[#1a1a25] text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>⚡ Leveraged</button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <CoinIcon symbol={selectedSymbol} size={20} />
        <h3 className="text-sm font-medium">{tradeMode === 'spot' ? 'Trade' : 'Leverage'} {selectedSymbol.replace('USDT', '')}</h3>
      </div>
      {ticker && <div className="text-2xl font-bold font-mono mb-4">${formatNum(parseFloat(ticker.lastPrice))}</div>}

      {tradeMode === 'spot' ? (
        <>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">
                {spotInputMode === 'coin' ? `Quantity (${coinName})` : 'Amount (USD)'}
              </label>
              <div className="flex gap-1 bg-[#0a0a0f] rounded p-0.5">
                <button onClick={() => { setSpotInputMode('coin'); setTradeQty('0.01') }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${spotInputMode === 'coin' ? 'bg-[#1a1a25] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {coinName}
                </button>
                <button onClick={() => { setSpotInputMode('usd'); setTradeQty('100') }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${spotInputMode === 'usd' ? 'bg-[#1a1a25] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  USD
                </button>
              </div>
            </div>
            <input type="number" step="any" min="0" value={tradeQty} onChange={e => setTradeQty(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1a1a25] rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-800 transition" />
          </div>
          {ticker && tradeQtyNum > 0 && (
            <div className="text-xs text-gray-600 mb-4 space-y-0.5">
              {spotInputMode === 'usd' ? (
                <div>≈ <span className="text-gray-400 font-mono">{effectiveCoinQty.toFixed(8)} {coinName}</span></div>
              ) : (
                <div>≈ <span className="text-gray-400 font-mono">${effectiveUsdTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => onSpotTrade('BUY')} disabled={loading}
              className="py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-medium transition">Buy</button>
            <button onClick={() => onSpotTrade('SELL')} disabled={loading}
              className="py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium transition">Sell</button>
          </div>
          <div className="flex gap-1">
            {(spotInputMode === 'coin' ? ['0.001', '0.01', '0.1', '1'] : ['10', '100', '1000', '10000']).map(q => (
              <button key={q} onClick={() => setTradeQty(q)}
                className={`flex-1 py-1.5 rounded text-xs transition ${tradeQty === q ? 'bg-[#1a1a25] text-white' : 'text-gray-600 hover:text-gray-300 border border-[#1a1a25]'}`}>{q}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => setLevDirection('LONG')}
              className={`py-2 rounded-lg text-sm font-medium transition ${levDirection === 'LONG' ? 'bg-emerald-600 text-white' : 'bg-[#0a0a0f] border border-[#1a1a25] text-gray-400 hover:text-white'}`}>Long ↑</button>
            <button onClick={() => setLevDirection('SHORT')}
              className={`py-2 rounded-lg text-sm font-medium transition ${levDirection === 'SHORT' ? 'bg-red-600 text-white' : 'bg-[#0a0a0f] border border-[#1a1a25] text-gray-400 hover:text-white'}`}>Short ↓</button>
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Leverage</label>
            <div className="flex flex-wrap gap-1">
              {LEVERAGE_OPTIONS.map(l => (
                <button key={l} onClick={() => setLevLeverage(l)}
                  className={`flex-1 min-w-[3rem] py-1.5 rounded text-xs font-medium transition ${levLeverage === l ? 'bg-amber-600 text-white' : 'bg-[#0a0a0f] border border-[#1a1a25] text-gray-400 hover:text-white'}`}>{l}x</button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Margin (USD)</label>
            <span className="text-xs text-gray-600 font-mono">Bal: ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
            <input type="number" step="any" value={levMargin} onChange={e => setLevMargin(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1a1a25] rounded-lg text-sm font-mono focus:outline-none focus:border-amber-800 transition" />
          </div>
          {levPreview && (
            <div className="bg-[#0a0a0f] border border-[#1a1a25] rounded-lg p-3 mb-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Position size</span><span className="text-white font-mono">${formatNum(levPreview.size)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Entry</span><span className="text-white font-mono">${formatNum(levPreview.price)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Liquidation</span><span className="text-red-400 font-mono">${formatNum(levPreview.liqPrice)}</span></div>
            </div>
          )}
          <button onClick={handleLeveragedOpen} disabled={loading}
            className={`w-full py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${levDirection === 'LONG' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
            Open {levDirection} {levLeverage}x
          </button>
        </>
      )}
    </div>
  )

  const performanceCard = liveTrades.length > 0 && (
    <div className="bg-[#12121a] border border-[#1a1a25] rounded-lg p-4">
      <h3 className="text-sm font-medium mb-3">Performance</h3>
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 text-center">
        <div><div className="text-amber-400 font-mono text-lg">{avgLatency.toLocaleString()}</div><div className="text-xs text-gray-600">Avg µs</div></div>
        <div><div className="text-emerald-400 font-mono text-lg">{Math.min(...liveTrades.map(t => t.latency_us)).toLocaleString()}</div><div className="text-xs text-gray-600">Min µs</div></div>
        <div><div className="text-red-400 font-mono text-lg">{Math.max(...liveTrades.map(t => t.latency_us)).toLocaleString()}</div><div className="text-xs text-gray-600">Max µs</div></div>
        <div><div className="text-white font-mono text-lg">{liveTrades.length}</div><div className="text-xs text-gray-600">Trades</div></div>
      </div>
    </div>
  )

  return (
    <div className="p-3 lg:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main column — chart and tabs */}
        <div className="lg:col-span-3 order-2 lg:order-1">
          <div className="flex flex-wrap items-baseline gap-2 lg:gap-3 mb-2 px-1 relative">
            <div className="relative">
              <button onClick={() => { setCoinOpen(!coinOpen); setCoinSearch('') }}
                className="text-xl font-bold flex items-center gap-2 hover:text-emerald-400 transition">
                <CoinIcon symbol={selectedSymbol} size={24} />
                {selectedSymbol.replace('USDT', '')}/USDT
                <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </button>
              {coinOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 sm:w-80 max-h-[28rem] bg-[#12121a] border border-[#1a1a25] rounded-lg shadow-2xl z-50 flex flex-col">
                  <input autoFocus type="text" placeholder="Search..." value={coinSearch}
                    onChange={e => setCoinSearch(e.target.value)}
                    className="m-2 px-3 py-1.5 bg-[#0a0a0f] border border-[#1a1a25] rounded text-xs focus:outline-none focus:border-emerald-600 transition" />
                  <div className="overflow-y-auto">
                    {filteredDropdown.slice(0, 100).map(t => {
                      const p = parseFloat(t.price24hPcnt) * 100
                      return (
                        <button key={t.symbol}
                          onClick={() => { setSelectedSymbol(t.symbol); setCoinOpen(false) }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-[#1a1a25] transition ${selectedSymbol === t.symbol ? 'bg-[#1a1a25]' : ''}`}>
                          <CoinIcon symbol={t.symbol} size={20} />
                          <span className="w-16 text-left font-semibold">{t.symbol.replace('USDT', '')}</span>
                          <span className="font-mono text-gray-400 flex-1 text-left">${formatNum(parseFloat(t.lastPrice))}</span>
                          <span className={p >= 0 ? 'text-emerald-400' : 'text-red-400'}>{p >= 0 ? '+' : ''}{p.toFixed(2)}%</span>
                        </button>
                      )
                    })}
                    {filteredDropdown.length > 100 && (
                      <div className="px-3 py-2 text-xs text-gray-600 text-center">
                        Showing top 100 of {filteredDropdown.length}. Refine search to see more.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => toggleFavourite(selectedSymbol)} className="text-lg" title={isFav ? 'Remove from favourites' : 'Add to favourites'}>
              {isFav ? '⭐' : '☆'}
            </button>
            {ticker && (
              <>
                <span className="text-xl font-mono">${formatNum(parseFloat(ticker.lastPrice))}</span>
                <span className={`text-sm ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>{isUp ? '+' : ''}{pct.toFixed(2)}%</span>
                {/* Hide volume / high / low on mobile to save space */}
                <span className="hidden md:inline text-xs text-gray-600">H: ${formatNum(parseFloat(ticker.highPrice24h))}</span>
                <span className="hidden md:inline text-xs text-gray-600">L: ${formatNum(parseFloat(ticker.lowPrice24h))}</span>
                <span className="hidden lg:inline text-xs text-gray-600">Vol: {parseFloat(ticker.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
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
            <div className="flex gap-2 sm:gap-4 border-b border-[#1a1a25] mb-3 overflow-x-auto">
              <button onClick={() => setTab('trades')}
                className={`pb-2 text-sm transition whitespace-nowrap ${tab === 'trades' ? 'text-white border-b border-emerald-400' : 'text-gray-600 hover:text-gray-300'}`}>
                Trade log {trades.length > 0 && <span className="text-gray-600 ml-1">({trades.length})</span>}
              </button>
              <button onClick={() => setTab('holdings')}
                className={`pb-2 text-sm transition whitespace-nowrap ${tab === 'holdings' ? 'text-white border-b border-emerald-400' : 'text-gray-600 hover:text-gray-300'}`}>
                Holdings {holdings.length > 0 && <span className="text-gray-600 ml-1">({holdings.length})</span>}
              </button>
              <button onClick={() => setTab('positions')}
                className={`pb-2 text-sm transition whitespace-nowrap ${tab === 'positions' ? 'text-white border-b border-emerald-400' : 'text-gray-600 hover:text-gray-300'}`}>
                Positions {openPositions.length > 0 && <span className="text-amber-400 ml-1">({openPositions.length})</span>}
              </button>
            </div>

            {tab === 'trades' && (
              <>
                {liveTrades.length > 0 && (
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-xs mb-2 text-gray-500">
                    <span>Avg: <span className="text-amber-400 font-mono">{avgLatency.toLocaleString()} µs</span></span>
                    <span>Min: <span className="text-emerald-400 font-mono">{Math.min(...liveTrades.map(t => t.latency_us)).toLocaleString()} µs</span></span>
                    <span>Max: <span className="text-red-400 font-mono">{Math.max(...liveTrades.map(t => t.latency_us)).toLocaleString()} µs</span></span>
                  </div>
                )}
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {trades.length === 0 && <p className="text-sm text-gray-700">No trades yet</p>}
                  {trades.map((t, i) => (
                    <div key={i} className="bg-[#12121a] rounded px-3 py-2 text-xs font-mono">
                      {/* Desktop row */}
                      <div className="hidden sm:flex items-center gap-3">
                        <span className={`w-10 font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</span>
                        <CoinIcon symbol={t.symbol} size={16} />
                        <span className="w-16 text-gray-300">{t.symbol.replace('USDT', '')}</span>
                        <span className="w-20">{t.quantity}</span>
                        <span className="w-28">@ ${t.price.toLocaleString()}</span>
                        <span className="w-28">${t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="ml-auto text-amber-400">{t.latency_us > 0 ? `${t.latency_us.toLocaleString()} µs` : '—'}</span>
                        <span className="text-gray-700 w-16 text-right">{t.timestamp}</span>
                      </div>
                      {/* Mobile compact */}
                      <div className="sm:hidden">
                        <div className="flex items-center gap-2">
                          <CoinIcon symbol={t.symbol} size={14} />
                          <span className={`font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</span>
                          <span className="text-gray-300">{t.symbol.replace('USDT', '')}</span>
                          <span className="ml-auto text-amber-400 text-[10px]">{t.latency_us > 0 ? `${t.latency_us.toLocaleString()} µs` : '—'}</span>
                        </div>
                        <div className="text-gray-500 mt-0.5">
                          {t.quantity} @ ${t.price.toLocaleString()} = ${t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'holdings' && (
              <div className="space-y-1">
                {holdings.length === 0 && <p className="text-sm text-gray-700">No holdings</p>}
                {holdings.map(h => {
                  const cp = tickers[h.symbol] ? parseFloat(tickers[h.symbol].lastPrice) : 0
                  const value = h.quantity * cp
                  const pnl = (cp - h.avg_buy_price) * h.quantity
                  const pnlPct = h.avg_buy_price > 0 ? ((cp - h.avg_buy_price) / h.avg_buy_price) * 100 : 0
                  return (
                    <div key={h.symbol} className="bg-[#12121a] rounded px-3 py-2 text-xs font-mono">
                      <div className="hidden sm:flex items-center gap-3">
                        <CoinIcon symbol={h.symbol} size={16} />
                        <span className="w-16 text-gray-300 font-semibold">{h.symbol.replace('USDT', '')}</span>
                        <span className="w-24">Qty: {h.quantity}</span>
                        <span className="w-32">Avg: ${formatNum(h.avg_buy_price)}</span>
                        <span className="w-28">Value: ${formatNum(value)}</span>
                        <span className={`ml-auto ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                        </span>
                      </div>
                      <div className="sm:hidden">
                        <div className="flex items-center gap-2">
                          <CoinIcon symbol={h.symbol} size={14} />
                          <span className="text-gray-300 font-semibold">{h.symbol.replace('USDT', '')}</span>
                          <span className={`ml-auto ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-gray-500 mt-0.5">{h.quantity} @ avg ${formatNum(h.avg_buy_price)} → ${formatNum(value)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'positions' && (
              <div className="space-y-1">
                {positionsWithPnL.length === 0 && <p className="text-sm text-gray-700">No open positions</p>}
                {positionsWithPnL.map(p => (
                  <div key={p.id} className="bg-[#12121a] rounded px-3 py-2 text-xs font-mono">
                    <div className="hidden md:flex items-center gap-3">
                      <span className={`w-16 font-semibold ${p.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>{p.direction} {p.leverage}x</span>
                      <CoinIcon symbol={p.symbol} size={16} />
                      <span className="w-16 text-gray-300">{p.symbol.replace('USDT', '')}</span>
                      <span className="w-24">Size: ${formatNum(p.size_usd)}</span>
                      <span className="w-28">Entry: ${formatNum(p.entry_price)}</span>
                      <span className="w-32 text-red-400">Liq: ${formatNum(p.liquidation_price)}</span>
                      <span className={`w-28 ${p.livePnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.livePnL >= 0 ? '+' : ''}${p.livePnL.toFixed(2)} ({p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(1)}%)
                      </span>
                      <button onClick={() => handleClosePosition(p.id)}
                        className="ml-auto px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs">Close</button>
                    </div>
                    <div className="md:hidden space-y-1">
                      <div className="flex items-center gap-2">
                        <CoinIcon symbol={p.symbol} size={14} />
                        <span className="text-gray-300 font-semibold">{p.symbol.replace('USDT', '')}</span>
                        <span className={`text-xs font-semibold ${p.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>{p.direction} {p.leverage}x</span>
                        <span className={`ml-auto ${p.livePnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {p.livePnL >= 0 ? '+' : ''}${p.livePnL.toFixed(2)} ({p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="text-gray-500">
                        Size ${formatNum(p.size_usd)} · Entry ${formatNum(p.entry_price)} · <span className="text-red-400">Liq ${formatNum(p.liquidation_price)}</span>
                      </div>
                      <button onClick={() => handleClosePosition(p.id)}
                        className="w-full mt-1 px-2 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white text-xs">Close position</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trade panel column — appears first on mobile, on the right on desktop */}
        <div className="order-1 lg:order-2 space-y-4">
          {tradePanel}
          {performanceCard}
        </div>
      </div>
    </div>
  )
}