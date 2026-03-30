/**
 * notif-platform.js — Delivery bridge: Web Notifications API vs Capacitor Local Notifications
 *
 * All notification delivery goes through this module.
 * notifications.js owns logic, copy, and state — this module owns sending.
 *
 * Capacitor plugin access:
 *   We do NOT import @capacitor/local-notifications via ES module / dynamic import.
 *   Reason: bare-specifier dynamic imports (import('@capacitor/...')) fail in the
 *   Android WebView's module parser even inside try/catch, causing a white screen.
 *
 *   Instead, we access the plugin via the Capacitor bridge global:
 *     window.Capacitor.Plugins.LocalNotifications
 *   When the package is installed and `npx cap sync android` is run, the plugin
 *   self-registers on the bridge and is available there with the same API.
 *
 * Install when ready:
 *   npm install @capacitor/local-notifications
 *   npx cap sync android
 *
 * Until then, getLocalNotif() returns null and all native paths silently no-op.
 */

import { Capacitor } from '@capacitor/core';

// ── Platform detection ────────────────────────────────────────────────────────

/** True when running inside a Capacitor native shell (Android / iOS) */
export function isNative() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

// ── Plugin accessor ───────────────────────────────────────────────────────────

/**
 * Returns the LocalNotifications plugin instance if available, otherwise null.
 *
 * Works when @capacitor/local-notifications is installed and cap sync'd.
 * Returns null gracefully if the plugin is not yet installed — all callers
 * check for null and skip native paths safely.
 */
function getLocalNotif() {
  try {
    return window?.Capacitor?.Plugins?.LocalNotifications ?? null;
  } catch {
    return null;
  }
}

// ── Notification channel IDs ─────────────────────────────────────────────────
//
// IMPORTANT — Android channel importance is locked at first creation.
// createChannel() with an existing ID is a no-op for importance — Android
// considers that setting user-controlled after first install.
//
// CHANNEL_ID_LEGACY was created with importance: 3 (IMPORTANCE_DEFAULT) in
// earlier dev builds. Those installs keep quiet behavior regardless of code.
//
// CHANNEL_ID is a new channel ID created with importance: 4 (IMPORTANCE_HIGH).
// All new notification scheduling uses this channel.
// The legacy channel is left alone — deleting it would orphan any pending
// notifications that still reference it.

export const CHANNEL_ID_LEGACY = 'study-reminders';    // old — quiet, do not use
export const CHANNEL_ID        = 'study-reminders-v2'; // new — IMPORTANCE_HIGH, heads-up capable

// ── Stable notification IDs ───────────────────────────────────────────────────

export const SCHEDULED_REMINDER_ID = 1001;  // recurring daily study reminder
export const FAREWELL_ID           = 1003;  // sent once before pausing
export const REACTIVATION_ID       = 1004;  // sent on return after pause
export const TEST_NOTIF_ID         = 1099;  // dev panel delayed-test notifications

// ── Permission ────────────────────────────────────────────────────────────────

/**
 * Check current permission status without prompting.
 *
 * Async on native (Capacitor has no synchronous permission check).
 * Returns: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unsupported' | 'plugin_unavailable'
 */
