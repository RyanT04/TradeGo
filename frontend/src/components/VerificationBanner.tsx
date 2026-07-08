import { useState } from 'react'
import { resendVerification } from '../api'

interface VerificationBannerProps {
  email?: string
}

export function VerificationBanner({ email }: VerificationBannerProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleResend() {
    setStatus('sending')
    try {
      await resendVerification()
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 10000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <div className="bg-amber-600/20 border-b border-amber-600/30 px-4 py-2.5 flex flex-wrap items-center justify-center gap-2 text-sm">
      <span className="text-amber-200">
        📧 Your email{email ? ` (${email})` : ''} is not verified.
      </span>
      {status === 'idle' && (
        <button onClick={handleResend}
          className="text-amber-100 underline hover:text-white transition text-sm">
          Resend verification email
        </button>
      )}
      {status === 'sending' && (
        <span className="text-amber-300 text-sm">Sending...</span>
      )}
      {status === 'sent' && (
        <span className="text-emerald-300 text-sm">✓ Verification email sent! Check your inbox.</span>
      )}
      {status === 'error' && (
        <span className="text-red-300 text-sm">Failed to send. Try again later.</span>
      )}
    </div>
  )
}