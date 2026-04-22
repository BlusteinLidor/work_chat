import { useEffect, useState } from 'react'

const fallbackAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='100%25' height='100%25' fill='%23334155'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' fill='%23e2e8f0' font-size='18' font-family='Arial'%3E%3A%29%3C/text%3E%3C/svg%3E"

function UserList({ profiles, onlineUserIds, currentUserId }) {
  const [expandedAvatar, setExpandedAvatar] = useState(null)

  useEffect(() => {
    if (!expandedAvatar) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExpandedAvatar(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [expandedAvatar])

  return (
    <>
      <section className="card user-list">
        <h2>משתתפים</h2>
        <ul>
          {profiles.map((profile) => {
            const isCurrentUser = profile.id === currentUserId
            const isOnline = onlineUserIds.has(profile.id)
            const avatarUrl = profile.avatar_url || fallbackAvatar
            const displayName = profile.display_name || 'משתמש ללא שם'

            return (
              <li key={profile.id}>
                <button
                  type="button"
                  className="avatar-button"
                  onClick={() => setExpandedAvatar({ url: avatarUrl, name: displayName })}
                  aria-label={`הגדלת תמונת הפרופיל של ${displayName}`}
                >
                  <img src={avatarUrl} alt={`תמונת הפרופיל של ${displayName}`} />
                </button>
                <div>
                  <strong>
                    {displayName}
                    {isCurrentUser ? ' (אתם)' : ''}
                  </strong>
                  <p>{isOnline ? 'מחובר/ת' : 'לא מחובר/ת'}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {expandedAvatar && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setExpandedAvatar(null)
          }}
        >
          <button
            type="button"
            className="image-lightbox-close"
            onClick={() => setExpandedAvatar(null)}
            aria-label="סגירה"
          >
            X
          </button>
          <img
            className="image-lightbox-image"
            src={expandedAvatar.url}
            alt={`תמונת פרופיל של ${expandedAvatar.name}`}
          />
        </div>
      )}
    </>
  )
}

export default UserList
