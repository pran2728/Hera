// Turning Hera's notifications on and off on this device.
import { supabase } from './supabase'

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
}

// 'ios-install' | 'unsupported' | 'denied' | 'default' | 'granted'
export function pushSupport() {
  if (isIOS() && !isInstalled()) return 'ios-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function keyBytes(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

export async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function enablePush(userId) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'denied' : 'dismissed')
  const { data, error } = await supabase.functions.invoke('hera-nudge', { body: { action: 'public_key' } })
  if (error || !data?.publicKey) throw new Error('no_key')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.publicKey) })
  }
  const j = sub.toJSON()
  const { error: saveErr } = await supabase.from('push_subscriptions')
    .upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
  if (saveErr) throw saveErr
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export function sendTestPush() {
  return supabase.functions.invoke('hera-nudge', { body: { action: 'test' } })
}

export function explainPushError(e) {
  const m = String(e?.message || e)
  if (m === 'denied') return "Notifications are blocked for Hera. Turn them on in your phone's Settings → Notifications → Hera, then try again."
  if (m === 'dismissed') return 'No problem. Tap the button again whenever you want reminders.'
  if (m === 'no_key') return "Hera's reminder service isn't set up yet (the hera-nudge function)."
  if (/push_subscriptions|schema cache|column/i.test(m)) return "Hera's database needs the Milestone 2 update: run backend/database.sql in Supabase again."
  return `Couldn't turn on reminders: ${m}`
}
