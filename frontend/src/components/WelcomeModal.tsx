import { useState } from 'react'

interface WelcomeModalProps {
  open: boolean
  onClose: (permanent: boolean) => void
}

const tips = [
  {
    icon: '📊',
    title: 'Trade live coins, risk-free',
    body: 'Pick from 460+ coins. Buy and sell against real Bybit prices using virtual money. Your portfolio updates instantly. Note: unlike real exchanges, there are no trading fees or slippage, so results may differ slightly from live trading.',
  },
  {
    icon: '⚡',
    title: 'Leverage carefully',
    body: 'Open 2x–50x long or short positions. If price moves against you past your liquidation point, the position closes automatically and your margin is gone.',
  },
  {
    icon: '🔄',
    title: 'Reset whenever you want',
    body: 'Blew up your account? Settings → Reset portfolio. Pick a new starting balance and try again. There\'s no penalty.',
  },
  {
    icon: '⏱',
    title: 'Watch the latency',
    body: 'Every trade reports its execution time in microseconds. The Performance card on the trade page tracks min/max/avg across your session.',
  },
  {
  icon: '🤖',
  title: 'Ask the AI assistant',
  body: 'Tap the green chat bubble in the bottom-right corner to ask questions about trading concepts, crypto strategies, or how to use TradeGo. It\'s always there to help.',
  },
]


export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0a0a0f] border border-[#1a1a25] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-block px-3 py-1 mb-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300">
              Welcome to TradeGo
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Here's how it works</h2>
            <p className="text-sm text-gray-400">A quick 30-second tour before you start trading.</p>
          </div>

          <div className="space-y-3 mb-6">
            {tips.map((t, i) => (
              <div key={i} className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-4 flex gap-3 items-start">
                <div className="text-2xl shrink-0">{t.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold mb-1 text-white">{t.title}</h3>
                  <p className="text-xs text-gray-300 leading-relaxed">{t.body}</p>
                </div>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer mb-4">
            <input type="checkbox" checked={dontShowAgain} onChange={e => setDontShowAgain(e.target.checked)}
              className="accent-emerald-600" />
            Don't show this again
          </label>
          <button onClick={() => onClose(dontShowAgain)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
            Got it, let's trade
          </button>
        </div>
      </div>
    </div>
  )
}