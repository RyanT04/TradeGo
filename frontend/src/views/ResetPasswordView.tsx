import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../api'

export function ResetPasswordView() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  // Password strength checks
  const hasLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordValid = hasLength && hasUpper && hasNumber

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!passwordValid) {
      setError('Password does not meet requirements')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.')
    }
    setLoading(false)
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Reset Link</h1>
          <p className="text-gray-500 mb-6">This password reset link is invalid or has expired.</p>
          <Link to="/login" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition">
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-4">Password Reset</h1>
          <p className="text-gray-400 mb-6">Your password has been updated. You can now sign in with your new password.</p>
          <Link to="/login" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition inline-block">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Trade<span className="text-emerald-400">Go</span></h1>
          <p className="text-gray-500 text-sm mt-2">Set a new password</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input type="password" placeholder="New password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
            <div className="mt-2 space-y-1">
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
          </div>
          <input type="password" placeholder="Confirm new password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#12121a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-600 transition" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button disabled={loading || !passwordValid}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-medium transition">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        <Link to="/login" className="mt-4 text-sm text-gray-500 hover:text-gray-300 w-full text-center transition block">
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}