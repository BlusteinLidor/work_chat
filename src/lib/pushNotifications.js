import { supabase } from './supabase'

const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

const base64UrlToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }
  return outputArray
}

const upsertSubscription = async (userId, subscription) => {
  const payload = subscription.toJSON()
  const endpoint = payload.endpoint
  const p256dh = payload.keys?.p256dh
  const auth = payload.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription payload.')
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )

  if (error) throw error
}

export const registerPushForUser = async (userId) => {
  if (!userId) return
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return
  }
  if (!publicVapidKey) return

  const registration = await navigator.serviceWorker.register('/sw.js')

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()
  if (permission !== 'granted') return

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicVapidKey),
    })
  }

  await upsertSubscription(userId, subscription)
}

export const removePushSubscriptionForUser = async (userId) => {
  if (!userId) return
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
}