export async function checkPlatformPermission() {
  if (isNative()) {
    const LN = getLocalNotif();
    if (!LN) return 'plugin_unavailable';
    try {
      const perm = await LN.checkPermissions();
      return perm.display; // 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
    } catch {
      return 'unknown';
    }
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Request notification permission.
 * Returns: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unsupported'
 */
export async function requestPlatformPermission() {
  if (isNative()) {
    const LN = getLocalNotif();
    if (!LN) return 'unsupported';
    try {
      const perm = await LN.requestPermissions();
      return perm.display;
    } catch {
      return 'unsupported';
    }
  }
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';
  return await Notification.requestPermission();
}

/**
 * Synchronous permission snapshot — reliable on web only.
 * On native always returns 'unknown'; use checkPlatformPermission() instead.
 */
export function getPlatformPermission() {
  if (isNative()) return 'unknown';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ── Android notification channel ──────────────────────────────────────────────

/**
 * Create the Android notification channel for study reminders.
 *
 * Creates CHANNEL_ID ('study-reminders-v2') with IMPORTANCE_HIGH (4) so
 * heads-up / banner behavior is the default on fresh installs.
 *
 * The legacy channel ('study-reminders', importance: 3) is intentionally NOT
 * deleted — removing it would orphan any pending notifications still pointing
 * to it. It simply becomes unused after this update.
 *
 * Idempotent — safe to call on every app start.
 * No-op if not on native or plugin is not installed.
 */
export async function ensureNotifChannel() {
  if (!isNative()) return;
  const LN = getLocalNotif();
  if (!LN) return;
  try {
    await LN.createChannel({
      id:          CHANNEL_ID,           // 'study-reminders-v2'
      name:        'Study Reminders',    // shown in Android notification settings
      description: 'Daily reminders to practise for the taxi exam',
      importance:  4,                    // IMPORTANCE_HIGH — heads-up / banner enabled
      visibility:  1,                    // VISIBILITY_PUBLIC
      vibration:   true,
      sound:       'default',
    });
  } catch {}
}

// ── Internal web firing ───────────────────────────────────────────────────────

async function _fireWebNow(title, body, opts = {}) {
  if (!('Notification' in window)) return { ok: false, reason: 'unsupported' };
  if (Notification.permission !== 'granted') {
    const perm = await requestPlatformPermission();
    if (perm !== 'granted') return { ok: false, reason: 'permission_denied' };
  }
  try {
    new Notification(title, {
      body,
      icon:   opts.icon  ?? (import.meta.env.BASE_URL + 'branding/icon-192.png'),
      badge:  opts.badge ?? (import.meta.env.BASE_URL + 'branding/icon-192.png'),
      tag:    opts.tag   ?? 'taxi-teori-reminder',
      silent: false,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────

/**
 * Schedule a notification for delivery at a specific Date.
 *
 * Native: uses Capacitor LocalNotifications — real background delivery even when app is closed.
 * Web:    fires immediately (no background scheduling without a service worker).
 *
 * @param {number} id    Stable integer — scheduling the same ID cancels the previous one
 * @param {string} title
 * @param {string} body
 * @param {Date}   at    Delivery time
 * @param {object} opts  { tag, channelId }
 */
export async function scheduleAt(id, title, body, at, opts = {}) {
  if (isNative()) {
    const LN = getLocalNotif();
    if (!LN) return { ok: false, reason: 'plugin_unavailable' };
    try {
      await LN.schedule({
        notifications: [{
          id,
          title,
          body,
          schedule:  { at, allowWhileIdle: true },
          channelId: opts.channelId ?? CHANNEL_ID,  // always use the v2 IMPORTANCE_HIGH channel
          iconColor: '#FFBE2E',
          // sound omitted — inherits from channel definition
        }],
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  }
  // Web: fire immediately as best-effort substitute
  return _fireWebNow(title, body, { tag: opts.tag });
}

/**
 * Fire a notification immediately on both platforms.
 * On native schedules for "now + 1 second" (LocalNotifications requires a schedule time).
 */
export async function fireNow(title, body, opts = {}) {
  if (isNative()) {
    const at = new Date(Date.now() + 1000);
    return scheduleAt(opts.id ?? REACTIVATION_ID, title, body, at, opts);
  }
  return _fireWebNow(title, body, opts);
}

// ── Cancel ────────────────────────────────────────────────────────────────────

/** Cancel all pending scheduled notifications. No-op on web or if plugin unavailable. */
export async function cancelAll() {
  if (!isNative()) return;
  const LN = getLocalNotif();
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    if (pending.notifications.length > 0) {
      await LN.cancel({ notifications: pending.notifications });
    }
  } catch {}
}

/** Cancel a specific notification by its stable ID. No-op on web or if plugin unavailable. */
export async function cancelById(id) {
  if (!isNative()) return;
  const LN = getLocalNotif();
  if (!LN) return;
  try {
    await LN.cancel({ notifications: [{ id }] });
  } catch {}
}

// ── Pending ───────────────────────────────────────────────────────────────────

/**
 * Returns array of pending scheduled notification objects.
 * Native only — returns [] on web or if plugin unavailable.
 * Each item: { id, title, body, schedule: { at } }
 */
export async function getPending() {
  if (!isNative()) return [];
  const LN = getLocalNotif();
  if (!LN) return [];
  try {
    const result = await LN.getPending();
    return result.notifications ?? [];
  } catch {
    return [];
  }
}
