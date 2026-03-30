/**
 * DevPanel — internal developer/debug tool
 *
 * Only rendered when import.meta.env.DEV === true (Vite development server).
 * This file is never bundled into a production build, but as an extra safety
 * net the component also checks the flag at runtime before rendering anything.
 *
 * How to open: click the small "DEV" tab anchored to the bottom-right corner.
 */

import { useState, useEffect, useRef } from "react";
import {
  fireNotification, getStudyCopy, getMoodCopy, getProgressCopy, getFarewellCopy, getReactivationCopy,
  simulateInactivity, resetNotifState, loadNotifState,
  requestNotifPermission, checkNotifPermission,
  scheduleNextReminder, cancelScheduledReminders, getPendingReminders,
  nextTimingWindowDate, scheduleTestIn,
} from "./notifications.js";
import { isNative, CHANNEL_ID, CHANNEL_ID_LEGACY } from "./notif-platform.js";

// ── Status helpers ─────────────────────────────────────────────────────────────
// Must match getQuestionStatus in App.jsx:
//   behärskad  →  c >= 2 && c > w
//   på väg     →  c > w  (but c < 2)
//   öva mer    →  w >= c, attempts > 0
//   ej övad    →  c === 0 && w === 0

function statsForStatus(status) {
  switch (status) {
    case "behärskad": return { c: 3, w: 0 };
    case "på väg":    return { c: 1, w: 0 };
    case "öva mer":   return { c: 0, w: 2 };
    case "ej övad":
    default:          return { c: 0, w: 0 };
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 99998,
    background: "rgba(0,0,0,0.45)",
  },
  panel: {
    position: "fixed",
    bottom: 0,
    right: 0,
    width: "min(320px, 100vw)",
    maxHeight: "82dvh",
    overflowY: "auto",
    background: "#0f0f0f",
    border: "1px solid #333",
    borderBottom: "none",
    borderRight: "none",
    borderRadius: "12px 0 0 0",
    zIndex: 99999,
    fontFamily: "'Courier New', monospace",
    fontSize: "11px",
    color: "#e0e0e0",
    boxShadow: "-4px -4px 24px rgba(0,0,0,0.6)",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },
  tab: {
    position: "fixed",
    bottom: "0",
    right: "0",
    background: "#1a1a2e",
    border: "1px solid #444",
    borderBottom: "none",
    borderRight: "none",
    borderRadius: "8px 0 0 0",
    padding: "5px 10px 4px",
    zIndex: 99999,
    cursor: "pointer",
    fontSize: "9px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    color: "#7b9fff",
    fontFamily: "monospace",
    userSelect: "none",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px 8px",
    borderBottom: "1px solid #222",
    background: "#111",
    position: "sticky",
    top: 0,
  },
  section: {
    borderBottom: "1px solid #1e1e1e",
    padding: "10px 14px",
  },
  sectionTitle: {
    fontSize: "9px",
    fontWeight: "700",
    letterSpacing: "1.8px",
    textTransform: "uppercase",
    color: "#7b9fff",
    marginBottom: "8px",
  },
  btnRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "5px",
  },
  btn: {
    background: "#1e1e1e",
    border: "1px solid #333",
    borderRadius: "5px",
    color: "#ccc",
    cursor: "pointer",
    fontSize: "10px",
    padding: "4px 8px",
    fontFamily: "monospace",
    lineHeight: 1.3,
  },
  btnRed: {
    background: "rgba(180,50,50,0.18)",
    border: "1px solid rgba(180,50,50,0.45)",
    color: "#e07070",
  },
  btnGreen: {
    background: "rgba(50,160,80,0.18)",
    border: "1px solid rgba(50,160,80,0.4)",
    color: "#70d090",
  },
  btnGold: {
    background: "rgba(180,140,40,0.18)",
    border: "1px solid rgba(180,140,40,0.45)",
    color: "#d4b050",
  },
  inputRow: {
    display: "flex",
    gap: "5px",
    alignItems: "center",
    marginTop: "6px",
  },
  input: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "4px",
    color: "#e0e0e0",
    fontSize: "11px",
    padding: "3px 7px",
    width: "56px",
    fontFamily: "monospace",
  },
  toast: {
    position: "fixed",
    bottom: "16px",
    right: "330px",
    background: "#1a2a1a",
    border: "1px solid #3a5a3a",
    borderRadius: "6px",
    color: "#70d090",
    fontSize: "10px",
    padding: "5px 10px",
    zIndex: 100000,
    fontFamily: "monospace",
    animation: "fadeIn 0.15s ease",
    pointerEvents: "none",
  },
};

