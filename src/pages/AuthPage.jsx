import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [isResetPassword, setIsResetPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const hasRecoveryHash =
      typeof window !== 'undefined' &&
      typeof window.location?.hash === 'string' &&
      window.location.hash.includes('type=recovery')
    const searchMode =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('mode')
        : null

    if (hasRecoveryHash || searchMode === 'reset') {
      setIsResetPassword(true)
      setIsForgotPassword(false)
      setIsSignUp(false)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetPassword(true)
        setIsForgotPassword(false)
        setIsSignUp(false)
        setError('')
        setMessage('')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const clearStatus = () => {
    setError('')
    setMessage('')
  }

  const openLogin = () => {
    setIsSignUp(false)
    setIsForgotPassword(false)
    setIsResetPassword(false)
    clearStatus()
  }

  const openSignUp = () => {
    setIsSignUp(true)
    setIsForgotPassword(false)
    setIsResetPassword(false)
    clearStatus()
  }

  const openForgotPassword = () => {
    setIsForgotPassword(true)
    setIsSignUp(false)
    setIsResetPassword(false)
    clearStatus()
  }

  const submit = async (event) => {
    event.preventDefault()
    clearStatus()
    setLoading(true)

    if (isForgotPassword) {
      const emailRedirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth?mode=reset` : undefined
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: emailRedirectTo,
      })
      if (resetError) {
        setError(resetError.message)
        setLoading(false)
        return
      }
      setMessage('שלחנו קישור לאיפוס סיסמה למייל שלכם.')
      setLoading(false)
      return
    }

    if (isResetPassword) {
      const { error: updatePasswordError } = await supabase.auth.updateUser({ password: newPassword })
      if (updatePasswordError) {
        setError(updatePasswordError.message)
        setLoading(false)
        return
      }
      setMessage('הסיסמה עודכנה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.')
      setNewPassword('')
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, '/auth')
      }
      setIsSignUp(false)
      setIsForgotPassword(false)
      setIsResetPassword(false)
      setLoading(false)
      return
    }

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
      const existingUser =
        result.data?.user &&
        Array.isArray(result.data.user.identities) &&
        result.data.user.identities.length === 0
      if (existingUser) {
        setError('האימייל הזה כבר רשום במערכת. נסו להתחבר.')
        setLoading(false)
        return
      }
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
        <p className="muted">צ'אט מסווג נאנומושן</p>

        <form onSubmit={submit} className="auth-form">
          {!isResetPassword && (
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
          )}

          {!isForgotPassword && !isResetPassword && (
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
          )}

          {isResetPassword && (
            <label>
              סיסמה חדשה
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="לפחות 6 תווים"
              />
            </label>
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? 'נא להמתין...'
              : isForgotPassword
                ? 'שליחת קישור איפוס'
                : isResetPassword
                  ? 'שמירת סיסמה חדשה'
                  : isSignUp
                    ? 'הרשמה'
                    : 'התחברות'}
          </button>
        </form>

        {message && <p className="message">{message}</p>}
        {error && <p className="error">{error}</p>}

        {!isResetPassword && !isForgotPassword && (
          <div className="auth-links">
            <button type="button" className="text-button" onClick={isSignUp ? openLogin : openSignUp}>
              {isSignUp ? 'כבר יש לכם חשבון? התחברו' : 'אין לכם חשבון? הירשמו'}
            </button>
            {!isSignUp && (
              <button type="button" className="text-button" onClick={openForgotPassword}>
                שכחתם סיסמה?
              </button>
            )}
          </div>
        )}

        {(isForgotPassword || isResetPassword) && (
          <button type="button" className="text-button" onClick={openLogin}>
            חזרה להתחברות
          </button>
        )}
      </section>
    </main>
  )
}

export default AuthPage
