import { NavLink } from 'react-router-dom'
import type { User } from '../types'

interface SidebarProps {
  user: User | null
  balance: number
  onLogout: () => void
}

export function Sidebar({ user, balance, onLogout }: SidebarProps) {
  const items = [
    { path: '/trade', label: 'Trade', icon: '📊' },
    { path: '/portfolio', label: 'Portfolio', icon: '💼' },
    { path: '/markets', label: 'Markets', icon: '🌐' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <aside className="w-56 bg-[#0a0a0f] border-r border-[#1a1a25] flex flex-col h-screen sticky top-0">
      <div className="p-5">
        <NavLink to="/trade" className="text-lg font-bold tracking-tight">
          Trade<span className="text-emerald-400">Go</span>
        </NavLink>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {items.map(item => (
          <NavLink key={item.path} to={item.path}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-[#1a1a25] text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-[#12121a]'}`
            }>
            <span>{item.icon}</span><span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-[#1a1a25] space-y-3">
        {user && user.username && (
          <div className="flex items-center gap-2 px-2">
            <span className="text-xl">{user.avatar}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white truncate">{user.username}</div>
              <div className="text-xs text-gray-500 font-mono">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        )}
        <button onClick={onLogout} className="w-full px-3 py-2 text-xs text-gray-500 hover:text-white text-left transition">
          Logout
        </button>
      </div>
    </aside>
  )
}