// ── DevPanel component ─────────────────────────────────────────────────────────
export default function DevPanel({
  questions,
  installId,
  stats,           setStats,
  savedIds,        setSavedIds,
  quizHistory,     setQuizHistory,
  dailyData,       setDailyData,
  rirBest,         setRirBest,
  checklistDone,   setChecklistDone,
  showOnboarding,  setShowOnboarding,
  checklistSteps,
  saveAllStats,
  lang             = "sv",
  notifSettings,
  setNotifSettings,
}) {
  // Extra runtime guard — never render in production even if accidentally imported
  if (!import.meta.env.DEV) return null;

  const [open,       setOpen]       = useState(false);
  const [toast,      setToast]      = useState("");
  const [streakVal,  setStreakVal]  = useState("5");
  const [bestVal,    setBestVal]    = useState("10");
  const [rirVal,     setRirVal]     = useState("12");
  const [wrongPct,   setWrongPct]   = useState("30");
  const [notifState,    setNotifState]    = useState(() => loadNotifState());
  const [pendingNotifs, setPendingNotifs] = useState([]);
  const [permDisplay,   setPermDisplay]   = useState("…");
  const [countdown,     setCountdown]     = useState(0);   // >0 while delayed test is running
  const [tabFocused,    setTabFocused]    = useState(() => typeof document !== "undefined" ? document.hasFocus() : true);
  const countdownRef = useRef(null);

  // Android hardware back button — dismiss panel before navigating away
  useEffect(() => {
    if (!open) return;
    history.pushState({ devPanel: true }, "");
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  // Refresh notif state, permission, and pending whenever panel opens
  useEffect(() => {
    if (!open) return;
    setNotifState(loadNotifState());
    checkNotifPermission().then(setPermDisplay).catch(() => setPermDisplay("error"));
    getPendingReminders().then(setPendingNotifs).catch(() => {});
  }, [open]);

  // Track tab focus on web — Chrome suppresses notifications from the focused tab
  useEffect(() => {
    if (isNative()) return;
    const onFocus = () => setTabFocused(true);
    const onBlur  = () => setTabFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur",  onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur",  onBlur);
    };
  }, []);

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const HISTORY_KEY   = `taxi-teori-history-${installId}`;
  const SAVED_KEY     = `taxi-teori-saved-${installId}`;
  const DAILY_KEY     = `taxi-teori-daily-${installId}`;
  const RIR_KEY       = `taxi-teori-rir-${installId}`;
  const CHECKLIST_KEY = `taxi-teori-checklist-${installId}`;
  const OB_KEY        = `taxi-teori-onboarding-done-${installId}`;

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  function persistStats(newStats) {
    setStats(newStats);
    saveAllStats(newStats);
  }

  // ── 1. Progress presets ───────────────────────────────────────────────────

  function setAllBehärskad() {
    const s = Object.fromEntries(questions.map(q => [q.id, { c: 3, w: 0 }]));
    persistStats(s);
    flash(`All ${questions.length} questions → behärskad`);
  }

  function setAllPåVäg() {
    const s = Object.fromEntries(questions.map(q => [q.id, { c: 1, w: 0 }]));
    persistStats(s);
    flash(`All ${questions.length} questions → på väg`);
  }

  function setMixed() {
    // Quarter each: ej övad / öva mer / på väg / behärskad
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const chunk = Math.floor(shuffled.length / 4);
    const statuses = ["ej övad", "öva mer", "på väg", "behärskad"];
    const s = {};
    shuffled.forEach((q, i) => {
      const status = statuses[Math.min(Math.floor(i / chunk), 3)];
      s[q.id] = statsForStatus(status);
    });
    persistStats(s);
    flash("Mixed states applied (~25% each)");
  }

  function setWrongPool() {
    const pct = Math.max(1, Math.min(100, parseInt(wrongPct) || 30));
    const count = Math.round(questions.length * pct / 100);
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const s = { ...stats };
    shuffled.slice(0, count).forEach(q => { s[q.id] = { c: 0, w: 2 }; });
    persistStats(s);
    flash(`${count} questions → öva mer (wrong pool)`);
  }

  function clearProgress() {
    const s = Object.fromEntries(questions.map(q => [q.id, { c: 0, w: 0 }]));
    persistStats(s);
    flash("All progress cleared");
  }

  // ── 2. Saved questions ────────────────────────────────────────────────────

  function addSavedBatch() {
    const sample = questions.slice(0, 10).map(q => q.id);
    const merged = [...new Set([...savedIds, ...sample])];
    setSavedIds(merged);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(merged)); } catch {}
    flash(`${sample.length} questions saved`);
  }

  function clearSaved() {
    setSavedIds([]);
    try { localStorage.removeItem(SAVED_KEY); } catch {}
    flash("Saved questions cleared");
  }

  // ── 3. Quiz history ───────────────────────────────────────────────────────

  function makeHistoryEntry(score, total, mode = "quick") {
    return { ts: Date.now() - Math.random() * 86400000 * 7, mode, score, total, pct: Math.round(score / total * 100) };
  }

  function genStrongHistory() {
    const entries = [
      makeHistoryEntry(14, 15, "quick"),
      makeHistoryEntry(15, 15, "quick"),
      makeHistoryEntry(60, 65, 1),
      makeHistoryEntry(13, 15, "quick"),
      makeHistoryEntry(44, 46, 2),
    ];
    const next = [...entries, ...quizHistory].slice(0, 10);
    setQuizHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
    flash("Strong history injected (5 entries)");
  }

  function genWeakHistory() {
    const entries = [
      makeHistoryEntry(6, 15, "quick"),
      makeHistoryEntry(4, 15, "quick"),
      makeHistoryEntry(28, 65, 1),
      makeHistoryEntry(7, 15, "quick"),
      makeHistoryEntry(14, 46, 2),
    ];
    const next = [...entries, ...quizHistory].slice(0, 10);
    setQuizHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
    flash("Weak history injected (5 entries)");
  }

  function genMixedHistory() {
    const entries = [
      makeHistoryEntry(14, 15, "quick"),
      makeHistoryEntry(5,  15, "quick"),
      makeHistoryEntry(50, 65, 1),
      makeHistoryEntry(10, 15, "quick"),
      makeHistoryEntry(22, 46, 2),
      makeHistoryEntry(13, 15, "quick"),
    ];
    const next = [...entries, ...quizHistory].slice(0, 10);
    setQuizHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
    flash("Mixed history injected (6 entries)");
  }

  function clearHistory() {
    setQuizHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
    flash("Quiz history cleared");
  }

  // ── 4. Challenges ─────────────────────────────────────────────────────────

  function setStreak() {
    const s = parseInt(streakVal) || 0;
    const best = Math.max(parseInt(bestVal) || 0, s);
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const next = { ...dailyData, streak: s, bestStreak: best };
    setDailyData(next);
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(next)); } catch {}
    flash(`Streak set to ${s}, best ${best}`);
  }

  function setDailyAnswered(correct) {
    const next = { ...dailyData, answered: true, correct, chosenIdx: correct ? dailyData.questionId % 4 : (dailyData.questionId % 3 === 0 ? 1 : 0) };
    if (correct) next.streak = (dailyData.streak || 0) + 1;
    else next.streak = 0;
    next.bestStreak = Math.max(dailyData.bestStreak || 0, next.streak);
    setDailyData(next);
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(next)); } catch {}
    flash(correct ? "Daily marked correct" : "Daily marked wrong");
  }

  function resetDailyAnswered() {
    const next = { ...dailyData, answered: false, correct: null, chosenIdx: null };
    setDailyData(next);
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(next)); } catch {}
    flash("Daily answer reset (unanswered)");
  }

  function setRirRecord() {
    const val = parseInt(rirVal) || 0;
    setRirBest(val);
    try { localStorage.setItem(RIR_KEY, String(val)); } catch {}
    flash(`Rätt i rad best → ${val}`);
  }

  function clearRir() {
    setRirBest(0);
    try { localStorage.removeItem(RIR_KEY); } catch {}
    flash("Rätt i rad record cleared");
  }

  // ── 5. Checklist & onboarding ─────────────────────────────────────────────

  function completeChecklist() {
    const all = new Set(checklistSteps.map((_, i) => i));
    setChecklistDone(all);
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify([...all])); } catch {}
    flash(`All ${checklistSteps.length} checklist steps completed`);
  }

  function clearChecklist() {
    setChecklistDone(new Set());
    try { localStorage.removeItem(CHECKLIST_KEY); } catch {}
    flash("Checklist cleared");
  }

  function restartOnboarding() {
    try { localStorage.removeItem(OB_KEY); } catch {}
    setShowOnboarding(true);
    setOpen(false);
    flash("Onboarding restarted");
  }

  function skipOnboarding() {
    try { localStorage.setItem(OB_KEY, "1"); } catch {}
    setShowOnboarding(false);
    flash("Onboarding marked done");
  }

  // ── 6. Delayed visible notification test ─────────────────────────────────

  function startDelayedTest(seconds) {
    // Cancel any running countdown
    if (countdownRef.current) clearInterval(countdownRef.current);

    scheduleTestIn(seconds, lang).then(r => {
      if (!r.ok) {
        flash(`Schedule failed: ${r.reason ?? "unknown"}`);
        return;
      }
      // Start visual countdown
      setCountdown(seconds);
      countdownRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
            // Refresh pending list after countdown clears on native
            if (isNative()) getPendingReminders().then(setPendingNotifs).catch(() => {});
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }).catch(() => flash("scheduleTestIn threw"));
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating trigger tab */}
      <div style={S.tab} onClick={() => setOpen(o => !o)}>
        {open ? "✕ DEV" : "DEV"}
      </div>

      {/* Toast notification */}
      {toast && <div style={S.toast}>{toast}</div>}

      {/* Backdrop — tap outside to close */}
      {open && (
        <div style={S.backdrop} onClick={() => setOpen(false)} />
      )}

      {/* Panel */}
      {open && (
        <div style={S.panel}>

          {/* Header */}
          <div style={S.header}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#7b9fff", letterSpacing: "1px" }}>
              DEV PANEL
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "9px", color: "#555" }}>
                {questions.length} Q · install {installId.slice(-6)}
              </span>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "1px solid #444",
                  borderRadius: "4px",
                  color: "#aaa",
                  cursor: "pointer",
                  fontSize: "14px",
                  lineHeight: 1,
                  padding: "4px 8px",
                  fontFamily: "monospace",
                }}
                aria-label="Close dev panel"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── 1. Progress ───────────────────────────────── */}
          <div style={S.section}>
            <div style={S.sectionTitle}>1 · Progress</div>
            <div style={S.btnRow}>
              <button style={{ ...S.btn, ...S.btnGreen }} onClick={setAllBehärskad}>
                All behärskad
              </button>
              <button style={{ ...S.btn }} onClick={setAllPåVäg}>
                All på väg
              </button>
              <button style={{ ...S.btn }} onClick={setMixed}>
                Mixed ~25% each
              </button>
              <button style={{ ...S.btn, ...S.btnRed }} onClick={clearProgress}>
                Clear all
              </button>
            </div>
            <div style={S.inputRow}>
              <button style={{ ...S.btn, ...S.btnRed }} onClick={setWrongPool}>
                Wrong pool
              </button>
              <input
                style={S.input}
                type="number"
                min="1" max="100"
                value={wrongPct}
                onChange={e => setWrongPct(e.target.value)}
              />
              <span style={{ color: "#555", fontSize: "10px" }}>% of Qs</span>
            </div>
          </div>

          {/* ── 2. Saved questions ───────────────────────── */}
          <div style={S.section}>
            <div style={S.sectionTitle}>2 · Saved questions</div>
            <div style={S.btnRow}>
              <button style={{ ...S.btn, ...S.btnGold }} onClick={addSavedBatch}>
                Add 10 saved
              </button>
              <button style={{ ...S.btn, ...S.btnRed }} onClick={clearSaved}>
                Clear saved
              </button>
            </div>
          </div>

          {/* ── 3. Quiz history ──────────────────────────── */}
          <div style={S.section}>
            <div style={S.sectionTitle}>3 · Quiz history</div>
            <div style={S.btnRow}>
              <button style={{ ...S.btn, ...S.btnGreen }} onClick={genStrongHistory}>
                Strong results
              </button>
              <button style={{ ...S.btn, ...S.btnRed }} onClick={genWeakHistory}>
                Weak results
              </button>
              <button style={{ ...S.btn }} onClick={genMixedHistory}>
                Mixed results
              </button>
              <button style={{ ...S.btn, ...S.btnRed }} onClick={clearHistory}>
                Clear history
              </button>
            </div>
          </div>

          {/* ── 4. Challenges ────────────────────────────── */}
          <div style={S.section}>
            <div style={S.sectionTitle}>4 · Challenges</div>

            {/* Streak */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ color: "#666", fontSize: "9px", marginBottom: "4px" }}>Dagens fråga streak</div>
              <div style={S.inputRow}>
                <input style={S.input} type="number" min="0" value={streakVal} onChange={e => setStreakVal(e.target.value)} placeholder="streak" />
                <span style={{ color: "#555", fontSize: "9px" }}>streak</span>
                <input style={S.input} type="number" min="0" value={bestVal}   onChange={e => setBestVal(e.target.value)}   placeholder="best" />
                <span style={{ color: "#555", fontSize: "9px" }}>best</span>
                <button style={{ ...S.btn, ...S.btnGold }} onClick={setStreak}>Set</button>
              </div>
            </div>

            {/* Daily answered */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ color: "#666", fontSize: "9px", marginBottom: "4px" }}>Today's answer</div>
              <div style={S.btnRow}>
                <button style={{ ...S.btn, ...S.btnGreen }} onClick={() => setDailyAnswered(true)}>
                  Mark correct
                </button>
                <button style={{ ...S.btn, ...S.btnRed }} onClick={() => setDailyAnswered(false)}>
                  Mark wrong
                </button>
                <button style={{ ...S.btn }} onClick={resetDailyAnswered}>
                  Reset (unanswered)
                </button>
              </div>
            </div>

            {/* Rätt i rad */}
            <div>
              <div style={{ color: "#666", fontSize: "9px", marginBottom: "4px" }}>Rätt i rad best</div>
              <div style={S.inputRow}>
                <input style={S.input} type="number" min="0" value={rirVal} onChange={e => setRirVal(e.target.value)} />
                <button style={{ ...S.btn, ...S.btnGold }} onClick={setRirRecord}>Set</button>
                <button style={{ ...S.btn, ...S.btnRed }}  onClick={clearRir}>Clear</button>
              </div>
            </div>
          </div>

          {/* ── 5. Checklist & onboarding ─────────────────── */}
          <div style={S.section}>
            <div style={S.sectionTitle}>5 · Checklist & onboarding</div>
            <div style={S.btnRow}>
              <button style={{ ...S.btn, ...S.btnGreen }} onClick={completeChecklist}>
                Complete all
              </button>
              <button style={{ ...S.btn, ...S.btnRed }} onClick={clearChecklist}>
                Clear checklist
              </button>
            </div>
            <div style={{ ...S.btnRow, marginTop: "6px" }}>
              <button style={{ ...S.btn, ...S.btnGold }} onClick={restartOnboarding}>
                Restart onboarding
              </button>
              <button style={{ ...S.btn }} onClick={skipOnboarding}>
                Mark done
              </button>
            </div>
          </div>

          {/* ── 6. Notifications ─────────────────────────────── */}
          <div style={S.section}>
            <div style={S.sectionTitle}>6 · Notifications</div>

            {/* ── State display ─── */}
            <div style={{ fontSize: "9px", color: "#555", lineHeight: 1.8, marginBottom: "8px", fontFamily: "monospace" }}>

              {/* Platform + permission row */}
              <div>
                platform:{" "}
                <span style={{ color: isNative() ? "#7b9fff" : "#d4b050" }}>
                  {isNative() ? "native" : "web"}
                </span>
                {"  "}permission:{" "}
                <span style={{
                  color: permDisplay === "granted" ? "#70d090"
                       : permDisplay === "…"       ? "#444"
                       : "#e07070",
                  fontWeight: 600,
                }}>
                  {permDisplay}
                </span>
              </div>

              {/* Web tab-focus row — only meaningful on web */}
              {!isNative() && (
                <div>
                  tab:{" "}
                  <span style={{ color: tabFocused ? "#e07070" : "#70d090", fontWeight: 600 }}>
                    {tabFocused ? "focused ← popups suppressed" : "unfocused ✓ visible delivery ok"}
                  </span>
                </div>
              )}

              {/* Settings row */}
              <div>
                enabled: {String(notifSettings?.enabled ?? "?")}
                {"  "}timing: {notifSettings?.timing ?? "?"}
                {"  "}lang: {lang}
              </div>

              {/* State row */}
              <div>
                paused:{" "}
                <span style={{ color: notifState.paused ? "#e07070" : "#555" }}>
                  {String(notifState.paused)}
                </span>
                {"  "}sentCount: {notifState.sentCount}
                {"  "}lastActivity:{" "}
                {notifState.lastActivity
                  ? new Date(notifState.lastActivity).toLocaleDateString("en-GB")
                  : <span style={{ color: "#e07070" }}>never</span>}
              </div>

              {/* Channel + schedule window */}
              <div>
                channel:{" "}
                <span style={{ color: "#70d090", fontWeight: 600 }}>{CHANNEL_ID}</span>
                <span style={{ color: "#333", fontSize: "8px" }}>{" "}(legacy: {CHANNEL_ID_LEGACY})</span>
              </div>
              <div>
                nextWindow:{" "}
                <span style={{ color: "#7b9fff" }}>
                  {notifSettings
                    ? nextTimingWindowDate(notifSettings.timing).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })
                    : "?"}
                </span>
              </div>

              {/* Pending (native only) */}
              {isNative() && (
                <div>
                  pending:{" "}
                  <span style={{ color: pendingNotifs.length > 0 ? "#70d090" : "#444" }}>
                    {pendingNotifs.length === 0
                      ? "none"
                      : pendingNotifs.map(n =>
                          `#${n.id} @ ${new Date(n.schedule?.at ?? 0).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`
                        ).join(", ")}
                  </span>
                </div>
              )}
            </div>

            {/* ── Foreground suppression warning ─── */}
            <div style={{
              fontSize: "9px", lineHeight: 1.5, borderRadius: "4px",
              padding: "6px 8px", marginBottom: "10px",
              background: "rgba(180,140,40,0.08)",
              border: "1px solid rgba(180,140,40,0.22)",
              color: "#7a6830",
            }}>
              {isNative()
                ? <>
                    <span style={{ color: "#d4b050", fontWeight: 700 }}>Android foreground:</span> heads-up popup is suppressed
                    by the OS while the app is open — regardless of channel importance.
                    The notification IS delivered to the shade; pull it down to confirm.{" "}
                    <span style={{ color: "#d4b050" }}>Use "Notify in Ns" below and press Home before the countdown ends.</span>
                  </>
                : <>
                    <span style={{ color: "#d4b050", fontWeight: 700 }}>Browser foreground:</span> Chrome/Firefox suppress Web
                    Notifications while the originating tab is focused.
                    "Fire now" will be silently dropped if the tab is active.{" "}
                    <span style={{ color: "#d4b050" }}>Use "Notify in Ns" and switch tabs before countdown ends.</span>
                  </>
              }
            </div>

            {/* ── Permission ─── */}
            <div style={{ marginBottom: "10px" }}>
              <div style={S.sectionTitle} >Permission</div>
              <div style={S.btnRow}>
                <button style={{ ...S.btn, ...S.btnGold }} onClick={async () => {
                  const r       = await requestNotifPermission();
                  const checked = await checkNotifPermission();
                  setPermDisplay(checked);
                  flash(`requested: ${r}  checked: ${checked}`);
                }}>Request</button>
                <button style={{ ...S.btn }} onClick={async () => {
                  const r = await checkNotifPermission();
                  setPermDisplay(r);
                  flash(`Permission: ${r}`);
                }}>Refresh</button>
              </div>
            </div>

            {/* ── Delayed visible test (primary test path) ─── */}
            <div style={{ marginBottom: "10px" }}>
              <div style={S.sectionTitle}>Visible delivery test</div>

              {/* Countdown display */}
              {countdown > 0 && (
                <div style={{
                  fontSize: "11px", fontWeight: 700, fontFamily: "monospace",
                  color: "#FFBE2E", marginBottom: "6px", letterSpacing: "0.5px",
                }}>
                  {isNative()
                    ? `⏱ Press Home now — firing in ${countdown}s`
                    : `⏱ Switch tabs now — firing in ${countdown}s`}
                </div>
              )}
              {countdown === 0 && (
                <div style={{ fontSize: "9px", color: "#444", marginBottom: "6px" }}>
                  {isNative()
                    ? "→ click, then press Home before countdown ends"
                    : "→ click, then switch to another tab before countdown ends"}
                </div>
              )}

              <div style={S.btnRow}>
                <button style={{ ...S.btn, ...S.btnGreen }} onClick={() => startDelayedTest(5)}>
                  Notify in 5s
                </button>
                <button style={{ ...S.btn, ...S.btnGreen }} onClick={() => startDelayedTest(10)}>
                  Notify in 10s
                </button>
                {countdown > 0 && (
                  <button style={{ ...S.btn, ...S.btnRed }} onClick={() => {
                    if (countdownRef.current) clearInterval(countdownRef.current);
                    setCountdown(0);
                    flash("Test cancelled");
                  }}>Cancel</button>
                )}
              </div>
            </div>

            {/* ── Fire now (foreground check only) ─── */}
            <div style={{ marginBottom: "10px" }}>
              <div style={S.sectionTitle}>Fire now (foreground — shade only)</div>
              <div style={S.btnRow}>
                <button style={{ ...S.btn, ...S.btnGold }} onClick={async () => {
                  const c = getStudyCopy(lang);
                  const r = await fireNotification(c.title, c.body);
                  flash(r.ok ? `fired: "${c.title}"` : `fail: ${r.reason}`);
                }}>Study</button>
                <button style={{ ...S.btn }} onClick={async () => {
                  const c = getMoodCopy(lang);
                  const r = await fireNotification(c.title, c.body);
                  flash(r.ok ? `fired: "${c.title}"` : `fail: ${r.reason}`);
                }}>Mood</button>
                <button style={{ ...S.btn }} onClick={async () => {
                  const c = getFarewellCopy(lang);
                  const r = await fireNotification(c.title, c.body, { tag: "taxi-teori-farewell" });
                  flash(r.ok ? "farewell fired" : `fail: ${r.reason}`);
                }}>Farewell</button>
                <button style={{ ...S.btn }} onClick={async () => {
                  const c = getProgressCopy(lang);
                  const r = await fireNotification(c.title, c.body);
                  flash(r.ok ? `fired: "${c.title}"` : `fail: ${r.reason}`);
                }}>Progress</button>
                <button style={{ ...S.btn }} onClick={async () => {
                  const c = getReactivationCopy(lang);
                  const r = await fireNotification(c.title, c.body);
                  flash(r.ok ? "reactivation fired" : `fail: ${r.reason}`);
                }}>Reactivation</button>
              </div>
            </div>

            {/* ── Schedule controls ─── */}
            <div style={{ marginBottom: "10px" }}>
              <div style={S.sectionTitle}>Schedule (background delivery)</div>
              <div style={S.btnRow}>
                <button style={{ ...S.btn, ...S.btnGreen }} onClick={async () => {
                  const r = await scheduleNextReminder(notifSettings ?? { enabled: true, timing: "evening" }, lang);
                  getPendingReminders().then(setPendingNotifs).catch(() => {});
                  flash(`schedule: ${r}`);
                }}>Schedule next</button>
                <button style={{ ...S.btn, ...S.btnRed }} onClick={async () => {
                  await cancelScheduledReminders();
                  setPendingNotifs([]);
                  flash("all cancelled");
                }}>Cancel all</button>
                <button style={{ ...S.btn }} onClick={async () => {
                  const p = await getPendingReminders();
                  setPendingNotifs(p);
                  flash(`pending: ${p.length}`);
                }}>Refresh</button>
              </div>
            </div>

            {/* ── State manipulation ─── */}
            <div>
              <div style={S.sectionTitle}>State</div>
              <div style={S.btnRow}>
                <button style={{ ...S.btn, ...S.btnRed }} onClick={() => {
                  simulateInactivity(8);
                  setNotifState(loadNotifState());
                  flash("inactivity: 8d, sentCount=3");
                }}>8d inactive</button>
                <button style={{ ...S.btn, ...S.btnGreen }} onClick={() => {
                  resetNotifState();
                  setNotifState(loadNotifState());
                  flash("state reset");
                }}>Reset</button>
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────── */}
          <div style={{ padding: "8px 14px", borderTop: "1px solid #1a1a1a" }}>
            <div style={{ color: "#3a3a3a", fontSize: "9px", letterSpacing: "0.5px" }}>
              DEV ONLY · import.meta.env.DEV · not in production build
            </div>
          </div>

        </div>
      )}
    </>
  );
}
