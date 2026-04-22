import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    document.documentElement.lang = 'he'
    document.documentElement.dir = 'rtl'

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return
      if (error) {
        setSession(null)
      } else {
        setSession(data.session ?? null)
      }
      setLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return <div className="center-screen">טוען את אפליקציית הצ׳אט...</div>
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={session ? <Navigate to="/dashboard" replace /> : <AuthPage />}
      />
      <Route
        path="/dashboard"
        element={session ? <DashboardPage session={session} /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="*"
        element={<Navigate to={session ? '/dashboard' : '/auth'} replace />}
      />
    </Routes>
  )
}

export default App
