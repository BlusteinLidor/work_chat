const fallbackAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='100%25' height='100%25' fill='%23334155'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' fill='%23e2e8f0' font-size='18' font-family='Arial'%3E%3A%29%3C/text%3E%3C/svg%3E"

function UserList({ profiles, onlineUserIds, currentUserId }) {
  return (
    <section className="card user-list">
      <h2>People</h2>
      <ul>
        {profiles.map((profile) => {
          const isCurrentUser = profile.id === currentUserId
          const isOnline = onlineUserIds.has(profile.id)
          return (
            <li key={profile.id}>
              <img
                src={profile.avatar_url || fallbackAvatar}
                alt={`${profile.display_name}'s avatar`}
              />
              <div>
                <strong>
                  {profile.display_name}
                  {isCurrentUser ? ' (You)' : ''}
                </strong>
                <p>{isOnline ? 'Online' : 'Offline'}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default UserList
