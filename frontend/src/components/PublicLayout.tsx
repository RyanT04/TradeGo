import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

interface PublicLayoutProps {
  isAuthed: boolean
  onLogout: () => void
}

export function PublicLayout({ isAuthed, onLogout }: PublicLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = (
    <>
      <NavLink to="/about"
        onClick={() => setMobileMenuOpen(false)}
        className={({ isActive }) =>
          `transition ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`
        }>
        About
      </NavLink>
      {isAuthed && (
        <>
          <NavLink to="/markets"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `transition ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`
            }>
            Markets
          </NavLink>
          <NavLink to="/trade"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `transition ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`
            }>
            Trade
          </NavLink>
        </>
      )}
    </>
  )

  function handleLogout() {
    setMobileMenuOpen(false)
    onLogout()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur border-b border-[#1a1a25]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4 sm:gap-8">
          <Link to="/" className="text-lg font-bold tracking-tight shrink-0"
            onClick={() => setMobileMenuOpen(false)}>
            Trade<span className="text-emerald-400">Go</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-6 text-sm">
            {navLinks}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {isAuthed ? (
              <>
                <Link to="/trade"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
                  Trade
                </Link>
                <button onClick={handleLogout}
                  className="hidden sm:inline px-4 py-2 border border-[#1a1a25] hover:border-gray-700 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login"
                  className="px-3 sm:px-4 py-2 border border-[#1a1a25] hover:border-gray-600 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition">
                  Sign in
                </Link>
                <Link to="/register"
                  className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
                  Register
                </Link>
              </>
            )}

            <button onClick={() => setMobileMenuOpen(o => !o)}
              className="sm:hidden text-gray-400 hover:text-white transition p-1"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}>
              {mobileMenuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="sm:hidden border-t border-[#1a1a25] bg-[#0a0a0f]">
            <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 text-sm">
              {navLinks}
              {isAuthed && (
                <button onClick={handleLogout}
                  className="text-left text-red-400 hover:text-red-300 transition">
                  Sign out
                </button>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[#1a1a25] py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-xs text-gray-600 flex flex-col sm:flex-row gap-2 sm:justify-between">
          <span>© {new Date().getFullYear()} TradeGo</span>
          <span>Built with Go · AWS · React</span>
        </div>
      </footer>
    </div>
  )
}