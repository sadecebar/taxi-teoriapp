// ─── Local progress storage ───────────────────────────────────────────────────
// All question stats are stored as a single JSON blob per installation.
// Key schema:  taxi-teori-stats-<installId>
//              taxi-teori-migrated-<installId>
//
// Shape stored:  { [questionId]: { c: number, w: number } }
//   c = total correct answers
//   w = total wrong answers
//
// Everything derived (mastered, accuracy, delprov progress, wrong pool, …)
// is computed from this minimal source at render time — no duplicated state.

import { getInstallationId } from "./installation.js";

const ID           = getInstallationId();
const STATS_KEY    = `taxi-teori-stats-${ID}`;
const MIGRATED_KEY = `taxi-teori-migrated-${ID}`;
const RECENT_KEY   = `taxi-teori-recent-questions-${ID}`;
export const RECENT_QUESTION_LIMIT = 40;

export function loadRecentQuestions() {
  try {
    const ids = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(ids)
      ? ids.filter(id => Number.isInteger(id) && id > 0).slice(0, RECENT_QUESTION_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function recordRecentQuestion(questionId) {
  // Keep committed attempts, including repeats, newest first.
  const ids = [questionId, ...loadRecentQuestions()].slice(0, RECENT_QUESTION_LIMIT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error("Could not save recent questions:", e);
  }
  return ids;
}

export function clearRecentQuestions() {
  localStorage.removeItem(RECENT_KEY);
}

// Called synchronously by answer handlers, never from a React state updater.
export function commitPracticeAnswer(stats, questionId, correct) {
  const current = stats[questionId] || { c: 0, w: 0 };
  const updated = {
    ...stats,
    [questionId]: {
      c: current.c + (correct ? 1 : 0),
      w: current.w + (correct ? 0 : 1),
    },
  };
  saveAllStats(updated);
  recordRecentQuestion(questionId);
  return updated;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Load the stored stats object, or null if nothing has been saved yet.
 * Synchronous — safe to call inside a useState initializer.
 */
export function loadLocalStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Persist the full stats object.
 * Call after every question answer — synchronous and fast.
 */
export function saveAllStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error("Could not save progress to localStorage:", e);
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────

/** Remove all stored stats for this installation. */
export function clearLocalStats() {
  localStorage.removeItem(STATS_KEY);
}

// ── Migration flag ────────────────────────────────────────────────────────────

/** True once the one-time Supabase → localStorage migration has been attempted. */
export function hasMigrated() {
  return localStorage.getItem(MIGRATED_KEY) === "1";
}

export function markMigrated() {
  localStorage.setItem(MIGRATED_KEY, "1");
}
