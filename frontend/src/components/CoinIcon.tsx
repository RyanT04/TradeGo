import { useState } from 'react'

interface CoinIconProps {
  symbol: string  // e.g. "BTCUSDT" or "BTC"
  size?: number   // pixels, defaults to 24
  className?: string
}

// A small set of color seeds so different coins get different fallback colors
const FALLBACK_COLORS = [
  '#f7931a', '#627eea', '#f3ba2f', '#26a17b', '#345d9d',
  '#23292f', '#0033ad', '#ce4844', '#e84142', '#e6007a',
  '#375bd2', '#bfbbbb', '#345d9d', '#2775ca', '#5d6cd4',
]

function colorFor(ticker: string): string {
  let hash = 0
  for (let i = 0; i < ticker.length; i++) hash = ticker.charCodeAt(i) + ((hash << 5) - hash)
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

export function CoinIcon({ symbol, size = 24, className = '' }: CoinIconProps) {
  const ticker = symbol.replace(/USDT$/i, '').toLowerCase()
  const upper = ticker.toUpperCase()
  const [errored, setErrored] = useState(false)

  const url = `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/svg/color/${ticker}.svg`

  if (errored) {
    // Letter badge fallback
    const initials = upper.length > 3 ? upper.slice(0, 3) : upper
    const fontSize = size <= 20 ? 8 : size <= 28 ? 9 : 10
    return (
      <div
        className={`flex items-center justify-center rounded-full font-bold text-white shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: colorFor(upper),
          fontSize: `${fontSize}px`,
          lineHeight: 1,
        }}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={upper}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}