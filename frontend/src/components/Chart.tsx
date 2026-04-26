import { useRef, useEffect } from 'react'
import axios from 'axios'
import type { Ticker } from '../types'

export function Chart({ symbol, interval, ticker }: { symbol: string; interval: string; ticker?: Ticker }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const lastCandleRef = useRef<any>(null)

  // Load chart only when symbol/interval actually changes
  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    async function load() {
      if (!containerRef.current) return
      const { createChart, CandlestickSeries } = await import('lightweight-charts')
      if (cancelled || !containerRef.current) return

      // Tear down any previous chart before creating a new one
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
        lastCandleRef.current = null
      }

      const chart = createChart(containerRef.current, {
        layout: { background: { color: '#0a0a0f' }, textColor: '#6b7280' },
        grid: { vertLines: { color: '#1a1a25' }, horzLines: { color: '#1a1a25' } },
        crosshair: { mode: 0 },
        rightPriceScale: { borderColor: '#1a1a25' },
        timeScale: { borderColor: '#1a1a25', timeVisible: true },
      })
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981', downColor: '#ef4444',
        borderUpColor: '#10b981', borderDownColor: '#ef4444',
        wickUpColor: '#10b981', wickDownColor: '#ef4444',
      })
      chartRef.current = chart
      seriesRef.current = series

      try {
        const { data } = await axios.get(`/api/kline?symbol=${symbol}&interval=${interval}&limit=200`)
        if (cancelled) return
        if (data?.result?.list) {
          const candles = data.result.list.map((k: string[]) => ({
            time: parseInt(k[0]) / 1000,
            open: parseFloat(k[1]), high: parseFloat(k[2]),
            low: parseFloat(k[3]), close: parseFloat(k[4]),
          })).reverse()
          series.setData(candles)
          chart.timeScale().fitContent()
          if (candles.length > 0) lastCandleRef.current = candles[candles.length - 1]
        }
      } catch {}

      const handleResize = () => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
        }
      }
      window.addEventListener('resize', handleResize)
      cleanup = () => window.removeEventListener('resize', handleResize)
    }

    load()

    return () => {
      cancelled = true
      cleanup?.()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
        lastCandleRef.current = null
      }
    }
  }, [symbol, interval])

  // Update last candle with live ticker price (no rebuild)
  useEffect(() => {
    if (!ticker || !seriesRef.current || !lastCandleRef.current) return
    const price = parseFloat(ticker.lastPrice)
    const now = Math.floor(Date.now() / 1000)
    const intervalMap: Record<string, number> = { '1': 60, '5': 300, '15': 900, '60': 3600, '240': 14400, 'D': 86400 }
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

  return <div ref={containerRef} className="w-full h-[400px]" />
}