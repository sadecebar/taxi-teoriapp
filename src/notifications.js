/**
 * notifications.js — Notification logic for Taxi Teori
 *
 * Architecture:
 *
 *  Platform      Delivery is handled by notif-platform.js.
 *                On native (Capacitor): Capacitor Local Notifications → real scheduled delivery.
 *                On web: Web Notifications API → fires on app open.
 *
 *  Copy bank     NOTIF_COPY — Swedish + English variants for each notification
 *                type (study, mood, farewell, reactivation). Add new entries
 *                freely; logic picks randomly without touching structure.
 *
 *  Settings      Persisted under NOTIF_SETTINGS_KEY.
 *                Shape: { enabled, timing, vibration, sound }
 *
 *  State         Persisted under NOTIF_STATE_KEY.
 *                Shape: { lastActivity, sentCount, paused, lastSentAt }
 *
 *  Native path   scheduleNextReminder() — call on app mount and after settings change.
 *                Calculates the next timing-window occurrence and schedules via the bridge.
 *                Farewell/inactivity checks run here too on native.
 *
 *  Web path      checkAndFireOnOpen() — "check on open" pattern. Fires immediately
 *                when the user opens the app and conditions are met.
 *
 *  Inactivity    After INACTIVITY_FAREWELL_DAYS days without study, or after
 *                INACTIVITY_MAX_NOTIFS sent with no activity, one farewell is sent
 *                and notifications pause.
 *
 *  Reactivation  recordActivity() fires a reactivation notification and resumes
 *                scheduling if the user was previously paused.
 */

import {
  isNative,
  fireNow,
  scheduleAt,
  cancelAll,
  getPending,
  requestPlatformPermission,
  getPlatformPermission,
  checkPlatformPermission,
  CHANNEL_ID,
  SCHEDULED_REMINDER_ID,
  FAREWELL_ID,
  REACTIVATION_ID,
  TEST_NOTIF_ID,
} from './notif-platform.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Days of inactivity before farewell behavior triggers */
export const INACTIVITY_FAREWELL_DAYS = 7;

/** Max notifications sent without study activity before farewell */
export const INACTIVITY_MAX_NOTIFS = 3;

/** Minimum hours between any two fired notifications (web path only) */
const MIN_HOURS_BETWEEN_NOTIFS = 20;

// ── Storage keys ──────────────────────────────────────────────────────────────

export const NOTIF_SETTINGS_KEY = 'taxi-teori-notif-settings';
export const NOTIF_STATE_KEY    = 'taxi-teori-notif-state';

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_NOTIF_SETTINGS = {
  enabled:   true,       // master on/off for study reminders
  timing:    'evening',  // "day" (08:00) | "lunch" (12:00) | "evening" (18:00)
  vibration: true,       // haptic feedback on quiz answers
  sound:     true,       // audio feedback on quiz answers
};

const DEFAULT_NOTIF_STATE = {
  lastActivity: null,  // ISO — last time user completed a study session
  sentCount:    0,     // notifications sent since last activity
  paused:       false, // true after farewell, until user studies again
  lastSentAt:   null,  // ISO — when we last fired or scheduled a notification
};

// ── Copy bank ─────────────────────────────────────────────────────────────────
//
// Categories:
//   study     — direct study reminders; varied but always action-oriented
//   mood      — personality / character nudges; can be lightly playful
//   progress  — comeback / progress challenge nudges; motivational without guilt
//   farewell  — single object; sent once before pausing reminders
//   reactivation — single object; sent when user returns after a pause
//
// Emoji guidance: 0–2 per entry. Mood and progress can use emojis more freely.
// Study reminders stay mostly clean. Farewell / reactivation can be warm.
// Keep the tone premium and smart — never childish or spammy.
//
// Picker rotation (4-cycle): study → study → mood → progress → repeat.
// Add entries freely to any array; logic picks randomly.

