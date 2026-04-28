import { useState, useRef, useEffect } from 'react'
import { sendChat } from '../api'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: "Hi! I'm your TradeGo assistant. Ask me anything about trading, crypto concepts, or how to use the app." },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      // Send full conversation history for context
      const apiMessages = newMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.text,
      }))
      const data = await sendChat(apiMessages)
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }])
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to get a response. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', text: errorMsg }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[340px] sm:w-[380px] max-h-[500px] bg-[#0a0a0f] border border-[#1a1a25] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a25] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <div className="text-sm font-semibold text-white">TradeGo Assistant</div>
                <div className="text-[10px] text-gray-500">Powered by Gemini</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-white transition text-lg leading-none" aria-label="Close chat">
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : 'bg-[#12121a] border border-[#1a1a25] text-gray-300 rounded-bl-sm'
                }`}>
                  {m.text.split('\n').map((line, j) => (
                    <span key={j}>
                      {line}
                      {j < m.text.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#12121a] border border-[#1a1a25] px-3 py-2 rounded-xl rounded-bl-sm text-sm text-gray-500">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
            {messages.length === 1 && !loading && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {['What is leverage?', 'How do I place a trade?', 'What are candlestick patterns?', 'How does liquidation work?'].map(q => (
                    <button key={q} onClick={() => { setInput(q); }}
                        className="px-2.5 py-1.5 bg-[#12121a] border border-[#1a1a25] hover:border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white transition">
                        {q}
                    </button>
                    ))}
                </div>
                )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#1a1a25] px-3 py-2 shrink-0">
            <div className="flex gap-2">
              <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about trading..."
                disabled={loading}
                className="flex-1 px-3 py-2 bg-[#12121a] border border-[#1a1a25] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition disabled:opacity-50" />
              <button onClick={handleSend} disabled={loading || !input.trim()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-medium transition shrink-0">
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 sm:right-6 z-50 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        aria-label={open ? 'Close chat' : 'Open chat'}
        title="Ask me anything about trading or TradeGo!">
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  )
}