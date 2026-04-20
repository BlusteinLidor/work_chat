import { useState } from 'react'
import { supabase } from '../lib/supabase'

function ProfileSetupModal({ userId, onProfileSaved }) {
  const [displayName, setDisplayName] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!displayName.trim()) return

    setSaving(true)
    setError('')
    let avatarUrl = null

    if (avatarFile) {
      const extension = avatarFile.name.split('.').pop() || 'jpg'
      const filePath = `${userId}/${Date.now()}.${extension}`
      const uploadResult = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true })

      if (uploadResult.error) {
        setError(uploadResult.error.message)
        setSaving(false)
        return
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      avatarUrl = data.publicUrl
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      display_name: displayName.trim(),
      avatar_url: avatarUrl,
    })

    if (upsertError) {
      setError(upsertError.message)
      setSaving(false)
      return
    }

    onProfileSaved()
    setSaving(false)
  }

  return (
    <div className="modal-backdrop">
      <section className="card profile-modal">
        <h2>Complete your profile</h2>
        <p className="muted">Choose a display name and optional profile image.</p>
        <form onSubmit={saveProfile} className="auth-form">
          <label>
            Display name
            <input
              type="text"
              maxLength={40}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your chat name"
            />
          </label>
          <label>
            Profile picture (optional)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    </div>
  )
}

export default ProfileSetupModal
