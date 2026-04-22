import { useEffect, useMemo, useState } from 'react'
import ChatWindow from '../components/ChatWindow'
import ProfileSetupModal from '../components/ProfileSetupModal'
import UserList from '../components/UserList'
import { registerPushForUser } from '../lib/pushNotifications'
import { supabase } from '../lib/supabase'

const debugLog = (hypothesisId, location, message, data) => {
  // #region agent log
  fetch('http://127.0.0.1:7708/ingest/861b4098-5a80-42fd-97fe-552d7a774d51', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'd98c06',
    },
    body: JSON.stringify({
      sessionId: 'd98c06',
      runId: 'pre-fix-1',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

function DashboardPage({ session }) {
  const currentUserId = session.user.id
  const [profiles, setProfiles] = useState([])
  const [messages, setMessages] = useState([])
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())
  const [error, setError] = useState('')
  const [pushStatus, setPushStatus] = useState('')

  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  )

  useEffect(() => {
    const loadInitialData = async () => {
      const [profilesResult, messagesResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: true }),
        supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(200),
      ])

      if (profilesResult.error) setError(profilesResult.error.message)
      if (messagesResult.error) setError(messagesResult.error.message)
      if (profilesResult.data) setProfiles(profilesResult.data)
      if (messagesResult.data) setMessages(messagesResult.data)

      const myProfile = profilesResult.data?.find((profile) => profile.id === currentUserId)
      setShowProfileSetup(!myProfile)
    }

    loadInitialData()
  }, [currentUserId])

  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-live-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        async () => {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: true })
          if (data) setProfiles(data)
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((current) => [...current, payload.new])
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const nextOnline = new Set(Object.keys(state))
        setOnlineUserIds(nextOnline)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  const handleSendMessage = async (content) => {
    // #region agent log
    debugLog('H1', 'DashboardPage.jsx:handleSendMessage:start', 'send message requested', {
      hasSessionProp: Boolean(session),
      hasSessionToken: Boolean(session?.access_token),
      contentLength: content?.length ?? 0,
    })
    // #endregion
    const { error: insertError } = await supabase.from('messages').insert({
      user_id: currentUserId,
      content,
    })
    if (insertError) {
      // #region agent log
      debugLog('H5', 'DashboardPage.jsx:handleSendMessage:insertError', 'message insert failed', {
        insertErrorMessage: insertError.message,
      })
      // #endregion
      setError(insertError.message)
      return
    }

    const {
      data: { session: activeSession },
    } = await supabase.auth.getSession()
    const accessToken = activeSession?.access_token || session?.access_token
    const tokenSource = activeSession?.access_token ? 'activeSession' : session?.access_token ? 'prop' : 'none'
    let tokenAlg = 'unknown'
    if (accessToken) {
      try {
        const tokenHeader = JSON.parse(window.atob(accessToken.split('.')[0]))
        tokenAlg = tokenHeader?.alg ?? 'missing'
      } catch {
        tokenAlg = 'decode-failed'
      }
    }
    // #region agent log
    debugLog('H1', 'DashboardPage.jsx:handleSendMessage:token', 'resolved token before invoke', {
      tokenSource,
      hasAccessToken: Boolean(accessToken),
      tokenLength: accessToken?.length ?? 0,
      tokenAlg,
    })
    // #endregion
    if (!accessToken) {
      setError('Your session expired. Please sign in again.')
      return
    }

    supabase.functions.setAuth(accessToken)
    // #region agent log
    debugLog('H2', 'DashboardPage.jsx:handleSendMessage:beforeInvoke', 'invoking send-push with explicit auth', {
      hasAuthorizationHeader: true,
      usedSetAuth: true,
      tokenAlg,
    })
    // #endregion

    const { data: pushData, error: pushError } = await supabase.functions.invoke('send-push', {
      body: { content, senderId: currentUserId },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (pushError) {
      // #region agent log
      debugLog('H3', 'DashboardPage.jsx:handleSendMessage:invokeError', 'send-push invoke returned error', {
        pushErrorName: pushError.name,
        pushErrorMessage: pushError.message,
        pushErrorContextStatus: pushError.context?.status ?? null,
        pushErrorContextBody: pushError.context?.body ?? null,
      })
      // #endregion
      console.error('send-push error', pushError)
      setError(pushError.message)
    } else {
      // #region agent log
      debugLog('H4', 'DashboardPage.jsx:handleSendMessage:invokeSuccess', 'send-push invoke succeeded', {
        pushDataType: typeof pushData,
      })
      // #endregion
      console.log('send-push ok', pushData)
    }
  }

  const handleEnableNotifications = async () => {
    setPushStatus('')
    try {
      await registerPushForUser(currentUserId)
      if (Notification.permission === 'granted') {
        setPushStatus('Notifications enabled on this device.')
      } else {
        setPushStatus('Notifications permission was not granted.')
      }
    } catch (pushRegistrationError) {
      const message =
        pushRegistrationError instanceof Error
          ? pushRegistrationError.message
          : 'Failed to enable notifications.'
      setPushStatus(message)
    }
  }

  const onProfileSaved = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) setProfiles(data)
    setShowProfileSetup(false)
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header card">
        <div>
          <h1>Friends Chat</h1>
          <p className="muted">Realtime room for your group.</p>
        </div>
        <div>
          <button type="button" onClick={handleEnableNotifications}>
            Enable notifications
          </button>
          <button type="button" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="error banner">{error}</p>}
      {pushStatus && <p className="muted">{pushStatus}</p>}

      <section className="dashboard-grid">
        <UserList profiles={profiles} onlineUserIds={onlineUserIds} currentUserId={currentUserId} />
        <ChatWindow
          messages={messages}
          profilesById={profilesById}
          currentUserId={currentUserId}
          onSendMessage={handleSendMessage}
        />
      </section>

      {showProfileSetup && (
        <ProfileSetupModal userId={currentUserId} onProfileSaved={onProfileSaved} />
      )}
    </main>
  )
}

export default DashboardPage
