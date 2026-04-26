import { useState, useEffect } from 'react'
import { updateProfile, changePassword, resetPortfolio } from '../api'
import { AVATARS } from '../constants'
import type { User } from '../types'

interface SettingsViewProps {
  user: User | null
  onUpdate: () => void
}

export function SettingsView({ user, onUpdate }: SettingsViewProps) {
  const [username, setUsername] = useState(user?.username || '')
  const [avatar, setAvatar] = useState(user?.avatar || '🚀')
  const [profileMsg, setProfileMsg] = useState('')

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdError, setPwdError] = useState('')

  // Reset portfolio
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetBalance, setResetBalance] = useState('10000')
  const [resetClearHistory, setResetClearHistory] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    setUsername(user?.username || '')
    setAvatar(user?.avatar || '🚀')
  }, [user])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileMsg('')
    try {
      await updateProfile(username, avatar)
      setProfileMsg('Profile updated')
      onUpdate()
      setTimeout(() => setProfileMsg(''), 3000)
    } catch (err: any) {
      setProfileMsg(err.response?.data?.error || 'Failed to update profile')
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg(''); setPwdError('')
    if (newPwd !== confirmPwd) { setPwdError('New passwords do not match'); return }
    if (newPwd.length < 6) { setPwdError('Password must be at least 6 characters'); return }
    try {
      await changePassword(currentPwd, newPwd)
      setPwdMsg('Password updated')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      setTimeout(() => setPwdMsg(''), 3000)
    } catch (err: any) {
      setPwdError(err.response?.data?.error || 'Failed to update password')
    }
  }

  async function handleReset() {
    setResetError(''); setResetMsg('')
    const bal = parseFloat(resetBalance)
    if (!bal || bal <= 0) { setResetError('Balance must be greater than 0'); return }
    setResetting(true)
    try {
      await resetPortfolio(bal, resetClearHistory)
      setResetMsg(`Portfolio reset to $${bal.toLocaleString()}${resetClearHistory ? ' (history cleared)' : ''}`)
      setShowResetConfirm(false)
      onUpdate()
      setTimeout(() => setResetMsg(''), 5000)
    } catch (err: any) {
      // Show the actual backend error message to the user
      const msg = err.response?.data?.error
      if (msg) {
        setResetError(`Reset failed: ${msg}`)
      } else if (err.message) {
        setResetError(`Reset failed: ${err.message}`)
      } else {
        setResetError('Reset failed: unable to reach the server. Please try again.')
      }
    }
    setResetting(false)
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Profile */}
      <div className="bg-[#12121a] border border-[#1a1a25] rounded-lg p-5 mb-4">
        <h2 className="text-base font-medium mb-4">Profile</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-2">Avatar</label>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map(a => (
                <button type="button" key={a} onClick={() => setAvatar(a)}
                  className={`aspect-square text-2xl rounded-lg border transition ${avatar === a ? 'bg-emerald-500/10 border-emerald-500' : 'bg-[#0a0a0f] border-gray-800 hover:border-gray-700'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-2">Username</label>
            <input type="text" value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              minLength={3} maxLength={20} required
              className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
          </div>
          {profileMsg && <p className="text-sm text-emerald-400">{profileMsg}</p>}
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">Save profile</button>
        </form>
      </div>

      {/* Password */}
      <div className="bg-[#12121a] border border-[#1a1a25] rounded-lg p-5 mb-4">
        <h2 className="text-base font-medium mb-4">Change password</h2>
        <form onSubmit={savePassword} className="space-y-3">
          <input type="password" placeholder="Current password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required
            className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
          <input type="password" placeholder="New password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={6}
            className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
          <input type="password" placeholder="Confirm new password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required minLength={6}
            className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
          {pwdError && <p className="text-sm text-red-400">{pwdError}</p>}
          {pwdMsg && <p className="text-sm text-emerald-400">{pwdMsg}</p>}
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">Change password</button>
        </form>
      </div>

      {/* Reset portfolio */}
      <div className="bg-[#12121a] border border-[#1a1a25] rounded-lg p-5">
        <h2 className="text-base font-medium mb-2">Reset portfolio</h2>
        <p className="text-xs text-gray-500 mb-4">
          Start over with a fresh balance. This closes all open positions, deletes all holdings,
          and sets your balance to whatever you choose.
        </p>

        {!showResetConfirm ? (
          <button onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 bg-[#0a0a0f] hover:bg-[#1a1a25] border border-gray-800 hover:border-gray-700 rounded-lg text-sm font-medium text-gray-300 transition">
            Reset portfolio
          </button>
        ) : (
          <div className="space-y-3 bg-[#0a0a0f] border border-[#1a1a25] rounded-lg p-4">
            <p className="text-sm text-gray-400">⚠ This action cannot be undone</p>

            <div>
              <label className="text-xs text-gray-400 block mb-1">New starting balance (USD)</label>
              <input type="number" step="any" min="1" value={resetBalance}
                onChange={e => setResetBalance(e.target.value)}
                className="w-full px-3 py-2 bg-[#12121a] border border-gray-800 rounded text-sm font-mono focus:outline-none focus:border-emerald-600 transition" />
              <div className="flex gap-1 mt-2">
                {['1000', '10000', '100000'].map(v => (
                  <button key={v} onClick={() => setResetBalance(v)}
                    className="flex-1 py-1.5 bg-[#12121a] border border-gray-800 hover:border-gray-700 rounded text-xs text-gray-400 transition">
                    ${parseInt(v).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={resetClearHistory}
                onChange={e => setResetClearHistory(e.target.checked)}
                className="accent-emerald-600" />
              Also clear trade history
            </label>

            {resetError && (
              <div className="bg-red-950/40 border border-red-900/50 rounded p-3 text-sm text-red-300">
                {resetError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={handleReset} disabled={resetting}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-medium transition">
                {resetting ? 'Resetting...' : 'Confirm reset'}
              </button>
              <button onClick={() => { setShowResetConfirm(false); setResetError('') }}
                className="px-4 py-2 border border-gray-800 hover:border-gray-700 rounded-lg text-sm transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {resetMsg && <p className="mt-3 text-sm text-emerald-400">{resetMsg}</p>}
      </div>
    </div>
  )
}