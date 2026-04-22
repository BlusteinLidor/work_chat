import { useEffect, useMemo, useState } from 'react'
import ChatWindow from '../components/ChatWindow'
import ProfileSetupModal from '../components/ProfileSetupModal'
import UserList from '../components/UserList'
import { registerPushForUser } from '../lib/pushNotifications'
import { supabase } from '../lib/supabase'

function DashboardPage({ session }) {
  const currentUserId = session.user.id
  const [profiles, setProfiles] = useState([])
  const [messages, setMessages] = useState([])
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())
  const [error, setError] = useState('')
  const [pushStatus, setPushStatus] = useState('')
  const [hasAutoPushAttempted, setHasAutoPushAttempted] = useState(false)
  const [showParticipantsOnMobile, setShowParticipantsOnMobile] = useState(false)

  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  )
  const currentUserProfile = profilesById.get(currentUserId) || null

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
      .channel('dashboard-live', {
        config: {
          presence: {
            key: currentUserId,
          },
        },
      })
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
        const nextOnline = new Set()
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (typeof presence?.user_id === 'string') {
              nextOnline.add(presence.user_id)
            }
          })
        })
        setOnlineUserIds(nextOnline)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          })
        } else if (status === 'CHANNEL_ERROR') {
          setError('לא הצלחנו להתחבר לסטטוס אונליין בזמן אמת.')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  useEffect(() => {
    if (hasAutoPushAttempted) return
    let isMounted = true

    const autoEnableNotifications = async () => {
      setHasAutoPushAttempted(true)
      try {
        await registerPushForUser(currentUserId)
        if (!isMounted) return
        if (Notification.permission === 'granted') {
          setPushStatus('ההתראות הופעלו במכשיר הזה.')
        } else if (Notification.permission === 'denied') {
          setPushStatus('ההרשאה להתראות חסומה בדפדפן. אפשר לנסות שוב.')
        }
      } catch (pushRegistrationError) {
        if (!isMounted) return
        const message =
          pushRegistrationError instanceof Error ? pushRegistrationError.message : 'הפעלת ההתראות נכשלה.'
        setPushStatus(message)
      }
    }

    autoEnableNotifications()
    return () => {
      isMounted = false
    }
  }, [currentUserId, hasAutoPushAttempted])

  const handleSendMessage = async ({ content, imageUrl, hasImage = false }) => {
    const normalizedContent = typeof content === 'string' ? content.trim() : ''
    const normalizedImageUrl = typeof imageUrl === 'string' ? imageUrl : null
    const { error: insertError } = await supabase.from('messages').insert({
      user_id: currentUserId,
      content: normalizedContent || null,
      image_url: normalizedImageUrl,
    })
    if (insertError) {
      setError(insertError.message)
      return
    }

    const {
      data: { session: activeSession },
    } = await supabase.auth.getSession()
    const accessToken = activeSession?.access_token || session?.access_token
    if (!accessToken) {
      setError('הסשן פג תוקף. התחברו מחדש.')
      return
    }

    supabase.functions.setAuth(accessToken)

    const { data: pushData, error: pushError } = await supabase.functions.invoke('send-push', {
      body: { content: normalizedContent, senderId: currentUserId, hasImage, imageUrl: normalizedImageUrl },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (pushError) {
      console.error('send-push error', pushError)
      setError(pushError.message)
    } else {
      console.log('send-push ok', pushData)
    }
  }

  const handleEnableNotifications = async () => {
    setPushStatus('')
    try {
      await registerPushForUser(currentUserId)
      if (Notification.permission === 'granted') {
        setPushStatus('ההתראות הופעלו במכשיר הזה.')
      } else {
        setPushStatus('לא התקבלה הרשאה להתראות.')
      }
    } catch (pushRegistrationError) {
      const message =
        pushRegistrationError instanceof Error
          ? pushRegistrationError.message
          : 'הפעלת ההתראות נכשלה.'
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
          <h1>צ׳אט חברים</h1>
          <p className="muted">נאנומושן מסווג</p>
        </div>
        <div className="dashboard-actions">
          <button type="button" onClick={() => setShowProfileSetup(true)}>
            עריכת פרופיל
          </button>
          <button type="button" onClick={handleEnableNotifications}>
            הפעלת התראות
          </button>
          <button type="button" onClick={() => supabase.auth.signOut()}>
            התנתקות
          </button>
        </div>
      </header>

      {error && <p className="error banner">{error}</p>}
      {pushStatus && <p className="muted">{pushStatus}</p>}

      <button
        type="button"
        className="participants-toggle"
        onClick={() => setShowParticipantsOnMobile((current) => !current)}
        aria-expanded={showParticipantsOnMobile}
        aria-controls="participants-panel"
      >
        {showParticipantsOnMobile ? 'הסתרת משתתפים' : 'הצגת משתתפים'} ({onlineUserIds.size}/{profiles.length})
      </button>

      <section className="dashboard-grid">
        <div
          id="participants-panel"
          className={showParticipantsOnMobile ? 'participants-panel open' : 'participants-panel'}
        >
          <UserList profiles={profiles} onlineUserIds={onlineUserIds} currentUserId={currentUserId} />
        </div>
        <ChatWindow
          messages={messages}
          profilesById={profilesById}
          currentUserId={currentUserId}
          onSendMessage={handleSendMessage}
        />
      </section>

      {showProfileSetup && (
        <ProfileSetupModal
          userId={currentUserId}
          onProfileSaved={onProfileSaved}
          initialDisplayName={currentUserProfile?.display_name || ''}
          initialAvatarUrl={currentUserProfile?.avatar_url || ''}
          title={currentUserProfile ? 'עריכת פרופיל' : 'השלמת פרופיל'}
          submitLabel={currentUserProfile ? 'שמירת שינויים' : 'שמירת פרופיל'}
          onCancel={currentUserProfile ? () => setShowProfileSetup(false) : undefined}
        />
      )}
    </main>
  )
}

export default DashboardPage
