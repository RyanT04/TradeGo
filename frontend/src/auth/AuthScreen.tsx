import { useState } from 'react'
import { setToken, login, register, updateProfile, setStartingBalance, forgotPassword } from '../api'
import { AVATARS } from '../constants'

type Step = 'auth' | 'verify' | 'profile' | 'balance' | 'forgot'

interface AuthScreenProps {
  onComplete: (token: string, isNewUser: boolean) => void
  initialMode?: 'login' | 'register'
  // Lets an already-authenticated user be dropped straight into the middle of
  // the flow, e.g. after clicking an email verification link.
  initialStep?: Step
  existingToken?: string
}

export function AuthScreen({
  onComplete,
  initialMode = 'register',
  initialStep = 'auth',
  existingToken = '',
}: AuthScreenProps) {
  const [step, setStep] = useState<Step>(initialStep)
  const [token, setLocalToken] = useState(existingToken)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isRegister, setIsRegister] = useState(initialMode === 'register')
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [avatar, setAvatar] = useState('🚀')
  const [selectedBalance, setSelectedBalance] = useState<number | null>(null)

  const balanceOptions = [
    { value: 1000, label: '$1,000', subtitle: 'Small portfolio' },
    { value: 10000, label: '$10,000', subtitle: 'Balanced (recommended)' },
    { value: 100000, label: '$100,000', subtitle: 'High roller' },
  ]

  // Password strength checks
  const hasLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (isRegister && password !== confirmPassword) { setError('Passwords do not match'); return }
    try {
      const data = isRegister ? await register(email, password) : await login(email, password)
      localStorage.setItem('token', data.token); setToken(data.token); setLocalToken(data.token)
      if (data.user.onboarded) onComplete(data.token, false)
      else if (isRegister) setStep('verify')
      else setStep('profile')
    } catch (err: any) {
      const e = err.response?.data?.error
      setError(e ? e.charAt(0).toUpperCase() + e.slice(1) : 'Authentication failed')
    }
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault(); setError('')
    try { await updateProfile(username, avatar); setStep('balance') }
    catch (err: any) { setError(err.response?.data?.error || 'Failed to update profile') }
  }

  async function handleBalance() {
    if (!selectedBalance) return; setError('')
    try { await setStartingBalance(selectedBalance); onComplete(token, true) }
    catch (err: any) { setError(err.response?.data?.error || 'Failed to set balance') }
  }

  // ── Forgot password screen ──
    if (step === 'forgot') return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Trade<span className="text-emerald-400">Go</span></h1>
            <p className="text-gray-500 text-sm mt-2">Reset your password</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault(); setError('')
            try {
              await forgotPassword(email)
              setError('Reset link sent! Check your inbox.')
            } catch (err: any) {
              setError(err.response?.data?.error || 'Failed to send reset email')
            }
          }} className="space-y-3">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
            {error && <p className={`text-sm ${error.includes('sent') ? 'text-emerald-400' : 'text-red-400'}`}>{error}</p>}
            <button className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
              Send Reset Link
            </button>
          </form>
          <button onClick={() => { setStep('auth'); setIsRegister(false); setError('') }}
            className="mt-4 text-sm text-gray-500 hover:text-gray-300 w-full text-center transition">
            Back to Sign In
          </button>
        </div>
      </div>
    )

    // ── Verify email screen ──
    if (step === 'verify') return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
          <div className="h-1.5 w-8 bg-gray-700 rounded-full" />
          <div className="h-1.5 w-8 bg-gray-700 rounded-full" />
        </div>
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-2xl font-bold mb-2">Verify your email</h2>
          <p className="text-gray-400 text-sm mt-1">
            We sent a verification link to <span className="text-white font-mono">{email}</span>
          </p>
        </div>
        <div className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-6 text-center space-y-4">
          <p className="text-sm text-gray-400">Click the link in your inbox to continue. Check your spam folder too.</p>
          <button onClick={async () => {
            try {
              const { resendVerification } = await import('../api')
              await resendVerification()
              setError('Verification email sent!')
              setTimeout(() => setError(''), 5000)
            } catch { setError('Failed to send. Try again later.') }
          }}
            className="px-4 py-2 bg-[#0a0a0f] hover:bg-[#1a1a25] border border-gray-800 hover:border-gray-700 rounded-lg text-sm font-medium text-gray-300 transition">
            Resend verification email
          </button>
          {error && <p className={`text-sm ${error.includes('sent') ? 'text-emerald-400' : 'text-red-400'}`}>{error}</p>}
        </div>
        <button onClick={() => setStep('profile')}
          className="mt-6 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
          Continue to profile setup
        </button>
        <p className="text-xs text-gray-600 text-center mt-2">You can verify later, but trading will be locked until you do</p>
      </div>
    </div>
  )

  // ── Auth screen (login / register) ──
  if (step === 'auth') return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Trade<span className="text-emerald-400">Go</span></h1>
          <p className="text-gray-500 text-sm mt-2">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </p>
        </div>
        <form onSubmit={handleAuth} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
          {isRegister && (
            <>
              <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
              {password.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className={`text-xs ${hasLength ? 'text-emerald-400' : 'text-gray-600'}`}>
                    {hasLength ? '✓' : '○'} At least 8 characters
                  </div>
                  <div className={`text-xs ${hasUpper ? 'text-emerald-400' : 'text-gray-600'}`}>
                    {hasUpper ? '✓' : '○'} At least 1 uppercase letter
                  </div>
                  <div className={`text-xs ${hasNumber ? 'text-emerald-400' : 'text-gray-600'}`}>
                    {hasNumber ? '✓' : '○'} At least 1 number
                  </div>
                </div>
              )}
            </>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        {!isRegister && (
          <button onClick={() => { setStep('forgot'); setError('') }}
            className="mt-3 text-sm text-gray-500 hover:text-emerald-400 w-full text-center transition">
            Forgot your password?
          </button>
        )}
        <button onClick={() => { setIsRegister(!isRegister); setError(''); setPassword(''); setConfirmPassword('') }}
          className="mt-4 text-sm text-gray-500 hover:text-gray-300 w-full text-center transition">
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
        </button>
      </div>
    </div>
  )

  // ── Profile setup ──
  if (step === 'profile') return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
          <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
          <div className="h-1.5 w-8 bg-gray-700 rounded-full" />
        </div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">Set up your profile</h2>
          <p className="text-gray-500 text-sm mt-1">Choose a username and avatar</p>
        </div>
        <form onSubmit={handleProfile} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-2">Avatar</label>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map(a => (
                <button type="button" key={a} onClick={() => setAvatar(a)}
                  className={`aspect-square text-2xl rounded-lg border transition ${avatar === a ? 'bg-emerald-500/10 border-emerald-500' : 'bg-[#12121a] border-gray-800 hover:border-gray-700'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-2">Username</label>
            <input type="text" placeholder="cryptotrader123" value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              minLength={3} maxLength={20} required
              className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
            <p className="text-xs text-gray-600 mt-1">3-20 characters, lowercase, no spaces</p>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">Continue</button>
        </form>
      </div>
    </div>
  )

  // ── Balance selection ──
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
          <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
          <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
        </div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">Choose your starting balance</h2>
          <p className="text-gray-500 text-sm mt-1">This is virtual money for practice trading</p>
        </div>
        <div className="space-y-2">
          {balanceOptions.map(opt => (
            <button key={opt.value} onClick={() => setSelectedBalance(opt.value)}
              className={`w-full p-4 rounded-lg border text-left transition ${selectedBalance === opt.value ? 'bg-emerald-500/10 border-emerald-500' : 'bg-[#12121a] border-gray-800 hover:border-gray-700'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-bold">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.subtitle}</div>
                </div>
                {selectedBalance === opt.value && (
                  <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-black" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        <button onClick={handleBalance} disabled={!selectedBalance}
          className="w-full mt-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition">
          Start Trading
        </button>
      </div>
    </div>
  )
}