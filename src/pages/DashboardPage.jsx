import { useEffect, useMemo, useState } from 'react'
import ChatWindow from '../components/ChatWindow'
import ProfileSetupModal from '../components/ProfileSetupModal'
import UserList from '../components/UserList'
import { supabase } from '../lib/supabase'

function DashboardPage({ session }) {
  const currentUserId = session.user.id
  const [profiles, setProfiles] = useState([])
  const [messages, setMessages] = useState([])
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())
  const [error, setError] = useState('')

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
    const { error: insertError } = await supabase.from('messages').insert({
      user_id: currentUserId,
      content,
    })
    if (insertError) setError(insertError.message)
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
        <button type="button" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      {error && <p className="error banner">{error}</p>}

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