export const NOTIF_COPY = {
  sv: {
    study: [
      { title: "Dags att öva",          body: "Taxi Teori väntar. Fem minuter nu kan spara mycket stress senare." },
      { title: "Snabbt stopp?",         body: "En kort runda nu — ett lugnare kunskapsprov sen." },
      { title: "Fem minuter",           body: "Fem minuter teori. Mer kräver vi inte." },
      { title: "Din nästa rätta rad",   body: "Öppna appen och håll streaket vid liv." },
      { title: "Ett snabbprov nu?",     body: "Regelbunden träning slår att pugga kvällen innan — varje gång." },
      { title: "Ditt framsteg väntar",  body: "Du har byggt upp en bra grund. Fortsätt — det märks." },
    ],
    mood: [
      { title: "Taxametern tickar 🚕",  body: "Taxametern står inte still. Det borde inte pluggandet heller göra." },
      { title: "Vi noterar bara 📋",    body: "Vi såg inget plugg idag. Vi dömer inte. Vi noterar bara." },
      { title: "Hej 🙂",               body: "Teorin pluggar sig inte själv. Det vet du. Det vet jag. Ska vi?" },
      { title: "En farlig plan 👀",     body: "Du och jag vet båda att \"sen\" är en farlig studieplan." },
      { title: "Föraren saknas 👀",     body: "Teorin står kvar vid vägkanten. Ska vi hämta upp den?" },
      { title: "Bara en iakttagelse",   body: "Vi säger inte att du ska öppna appen nu. Vi säger bara att det vore väldigt klokt." },
    ],
    progress: [
      { title: "Närmre än du tror",     body: "Du är närmre Behärskad än du tror. Ett pass flyttar fler frågor dit." },
      { title: "Revansch? 😌",          body: "Några frågor väntar fortfarande på revansch. Kom in och visa vad du kan." },
      { title: "Ditt svagaste område",  body: "Ditt svagaste område vill gärna träffa dig igen." },
      { title: "Bevisa det 💥",         body: "Vi hittade frågor som fortfarande tror att de kan lura dig. Kom och visa dem fel." },
      { title: "Inte efter",            body: "Du är inte efter. Du är bara ett pass från bättre koll." },
      { title: "Nästa stopp 🚖",        body: "Kund i baksätet, karta i huvudet. Ska vi öva båda?" },
    ],
    farewell: {
      title: "Vi parkerar här 🅿️",
      body:  "Inga fler påminnelser — tills du öppnar appen igen. Lycka till så länge 👋",
    },
    reactivation: {
      title: "Där är du ju 🚖",
      body:  "Välkommen tillbaka. Teorin stod faktiskt kvar och väntade. Ska vi köra?",
    },
  },

  en: {
    study: [
      { title: "Time to study",         body: "Taxi Teori is waiting. Five minutes now can save a lot of stress later." },
      { title: "Quick stop?",           body: "A short session now — a calmer exam later." },
      { title: "Five minutes",          body: "Five minutes of theory. That is all we ask." },
      { title: "Your next streak",      body: "Open the app and keep your streak alive." },
      { title: "Quick test?",           body: "Regular practice always beats cramming the night before — every time." },
      { title: "Progress is waiting",   body: "You have built a solid foundation. Keep going — it shows." },
    ],
    mood: [
      { title: "The meter is running 🚕", body: "The meter is not standing still. Your studying should not be either." },
      { title: "Just an observation 📋",  body: "We saw no studying today. No judgment. Just observation." },
      { title: "Hi 🙂",                   body: "Theory does not study itself. You know it. I know it. Shall we?" },
      { title: "A risky plan 👀",          body: "You and I both know that \"later\" is a dangerous study plan." },
      { title: "Driver missing 👀",        body: "The theory is still waiting at the curb. Want to pick it up?" },
      { title: "Just saying",              body: "We are not saying you should open the app right now. We are just saying it would be wise." },
    ],
    progress: [
      { title: "Closer than you think",  body: "You are closer to mastered than you think. One session moves more questions up." },
      { title: "A rematch? 😌",          body: "Some questions are still waiting for a rematch. Come in and show what you know." },
      { title: "Your weakest area",      body: "Your weakest area would like to see you again." },
      { title: "Prove it 💥",            body: "A few questions still think they can fool you. Come back and prove them wrong." },
      { title: "Not behind",             body: "You are not behind. You are one session away from better control." },
      { title: "Next stop 🚖",           body: "Passenger in the back, route in your head. Want to practise both?" },
    ],
    farewell: {
      title: "Parking here 🅿️",
      body:  "No more reminders — until you open the app again. Good luck for now 👋",
    },
    reactivation: {
      title: "There you are 🚖",
      body:  "Welcome back. The theory was still waiting for you. Ready to go?",
    },
  },
};

