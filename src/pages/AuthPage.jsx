import { useState } from 'react'
import { supabase } from '../lib/supabase'

function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
//
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
    const payload = isSignUp
      ? {
          email,
          password,
          options: {
            emailRedirectTo,
          },
        }
      : { email, password }
    const result = isSignUp
      ? await supabase.auth.signUp(payload)
      : await supabase.auth.signInWithPassword(payload)

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    if (isSignUp) {
      setMessage('החשבון נוצר. אם אימות מייל פעיל, בדקו את תיבת הדואר שלכם.')
    } else {
      setMessage('התחברתם בהצלחה.')
    }

    setLoading(false)
  }

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <h1>צ׳אט חברים</h1>
        <p className="muted">צ׳אט מהיר בזמן אמת לקבוצה שלכם.</p>

        <form onSubmit={submit} className="auth-form">
          <label>
            אימייל
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            סיסמה
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="לפחות 6 תווים"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'נא להמתין...' : isSignUp ? 'הרשמה' : 'התחברות'}
          </button>
        </form>

        {message && <p className="message">{message}</p>}
        {error && <p className="error">{error}</p>}

        <button
          type="button"
          className="text-button"
          onClick={() => setIsSignUp((current) => !current)}
        >
          {isSignUp ? 'כבר יש לכם חשבון? התחברו' : 'אין לכם חשבון? הירשמו'}
        </button>
      </section>
    </main>
  )
}

export default AuthPage
