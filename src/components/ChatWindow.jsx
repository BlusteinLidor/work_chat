import { useMemo, useState } from 'react'

function ChatWindow({ messages, profilesById, currentUserId, onSendMessage }) {
  const [draft, setDraft] = useState('')
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
      ),
    [messages],
  )

  const send = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    await onSendMessage(text)
    setDraft('')
  }

  return (
    <section className="card chat-window">
      <h2>Group chat</h2>

      <div className="messages">
        {sortedMessages.length === 0 && (
          <p className="muted">No messages yet. Be the first to say hi.</p>
        )}
        {sortedMessages.map((message) => {
          const profile = profilesById.get(message.user_id)
          const mine = message.user_id === currentUserId
          return (
            <article key={message.id} className={mine ? 'message-row mine' : 'message-row'}>
              <header>
                <strong>{profile?.display_name || 'Unknown user'}</strong>
                <small>{new Date(message.created_at).toLocaleTimeString()}</small>
              </header>
              <p>{message.content}</p>
            </article>
          )
        })}
      </div>

      <form className="chat-form" onSubmit={send}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type your message..."
          maxLength={500}
        />
        <button type="submit">Send</button>
      </form>
    </section>
  )
}

export default ChatWindow
