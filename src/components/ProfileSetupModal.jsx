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
    const { data: authData } = await supabase.auth.getUser()
    const authUserId = authData?.user?.id ?? null
    // #region agent log
    fetch('http://127.0.0.1:7708/ingest/861b4098-5a80-42fd-97fe-552d7a774d51',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'590e44'},body:JSON.stringify({sessionId:'590e44',runId:'initial',hypothesisId:'H1',location:'src/components/ProfileSetupModal.jsx:20',message:'saveProfile started',data:{propUserId:userId,authUserId,hasAvatarFile:Boolean(avatarFile),displayNameLength:displayName.trim().length},timestamp:Date.now()})}).catch(()=>{})
    // #endregion

    if (avatarFile) {
      const extension = avatarFile.name.split('.').pop() || 'jpg'
      const filePath = `${userId}/${Date.now()}.${extension}`
      // #region agent log
      fetch('http://127.0.0.1:7708/ingest/861b4098-5a80-42fd-97fe-552d7a774d51',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'590e44'},body:JSON.stringify({sessionId:'590e44',runId:'initial',hypothesisId:'H2',location:'src/components/ProfileSetupModal.jsx:27',message:'about to upload avatar',data:{bucket:'avatars',filePath,fileType:avatarFile.type,fileSize:avatarFile.size},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      const uploadResult = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true })
      // #region agent log
      fetch('http://127.0.0.1:7708/ingest/861b4098-5a80-42fd-97fe-552d7a774d51',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'590e44'},body:JSON.stringify({sessionId:'590e44',runId:'initial',hypothesisId:'H2',location:'src/components/ProfileSetupModal.jsx:33',message:'avatar upload result',data:{hasError:Boolean(uploadResult.error),errorMessage:uploadResult.error?.message ?? null,errorCode:uploadResult.error?.statusCode ?? null,path:uploadResult.data?.path ?? null},timestamp:Date.now()})}).catch(()=>{})
      // #endregion

      if (uploadResult.error) {
        setError(uploadResult.error.message)
        setSaving(false)
        return
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      avatarUrl = data.publicUrl
      // #region agent log
      fetch('http://127.0.0.1:7708/ingest/861b4098-5a80-42fd-97fe-552d7a774d51',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'590e44'},body:JSON.stringify({sessionId:'590e44',runId:'initial',hypothesisId:'H3',location:'src/components/ProfileSetupModal.jsx:43',message:'generated avatar public url',data:{avatarUrl},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      display_name: displayName.trim(),
      avatar_url: avatarUrl,
    })
    // #region agent log
    fetch('http://127.0.0.1:7708/ingest/861b4098-5a80-42fd-97fe-552d7a774d51',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'590e44'},body:JSON.stringify({sessionId:'590e44',runId:'initial',hypothesisId:'H4',location:'src/components/ProfileSetupModal.jsx:53',message:'profile upsert result',data:{hasError:Boolean(upsertError),errorMessage:upsertError?.message ?? null,errorCode:upsertError?.code ?? null,userId,authUserId,hasAvatarUrl:Boolean(avatarUrl)},timestamp:Date.now()})}).catch(()=>{})
    // #endregion

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
