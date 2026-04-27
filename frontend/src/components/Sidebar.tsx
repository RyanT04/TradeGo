import { NavLink } from 'react-router-dom'
import type { User } from '../types'

interface SidebarProps {
  user: User | null
  balance: number
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ user, balance, isOpen, onClose }: SidebarProps) {
  const items = [
    { path: '/about', label: 'About', icon: 'ℹ️' },
    { path: '/trade', label: 'Trade', icon: '📊' },
    { path: '/portfolio', label: 'Portfolio', icon: '💼' },
    { path: '/markets', label: 'Markets', icon: '🌐' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <>
      {/* Backdrop on mobile when open */}
      {isOpen && (
        <div
          onClick={onClose}
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
        />
      )}

      {/* Sidebar — fixed/slide on small screens, sticky on lg+ */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50
          w-56 h-screen bg-[#0a0a0f] border-r border-[#1a1a25]
          flex flex-col
          transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-5 flex items-center justify-between">
          <NavLink to="/" onClick={onClose} className="text-lg font-bold tracking-tight" title="Home">
            Trade<span className="text-emerald-400">Go</span>
          </NavLink>
          <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-white" aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {items.map(item => (
            <NavLink key={item.path} to={item.path} onClick={onClose}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-[#1a1a25] text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-[#12121a]'}`
              }>
              <span>{item.icon}</span><span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-[#1a1a25]">
          {user && user.username && (
            <div className="flex items-center gap-2 px-2">
              <span className="text-xl">{user.avatar}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{user.username}</div>
                <div className="text-xs text-gray-500 font-mono">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}