// ── Settings helpers ──────────────────────────────────────────────────────────

export function loadNotifSettings() {
  try {
    const raw = localStorage.getItem(NOTIF_SETTINGS_KEY);
    return raw ? { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_NOTIF_SETTINGS };
  } catch {
    return { ...DEFAULT_NOTIF_SETTINGS };
  }
}

export function saveNotifSettings(settings) {
  try { localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

// ── Notification state helpers ────────────────────────────────────────────────

export function loadNotifState() {
  try {
    const raw = localStorage.getItem(NOTIF_STATE_KEY);
    return raw ? { ...DEFAULT_NOTIF_STATE, ...JSON.parse(raw) } : { ...DEFAULT_NOTIF_STATE };
  } catch {
    return { ...DEFAULT_NOTIF_STATE };
  }
}

export function saveNotifState(state) {
  try { localStorage.setItem(NOTIF_STATE_KEY, JSON.stringify(state)); } catch {}
}

// ── Permission (re-exported via bridge) ───────────────────────────────────────

export { requestPlatformPermission as requestNotifPermission };
export { getPlatformPermission     as getNotifPermission };
export { checkPlatformPermission   as checkNotifPermission };

// ── Immediate fire (used for farewell / reactivation) ─────────────────────────

/**
 * Fire a notification immediately.
 * On native uses Capacitor (schedules 1s ahead); on web uses Web Notifications API.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export async function fireNotification(title, body, opts = {}) {
  return fireNow(title, body, opts);
}

// ── Copy pickers ──────────────────────────────────────────────────────────────

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getStudyCopy(lang = 'sv') {
  return pickRandom(NOTIF_COPY[lang]?.study ?? NOTIF_COPY.sv.study);
}

export function getMoodCopy(lang = 'sv') {
  return pickRandom(NOTIF_COPY[lang]?.mood ?? NOTIF_COPY.sv.mood);
}

export function getProgressCopy(lang = 'sv') {
  return pickRandom(NOTIF_COPY[lang]?.progress ?? NOTIF_COPY.sv.progress);
}

export function getFarewellCopy(lang = 'sv') {
  return NOTIF_COPY[lang]?.farewell ?? NOTIF_COPY.sv.farewell;
}

export function getReactivationCopy(lang = 'sv') {
  return NOTIF_COPY[lang]?.reactivation ?? NOTIF_COPY.sv.reactivation;
}

// ── Next timing window ────────────────────────────────────────────────────────

/**
 * Returns the next Date when the user's preferred timing window opens.
 * If today's window start is more than 30 minutes away, returns today's occurrence.
 * Otherwise returns tomorrow's.
 *
 * timing === "day"     → 08:00 local time
 * timing === "lunch"   → 12:00 local time
 * timing === "evening" → 18:00 local time
 */
export function nextTimingWindowDate(timing) {
  const hour      = timing === 'day' ? 8 : timing === 'lunch' ? 12 : 18;
  const now       = new Date();
  const candidate = new Date(now);
  candidate.setHours(hour, 0, 0, 0);
  const msAway = candidate.getTime() - now.getTime();
  if (msAway > 30 * 60 * 1000) return candidate;  // today's window is ahead
  // Today's window has passed (or is less than 30 min away) — use tomorrow
  candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

// ── Inactivity check ──────────────────────────────────────────────────────────

/**
 * Check if inactivity thresholds have been crossed.
 * Returns { shouldFarewell: boolean } based on stored state.
 */
function checkInactivity(state) {
  const lastActivity = state.lastActivity ? new Date(state.lastActivity) : null;
  if (!lastActivity) return { shouldFarewell: false };
  const daysInactive = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
  return {
    shouldFarewell: daysInactive >= INACTIVITY_FAREWELL_DAYS || state.sentCount >= INACTIVITY_MAX_NOTIFS,
  };
}

// ── Activity tracking ─────────────────────────────────────────────────────────

/**
 * Call every time the user completes a study session.
 *
 * - Resets sentCount and lastActivity.
 * - If previously paused (after farewell), fires a reactivation notification.
 * - On native, reschedules the next daily reminder.
 */
export async function recordActivity(lang = 'sv', notifSettings = null) {
  const state     = loadNotifState();
  const wasPaused = state.paused;
  saveNotifState({
    ...state,
    lastActivity: new Date().toISOString(),
    sentCount:    0,
    paused:       false,
  });
  if (wasPaused) {
    const copy = getReactivationCopy(lang);
    fireNow(copy.title, copy.body, { id: REACTIVATION_ID }).catch(() => {});
  }
  // Reschedule on native after activity
  if (isNative() && notifSettings?.enabled) {
    scheduleNextReminder(notifSettings, lang).catch(() => {});
  }
}

// ── Schedule next reminder (native path) ──────────────────────────────────────

/**
 * Cancel any pending scheduled reminder and schedule the next one.
 *
 * Native only. On web returns 'web:noop'.
 *
 * Decision tree (mirrors checkAndFireOnOpen logic):
 *   1. Not native → 'web:noop'
 *   2. Disabled or paused → cancel any pending → 'skipped:disabled/paused'
 *   3. Inactivity threshold exceeded → farewell → pause → 'fired:farewell'
 *   4. Schedule at next timing window → 'scheduled'
 *
 * Returns a string describing the action (useful for dev logging).
 */
export async function scheduleNextReminder(settings, lang = 'sv') {
  if (!isNative()) return 'web:noop';
  if (!settings.enabled) {
    await cancelAll();
    return 'skipped:disabled';
  }

  const state = loadNotifState();
  if (state.paused) {
    await cancelAll();
    return 'skipped:paused';
  }

  // Inactivity / farewell
  const { shouldFarewell } = checkInactivity(state);
  if (shouldFarewell) {
    const copy   = getFarewellCopy(lang);
    const result = await fireNow(copy.title, copy.body, { id: FAREWELL_ID });
    if (result.ok) {
      await cancelAll();
      saveNotifState({ ...state, paused: true, sentCount: state.sentCount + 1, lastSentAt: new Date().toISOString() });
      return 'fired:farewell';
    }
  }

  // Schedule the next regular reminder
  // 4-cycle rotation: study → study → mood → progress → repeat
  const slot       = (state.sentCount + 1) % 4;
  const copy       = slot === 2 ? getMoodCopy(lang)
                   : slot === 3 ? getProgressCopy(lang)
                   : getStudyCopy(lang);
  const at      = nextTimingWindowDate(settings.timing);
  const result  = await scheduleAt(SCHEDULED_REMINDER_ID, copy.title, copy.body, at);
  if (result.ok) {
    saveNotifState({ ...state, lastSentAt: new Date().toISOString() });
    const slotName = slot === 2 ? 'mood' : slot === 3 ? 'progress' : 'study';
    return `scheduled:${slotName}:${at.toISOString()}`;
  }

  return 'failed:schedule';
}

/**
 * Cancel all pending scheduled reminders (e.g. when user disables notifications).
 * No-op on web.
 */
export async function cancelScheduledReminders() {
  return cancelAll();
}

/**
 * Get pending scheduled notifications (native only).
 * Returns [{ id, title, body, schedule: { at } }, ...]
 */
export async function getPendingReminders() {
  return getPending();
}

// ── Web: check and fire on app open ──────────────────────────────────────────

/**
 * Web-only path. Call once at app mount.
 *
 * On native, returns 'native:skipped' — scheduling is handled by scheduleNextReminder().
 *
 * Decision tree:
 *   1. Native → 'native:skipped'
 *   2. Disabled / paused → skip
 *   3. Within cooldown window (< MIN_HOURS_BETWEEN_NOTIFS) → skip
 *   4. Inactivity threshold exceeded → farewell → pause
 *   5. Not in timing window → skip
 *   6. sentCount % 3 === 2 → mood notification
 *   7. Otherwise → study notification
 *
 * Returns a string describing the action.
 */
export async function checkAndFireOnOpen(settings, lang = 'sv') {
  if (isNative())        return 'native:skipped';
  if (!settings.enabled) return 'skipped:disabled';

  const state        = loadNotifState();
  if (state.paused)  return 'skipped:paused';

  const now          = new Date();
  const lastSentAt   = state.lastSentAt   ? new Date(state.lastSentAt)   : null;
  const lastActivity = state.lastActivity ? new Date(state.lastActivity) : null;

  // Cooldown — at most one notification per MIN_HOURS_BETWEEN_NOTIFS
  if (lastSentAt) {
    const hoursSince = (now - lastSentAt) / (1000 * 60 * 60);
    if (hoursSince < MIN_HOURS_BETWEEN_NOTIFS) return 'skipped:cooldown';
  }

  // Inactivity / farewell (fires outside timing window too — intent matters here)
  if (lastActivity) {
    const { shouldFarewell } = checkInactivity(state);
    if (shouldFarewell) {
      const copy   = getFarewellCopy(lang);
      const result = await fireNow(copy.title, copy.body, { tag: 'taxi-teori-farewell' });
      if (result.ok) {
        saveNotifState({ ...state, paused: true, sentCount: state.sentCount + 1, lastSentAt: now.toISOString() });
        return 'fired:farewell';
      }
    }
  }

  // Regular notification — only within preferred timing window
  const hour = now.getHours();
  const inWindow = settings.timing === 'day'     ? (hour >= 8  && hour < 11)
                 : settings.timing === 'lunch'   ? (hour >= 12 && hour < 14)
                 :                                 (hour >= 18 && hour < 21);
  if (!inWindow) return 'skipped:outside_window';

  // 4-cycle rotation: study → study → mood → progress → repeat
  const slot2  = (state.sentCount + 1) % 4;
  const copy   = slot2 === 2 ? getMoodCopy(lang)
               : slot2 === 3 ? getProgressCopy(lang)
               : getStudyCopy(lang);
  const result = await fireNow(copy.title, copy.body);
  if (result.ok) {
    saveNotifState({ ...state, sentCount: state.sentCount + 1, lastSentAt: now.toISOString() });
    const slotName2 = slot2 === 2 ? 'mood' : slot2 === 3 ? 'progress' : 'study';
    return `fired:${slotName2}`;
  }

  return 'skipped:fire_failed';
}

// ── Delayed test notification ─────────────────────────────────────────────────

/**
 * Schedule a test notification `delaySeconds` from now and return immediately.
 *
 * Design intent: gives the tester time to background the app/tab before delivery,
 * which is necessary to see a visible heads-up notification on both platforms:
 *
 *   Android — heads-up popup is suppressed while the app is foregrounded.
 *             After clicking this, press Home before the countdown ends.
 *
 *   Web     — browsers suppress Web Notifications while the originating tab is focused.
 *             After clicking this, switch to another tab before the countdown ends.
 *
 * Native: uses Capacitor scheduleAt — real OS-scheduled delivery.
 * Web:    uses setTimeout + fireNow — fires after delay, requires unfocused tab.
 *
 * Returns { ok: boolean, scheduledAt: Date } immediately (before the notification fires).
 */
export async function scheduleTestIn(delaySeconds = 5, lang = 'sv') {
  const at   = new Date(Date.now() + delaySeconds * 1000);
  const copy = getStudyCopy(lang);

  if (isNative()) {
    const result = await scheduleAt(TEST_NOTIF_ID, copy.title, copy.body, at);
    return { ok: result.ok, reason: result.reason, scheduledAt: at, title: copy.title };
  }

  // Web: schedule via setTimeout; fires regardless of tab focus state at that moment
  setTimeout(() => { fireNow(copy.title, copy.body).catch(() => {}); }, delaySeconds * 1000);
  return { ok: true, scheduledAt: at, title: copy.title };
}

// ── Dev / test utilities ──────────────────────────────────────────────────────

/** Simulate N days of inactivity — triggers farewell on next check */
export function simulateInactivity(days = 8) {
  const past  = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const state = loadNotifState();
  saveNotifState({ ...state, lastActivity: past.toISOString(), sentCount: INACTIVITY_MAX_NOTIFS });
}

/** Reset notification state to a clean active baseline */
export function resetNotifState() {
  saveNotifState({ ...DEFAULT_NOTIF_STATE, lastActivity: new Date().toISOString() });
}
