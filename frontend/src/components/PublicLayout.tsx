import { Link, NavLink, Outlet } from 'react-router-dom'

interface PublicLayoutProps {
  isAuthed: boolean
}

export function PublicLayout({ isAuthed }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur border-b border-[#1a1a25]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-8">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Trade<span className="text-emerald-400">Go</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <NavLink to="/about"
              className={({ isActive }) =>
                `transition ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`
              }>
              About
            </NavLink>
            {isAuthed && (
              <>
                <NavLink to="/markets"
                  className={({ isActive }) =>
                    `transition ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`
                  }>
                  Markets
                </NavLink>
                <NavLink to="/trade"
                  className={({ isActive }) =>
                    `transition ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`
                  }>
                  Trade
                </NavLink>
              </>
            )}
          </nav>
          <div className="ml-auto">
            {isAuthed ? (
              <Link to="/trade" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
                Open dashboard
              </Link>
            ) : (
              <Link to="/login" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[#1a1a25] py-6">
        <div className="max-w-6xl mx-auto px-6 text-xs text-gray-600 flex justify-between">
          <span>© {new Date().getFullYear()} TradeGo</span>
          <span>Built with Go · AWS · React</span>
        </div>
      </footer>
    </div>
  )
}