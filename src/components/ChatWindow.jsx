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

const REPLY_PREFIX_REGEX = /^↪ תגובה ל(.+?): "([\s\S]*)"(?:\n([\s\S]*))?$/

const parseReplyContent = (content) => {
  if (!content) return { replyTo: null, body: '' }
  const match = content.match(REPLY_PREFIX_REGEX)
  if (!match) return { replyTo: null, body: content }
  return {
    replyTo: { displayName: match[1], excerpt: match[2] },
    body: match[3] || '',
  }
}

function ChatWindow({ messages, profilesById, currentUserId, onSendMessage }) {
  const LONG_PRESS_MS = 450
  const REPLY_PREVIEW_MAX_LENGTH = 60
  const [draft, setDraft] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [expandedImage, setExpandedImage] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const messagesRef = useRef(null)
  const draftInputRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const longPressTargetMessageIdRef = useRef(null)
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

  useEffect(() => {
    if (!expandedImage) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExpandedImage(null)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [expandedImage])

  useEffect(
    () => () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
    },
    [],
  )

  const handleMessagesScroll = () => {
    const nearBottom = checkNearBottom()
    setIsNearBottom(nearBottom)
    if (nearBottom) setShowJumpToLatest(false)
  }

  const formatReplyPrefix = (target) => {
    if (!target) return ''
    const excerpt =
      target.preview.length > REPLY_PREVIEW_MAX_LENGTH
        ? `${target.preview.slice(0, REPLY_PREVIEW_MAX_LENGTH)}...`
        : target.preview
    return `↪ תגובה ל${target.displayName}: "${excerpt}"`
  }

  const clearLongPressTimer = () => {
    if (!longPressTimerRef.current) return
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  const beginLongPress = (event, message, displayName) => {
    if (event.target.closest('.message-image-button')) return
    clearLongPressTimer()
    longPressTargetMessageIdRef.current = message.id
    const previewSource = message.content?.trim() || (message.image_url ? 'תמונה' : 'הודעה')
    longPressTimerRef.current = window.setTimeout(() => {
      setReplyingTo({
        id: message.id,
        displayName,
        preview: previewSource,
      })
      draftInputRef.current?.focus()
    }, LONG_PRESS_MS)
  }

  const endLongPress = (messageId) => {
    if (longPressTargetMessageIdRef.current !== messageId) return
    clearLongPressTimer()
    longPressTargetMessageIdRef.current = null
  }

  const blockMessageContextMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const send = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sendingMessage) return

    const replyPrefix = formatReplyPrefix(replyingTo)
    const composedContent = replyPrefix ? `${replyPrefix}\n${text}` : text
    setDraft('')
    setSendingMessage(true)
    try {
      await onSendMessage({ content: composedContent })
      setReplyingTo(null)
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
      const replyPrefix = formatReplyPrefix(replyingTo)
      await onSendMessage({ content: replyPrefix, imageUrl: data.publicUrl, hasImage: true })
      setReplyingTo(null)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'העלאת התמונה נכשלה.')
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <section className="card chat-window">
      <h2>צ׳אט קבוצתי</h2>

      <div
        className="messages"
        ref={messagesRef}
        onScroll={handleMessagesScroll}
        onContextMenuCapture={blockMessageContextMenu}
      >
        {sortedMessages.length === 0 && (
          <p className="muted">אין הודעות עדיין. תהיו הראשונים להגיד שלום.</p>
        )}
        {sortedMessages.map((message) => {
          const profile = profilesById.get(message.user_id)
          const mine = message.user_id === currentUserId
          const senderColorClass = mine ? '' : getSenderColorClass(message.user_id)
          const parsedContent = parseReplyContent(message.content)
          return (
            <article
              key={message.id}
              className={mine ? 'message-row mine' : `message-row ${senderColorClass}`}
              onPointerDown={(event) =>
                beginLongPress(event, message, profile?.display_name || 'משתמש לא מוכר')
              }
              onPointerUp={() => endLongPress(message.id)}
              onPointerCancel={() => endLongPress(message.id)}
              onPointerLeave={() => endLongPress(message.id)}
              onContextMenuCapture={blockMessageContextMenu}
            >
              <header>
                <strong>{profile?.display_name || 'משתמש לא מוכר'}</strong>
                <small>{new Date(message.created_at).toLocaleTimeString()}</small>
              </header>
              {parsedContent.replyTo ? (
                <div className="reply-reference" aria-label="תגובה להודעה">
                  <strong>תגובה ל{parsedContent.replyTo.displayName}</strong>
                  <span>{parsedContent.replyTo.excerpt}</span>
                </div>
              ) : null}
              {parsedContent.body ? <p>{parsedContent.body}</p> : null}
              {message.image_url ? (
                <button
                  type="button"
                  className="message-image-button"
                  onClick={() => setExpandedImage(message.image_url)}
                  onContextMenuCapture={blockMessageContextMenu}
                  aria-label="הגדלת התמונה"
                >
                  <img
                    className="message-image"
                    src={message.image_url}
                    alt="תמונה שהועלתה לצ׳אט"
                    draggable={false}
                  />
                </button>
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
        {replyingTo ? (
          <div className="replying-banner" role="status">
            <span>{formatReplyPrefix(replyingTo)}</span>
            <button type="button" className="reply-cancel-btn" onClick={() => setReplyingTo(null)}>
              ביטול
            </button>
          </div>
        ) : null}
        <div className="chat-form-top">
          <input
            ref={draftInputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="כתבו הודעה..."
            maxLength={500}
            disabled={sendingMessage}
          />
          <label className="upload-button upload-button-inline">
            {uploadingImage ? 'מעלה...' : 'תמונה'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onImageSelected}
              disabled={uploadingImage}
            />
          </label>
        </div>
        <button type="submit" className="send-button" disabled={sendingMessage}>
          {sendingMessage ? 'שולח...' : 'שליחה'}
        </button>
      </form>
      {uploadError ? <p className="error">{uploadError}</p> : null}

      {expandedImage && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setExpandedImage(null)
          }}
        >
          <button
            type="button"
            className="image-lightbox-close"
            onClick={() => setExpandedImage(null)}
            aria-label="סגירה"
          >
            X
          </button>
          <img className="image-lightbox-image" src={expandedImage} alt="תמונה מוגדלת מהצ׳אט" />
        </div>
      )}
    </section>
  )
}

export default ChatWindow
