/**
 * DevPanel — internal developer/debug tool
 *
 * Only rendered when import.meta.env.DEV === true (Vite development server).
 * This file is never bundled into a production build, but as an extra safety
 * net the component also checks the flag at runtime before rendering anything.
 *
 * How to open: click the small "DEV" tab anchored to the bottom-right corner.
 */

import { useState } from "react";

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
  panel: {
    position: "fixed",
    bottom: 0,
    right: 0,
    width: "320px",
    maxHeight: "82vh",
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
}) {
  // Extra runtime guard — never render in production even if accidentally imported
  if (!import.meta.env.DEV) return null;

  const [open,       setOpen]       = useState(false);
  const [toast,      setToast]      = useState("");
  const [streakVal,  setStreakVal]  = useState("5");
  const [bestVal,    setBestVal]    = useState("10");
  const [rirVal,     setRirVal]     = useState("12");
  const [wrongPct,   setWrongPct]   = useState("30");

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating trigger tab */}
      <div style={S.tab} onClick={() => setOpen(o => !o)}>
        {open ? "✕ DEV" : "DEV"}
      </div>

      {/* Toast notification */}
      {toast && <div style={S.toast}>{toast}</div>}

      {/* Panel */}
      {open && (
        <div style={S.panel}>

          {/* Header */}
          <div style={S.header}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#7b9fff", letterSpacing: "1px" }}>
              DEV PANEL
            </span>
            <span style={{ fontSize: "9px", color: "#555" }}>
              {questions.length} Q · install {installId.slice(-6)}
            </span>
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
