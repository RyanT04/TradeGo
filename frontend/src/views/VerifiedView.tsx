import { Link } from 'react-router-dom'

interface VerifiedViewProps {
  isAuthed: boolean
}

// Landing page for the email verification link. The link is often opened in a
// different browser or session from the one used to sign up, so this page
// confirms what happened rather than silently bouncing to a login form.
export function VerifiedView({ isAuthed }: VerifiedViewProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Trade<span className="text-emerald-400">Go</span>
          </h1>
        </div>

        <div className="bg-[#12121a] border border-[#1a1a25] rounded-xl p-8">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
            <svg className="h-7 w-7 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-2">Email verified</h2>
          <p className="text-gray-400 text-sm mb-6">
            {isAuthed
              ? 'Your account is confirmed. Finish setting up your profile to start trading.'
              : 'Your account is confirmed. Sign in to finish setting up your profile.'}
          </p>

          <Link
            to={isAuthed ? '/trade' : '/login'}
            className="inline-block w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition"
          >
            {isAuthed ? 'Continue' : 'Sign in'}
          </Link>
        </div>

        <Link
          to="/"
          className="mt-6 inline-block text-sm text-gray-500 hover:text-gray-300 transition"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}