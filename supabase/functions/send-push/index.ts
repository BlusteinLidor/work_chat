// deno-lint-ignore-file no-explicit-any
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

const getAuthedClient = (authorizationHeader: string) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorizationHeader } },
    auth: { persistSession: false },
  })

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
})

const sendResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return sendResponse({ error: 'Supabase env vars are missing for send-push function.' }, 500)
  }
  if (!vapidPublicKey || !vapidPrivateKey) {
    return sendResponse({ error: 'VAPID keys are missing for send-push function.' }, 500)
  }

  try {
    const authorizationHeader = request.headers.get('Authorization')
    const { content, senderId } = (await request.json()) as {
      messageId?: number
      content?: string
      senderId?: string
    }
    const bodyText = typeof content === 'string' && content.trim() ? content.trim() : 'New message'

    let effectiveSenderId = typeof senderId === 'string' ? senderId : ''
    if (authorizationHeader) {
      const authedClient = getAuthedClient(authorizationHeader)
      const {
        data: { user },
      } = await authedClient.auth.getUser()
      if (user?.id) {
        effectiveSenderId = user.id
      }
    }

    const { data: senderProfile } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', effectiveSenderId)
      .maybeSingle()

    const senderName = senderProfile?.display_name || 'Someone'

    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .neq('user_id', effectiveSenderId)

    if (subscriptionError) {
      return sendResponse({ error: subscriptionError.message }, 500)
    }
    if (!subscriptions?.length) {
      return sendResponse({ success: true, sent: 0 })
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const payload = JSON.stringify({
      title: 'Friends Chat',
      body: `${senderName}: ${bodyText}`,
      tag: 'friends-chat-message',
      url: '/dashboard',
    })

    let sent = 0
    const staleIds: number[] = []

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            } as any,
            payload,
          )
          sent += 1
        } catch (error: any) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            staleIds.push(subscription.id)
          }
        }
      }),
    )

    if (staleIds.length > 0) {
      await adminClient.from('push_subscriptions').delete().in('id', staleIds)
    }

    return sendResponse({ success: true, sent })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected send-push error.'
    return sendResponse({ error: message }, 500)
  }
})
