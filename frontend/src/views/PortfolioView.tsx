import { useNavigate } from 'react-router-dom'
import { formatNum } from '../utils'
import { CoinIcon } from '../components/CoinIcon'
import type { Ticker, Holding, TradeLog, Position } from '../types'

interface PortfolioViewProps {
  tickers: Record<string, Ticker>
  balance: number
  holdings: Holding[]
  trades: TradeLog[]
  openPositions: Position[]
  setSelectedSymbol: (s: string) => void
}

export function PortfolioView({ tickers, balance, holdings, trades, openPositions, setSelectedSymbol }: PortfolioViewProps) {
  const navigate = useNavigate()

  const holdingsValue = holdings.reduce((sum, h) => {
    const cp = tickers[h.symbol] ? parseFloat(tickers[h.symbol].lastPrice) : 0
    return sum + h.quantity * cp
  }, 0)

  const holdingsPnL = holdings.reduce((sum, h) => {
    const cp = tickers[h.symbol] ? parseFloat(tickers[h.symbol].lastPrice) : 0
    return sum + (cp - h.avg_buy_price) * h.quantity
  }, 0)

  const positionsMargin = openPositions.reduce((sum, p) => sum + p.margin_usd, 0)

  const positionsPnL = openPositions.reduce((sum, p) => {
    const currentPrice = tickers[p.symbol] ? parseFloat(tickers[p.symbol].lastPrice) : p.entry_price
    const livePnL = p.direction === 'LONG'
      ? p.size_usd * ((currentPrice - p.entry_price) / p.entry_price)
      : p.size_usd * ((p.entry_price - currentPrice) / p.entry_price)
    return sum + livePnL
  }, 0)

  const totalValue = balance + holdingsValue + positionsMargin + positionsPnL
  const totalUnrealisedPnL = holdingsPnL + positionsPnL

  const realisedFromTrades = trades.reduce((sum, t) => {
    return t.side === 'SELL' ? sum + t.total : sum - t.total
  }, 0)

  function jumpToTrade(symbol: string) {
    setSelectedSymbol(symbol)
    navigate('/trade')
  }

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Portfolio</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">Total value</div>
          <div className="text-2xl font-bold font-mono">${formatNum(totalValue)}</div>
          <div className="text-xs text-gray-600 mt-1">Cash + holdings + positions</div>
        </div>

        <div className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">Available cash</div>
          <div className="text-2xl font-bold font-mono">${formatNum(balance)}</div>
          <div className="text-xs text-gray-600 mt-1">Free to trade</div>
        </div>

        <div className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">Unrealised PnL</div>
          <div className={`text-2xl font-bold font-mono ${totalUnrealisedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalUnrealisedPnL >= 0 ? '+' : ''}${formatNum(totalUnrealisedPnL)}
          </div>
          <div className="text-xs text-gray-600 mt-1">Holdings + open positions</div>
        </div>

        <div className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">Trades placed</div>
          <div className="text-2xl font-bold font-mono">{trades.length}</div>
          <div className="text-xs text-gray-600 mt-1">
            Net cash flow: <span className={realisedFromTrades >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {realisedFromTrades >= 0 ? '+' : ''}${formatNum(realisedFromTrades)}
            </span>
          </div>
        </div>
      </div>

      {/* Holdings */}
      <section className="mb-6">
        <h2 className="text-base font-semibold mb-3">Holdings ({holdings.length})</h2>
        {holdings.length === 0 ? (
          <p className="text-sm text-gray-600">No holdings. Start trading to build your portfolio.</p>
        ) : (
          <div className="space-y-1">
            {holdings.map(h => {
              const cp = tickers[h.symbol] ? parseFloat(tickers[h.symbol].lastPrice) : 0
              const value = h.quantity * cp
              const pnl = (cp - h.avg_buy_price) * h.quantity
              const pnlPct = h.avg_buy_price > 0 ? ((cp - h.avg_buy_price) / h.avg_buy_price) * 100 : 0
              return (
                <div key={h.symbol} className="flex items-center gap-3 bg-[#12121a] border border-[#1a1a25] rounded-lg px-4 py-3 text-sm font-mono">
                  <CoinIcon symbol={h.symbol} size={20} />
                  <span className="w-20 text-gray-300 font-semibold">{h.symbol.replace('USDT', '')}</span>
                  <span className="w-32">Qty: {h.quantity}</span>
                  <span className="w-40">Avg: ${formatNum(h.avg_buy_price)}</span>
                  <span className="w-32">Now: ${formatNum(cp)}</span>
                  <span className="w-32">Value: ${formatNum(value)}</span>
                  <span className={`w-40 ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                  </span>
                  <button onClick={() => jumpToTrade(h.symbol)}
                    className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded text-xs font-medium transition">
                    Trade
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Open positions */}
      <section className="mb-6">
        <h2 className="text-base font-semibold mb-3">Open positions ({openPositions.length})</h2>
        {openPositions.length === 0 ? (
          <p className="text-sm text-gray-600">No open leveraged positions.</p>
        ) : (
          <div className="space-y-1">
            {openPositions.map(p => {
              const currentPrice = tickers[p.symbol] ? parseFloat(tickers[p.symbol].lastPrice) : p.entry_price
              const livePnL = p.direction === 'LONG'
                ? p.size_usd * ((currentPrice - p.entry_price) / p.entry_price)
                : p.size_usd * ((p.entry_price - currentPrice) / p.entry_price)
              const pnlPct = (livePnL / p.margin_usd) * 100
              return (
                <div key={p.id} className="flex items-center gap-3 bg-[#12121a] border border-[#1a1a25] rounded-lg px-4 py-3 text-sm font-mono">
                  <span className={`w-20 font-semibold ${p.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {p.direction} {p.leverage}x
                  </span>
                  <CoinIcon symbol={p.symbol} size={20} />
                  <span className="w-20 text-gray-300">{p.symbol.replace('USDT', '')}</span>
                  <span className="w-32">Size: ${formatNum(p.size_usd)}</span>
                  <span className="w-32">Margin: ${formatNum(p.margin_usd)}</span>
                  <span className="w-36">Entry: ${formatNum(p.entry_price)}</span>
                  <span className="w-36 text-red-400">Liq: ${formatNum(p.liquidation_price)}</span>
                  <span className={`w-40 ${livePnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {livePnL >= 0 ? '+' : ''}${livePnL.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent trades */}
      <section>
        <h2 className="text-base font-semibold mb-3">Recent trades ({trades.length})</h2>
        {trades.length === 0 ? (
          <p className="text-sm text-gray-600">No trades yet.</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {trades.slice(0, 20).map((t, i) => (
              <div key={i} className="flex items-center gap-3 bg-[#12121a] border border-[#1a1a25] rounded-lg px-4 py-2.5 text-xs font-mono">
                <span className={`w-12 font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</span>
                <CoinIcon symbol={t.symbol} size={16} />
                <span className="w-20 text-gray-300">{t.symbol.replace('USDT', '')}</span>
                <span className="w-24">{t.quantity}</span>
                <span className="w-32">@ ${t.price.toLocaleString()}</span>
                <span className="w-32">${t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="ml-auto text-gray-600">{t.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}