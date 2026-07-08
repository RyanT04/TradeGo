export interface Ticker {
  symbol: string
  lastPrice: string
  price24hPcnt: string
  highPrice24h: string
  lowPrice24h: string
  volume24h: string
}

export interface Holding {
  symbol: string
  quantity: number
  avg_buy_price: number
}

export interface TradeLog {
  symbol: string
  side: string
  quantity: number
  price: number
  total: number
  latency_us: number
  timestamp: string
}

export interface Position {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  leverage: number
  entry_price: number
  size_usd: number
  margin_usd: number
  liquidation_price: number
  is_open: boolean
  close_price?: number
  pnl?: number
  created_at: string
  closed_at?: string
}

export interface User {
  username?: string
  avatar?: string
  email_verified?: boolean
  email?: string
}

export type View = 'trade' | 'markets' | 'settings'