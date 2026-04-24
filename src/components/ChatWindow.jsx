import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const SENDER_COLOR_VARIANTS = 12

const getSenderColorClass = (userId) => {
  if (!userId) return 'sender-color-1'
  let hash = 0
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(index)
    hash |= 0
  }
  const normalized = Math.abs(hash) % SENDER_COLOR_VARIANTS
  return `sender-color-${normalized + 1}`
}

function ChatWindow({ messages, profilesById, currentUserId, onSendMessage }) {
  const [draft, setDraft] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const messagesRef = useRef(null)
  const previousMessageCountRef = useRef(0)
  const initialScrollDoneRef = useRef(false)

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
      ),
    [messages],
  )

  const scrollToBottom = () => {
    const container = messagesRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }

  const checkNearBottom = () => {
    const container = messagesRef.current
    if (!container) return true
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceFromBottom < 80
  }

  useEffect(() => {
    if (!messagesRef.current) return
    if (!initialScrollDoneRef.current) {
      scrollToBottom()
      initialScrollDoneRef.current = true
      previousMessageCountRef.current = sortedMessages.length
      return
    }

    const hasNewMessages = sortedMessages.length > previousMessageCountRef.current
    previousMessageCountRef.current = sortedMessages.length
    if (!hasNewMessages) return

    if (isNearBottom) {
      scrollToBottom()
      setShowJumpToLatest(false)
      return
    }

    setShowJumpToLatest(true)
  }, [sortedMessages, isNearBottom])

  const handleMessagesScroll = () => {
    const nearBottom = checkNearBottom()
    setIsNearBottom(nearBottom)
    if (nearBottom) setShowJumpToLatest(false)
  }

  const send = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sendingMessage) return

    setDraft('')
    setSendingMessage(true)
    try {
      await onSendMessage({ content: text })
    } catch (error) {
      setDraft(text)
      setUploadError(error instanceof Error ? error.message : 'שליחת ההודעה נכשלה.')
    } finally {
      setSendingMessage(false)
    }
  }

  const onImageSelected = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploadingImage(true)
    setUploadError('')
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeBaseName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 50)
    const filePath = `${currentUserId}/${Date.now()}-${safeBaseName}.${extension}`

    try {
      const { error: uploadErrorResult } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file, { upsert: false })

      if (uploadErrorResult) {
        setUploadError(uploadErrorResult.message)
        return
      }

      const { data } = supabase.storage.from('chat-images').getPublicUrl(filePath)
      await onSendMessage({ content: '', imageUrl: data.publicUrl, hasImage: true })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'העלאת התמונה נכשלה.')
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <section className="card chat-window">
      <h2>צ׳אט קבוצתי</h2>

      <div className="messages" ref={messagesRef} onScroll={handleMessagesScroll}>
        {sortedMessages.length === 0 && (
          <p className="muted">אין הודעות עדיין. תהיו הראשונים להגיד שלום.</p>
        )}
        {sortedMessages.map((message) => {
          const profile = profilesById.get(message.user_id)
          const mine = message.user_id === currentUserId
          const senderColorClass = mine ? '' : getSenderColorClass(message.user_id)
          return (
            <article
              key={message.id}
              className={mine ? 'message-row mine' : `message-row ${senderColorClass}`}
            >
              <header>
                <strong>{profile?.display_name || 'משתמש לא מוכר'}</strong>
                <small>{new Date(message.created_at).toLocaleTimeString()}</small>
              </header>
              {message.content ? <p>{message.content}</p> : null}
              {message.image_url ? (
                <img className="message-image" src={message.image_url} alt="תמונה שהועלתה לצ׳אט" />
              ) : null}
            </article>
          )
        })}
      </div>
      {showJumpToLatest ? (
        <button type="button" className="text-button jump-to-latest" onClick={scrollToBottom}>
          מעבר להודעות החדשות
        </button>
      ) : null}

      <form className="chat-form" onSubmit={send}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="כתבו הודעה..."
          maxLength={500}
          disabled={sendingMessage}
        />
        <label className="upload-button">
          {uploadingImage ? 'מעלה...' : 'תמונה'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onImageSelected}
            disabled={uploadingImage}
          />
        </label>
        <button type="submit" disabled={sendingMessage}>
          {sendingMessage ? 'שולח...' : 'שליחה'}
        </button>
      </form>
      {uploadError ? <p className="error">{uploadError}</p> : null}
    </section>
  )
}

export default ChatWindow
