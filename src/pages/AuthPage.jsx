import { useState } from 'react'
import { supabase } from '../lib/supabase'

function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const payload = { email, password }
    const result = isSignUp
      ? await supabase.auth.signUp(payload)
      : await supabase.auth.signInWithPassword(payload)

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    if (isSignUp) {
      setMessage('Account created. Check your inbox if email confirmation is enabled.')
    } else {
      setMessage('Signed in successfully.')
    }

    setLoading(false)
  }

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <h1>Friends Chat</h1>
        <p className="muted">Fast realtime chat for your group.</p>

        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        {message && <p className="message">{message}</p>}
        {error && <p className="error">{error}</p>}

        <button
          type="button"
          className="text-button"
          onClick={() => setIsSignUp((current) => !current)}
        >
          {isSignUp ? 'Already have an account? Log in' : "Need an account? Sign up"}
        </button>
      </section>
    </main>
  )
}

export default AuthPage
