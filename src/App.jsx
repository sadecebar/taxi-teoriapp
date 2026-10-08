import { storage } from './storage.js';
import { useState, useEffect, useRef } from "react";
import { getInstallationId } from "./installation.js";

// ─── Stable per-device ID (resolved once at module load) ──────────────────────
const INSTALL_ID = getInstallationId();
import { supabase } from "./supabase.js";
import { loadLocalStats, saveAllStats, clearLocalStats, hasMigrated, markMigrated, loadRecentQuestions, clearRecentQuestions, commitPracticeAnswer } from "./progress.js";
import { getQuestionStatus as questionStatus, shuffle, selectFocusQuestions, weightedPickQuestions, commitQuizAnswer, advanceQuiz } from "./practice.js";
import { DELPROV_CONFIG, isExamMode, createQuiz, selectExamAnswer, moveExam, quizResult } from './exam.js';
import { loadSession, saveSession, clearSession } from './quiz-session.js';
import { connectMobile, answerHaptic, setMobileTheme } from "./mobile.js";
import { remainingSeconds } from "./mobile-timer.js";
import { sv } from "./locales/sv.js";
import { en } from "./locales/en.js";
import { QUESTIONS_EN } from "./locales/questions-en.js";
import {
  loadNotifSettings, saveNotifSettings,
  recordActivity, checkAndFireOnOpen,
  scheduleNextReminder,
} from "./notifications.js";


import { ensureNotifChannel } from './notif-platform.js';
import { canonicalReviewQuestions } from './review.js';
import { QUESTIONS, QUICK_HISTORY_SIZE, QUICK_RECENCY_WEIGHTS, CHECKLIST_STEPS, CHECKLIST_STEPS_EN, initDailyData } from './study-data.js';
import MobileDesign from './design/MobileDesign.jsx';
import { appendStudyHistory, coveragePercent } from './study-insights.js';
export default function App() {
  // ── Language ─────────────────────────────────────────────────────────────
  const [lang, setLangState] = useState(() => {
    try { return storage.getItem('taxi-teori-language') || 'sv'; } catch { return 'sv'; }
  });
  const setLang = (l) => {
    setLangState(l);
    try { storage.setItem('taxi-teori-language', l); } catch { /* Storage backend reports write errors to the app. */ }
  };
  // ── Notification + feedback settings ────────────────────────────────────
  const [notifSettings, setNotifSettingsState] = useState(() => loadNotifSettings());
  const setNotifSettings = (next) => {
    setNotifSettingsState(next);
    saveNotifSettings(next);
    // Reschedule (or cancel) on native whenever enabled/timing changes
    if (next.enabled !== notifSettings.enabled || next.timing !== notifSettings.timing) {
      scheduleNextReminder(next, lang).catch(() => {});
    }
  };
  // Translation lookup: falls back to Swedish then to the key itself
  const T = lang === 'sv' ? sv : en;
  const t = (key) => T[key] ?? sv[key] ?? key;
  // Template: replaces {0}, {1} … with supplied values
  const tf = (key, ...args) => {
    let s = t(key);
    args.forEach((v, i) => { s = s.replace(`{${i}}`, String(v)); });
    return s;
  };
  // Translate question status key to display label
  const tStatus = (key) => ({
    "behärskad": t("status_mastered"),
    "på väg":    t("status_progressing"),
    "öva mer":   t("status_practice_more"),
    "ej övad":   t("status_untried"),
  }[key] ?? key);
  // Active checklist steps for current language
  const checklistSteps = lang === 'sv' ? CHECKLIST_STEPS : CHECKLIST_STEPS_EN;
  // Translate a question object's user-facing text fields for the current language.
  // IDs, correct index, delprov, and image are never modified.
  const tq = (q) => {
    if (lang === 'sv' || !q) return q;
    const en = QUESTIONS_EN[q.id];
    if (!en) return q;
    return { ...q, question: en.question, options: en.options, explanation: en.explanation };
  };
  // Date locale for daily question heading
  const dateLocale = lang === 'sv' ? 'sv-SE' : 'en-GB';

  // ── Theme ────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    try { return storage.getItem('taxi-teori-theme') || 'light'; } catch { return 'light'; }
  });
  const [textScale, setTextScale] = useState(() => {
    try {
      const saved = Number(storage.getItem('taxi-teori-text-scale'));
      return [1, 1.25, 1.5, 2].includes(saved) ? saved : 1;
    } catch { return 1; }
  });
  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', textScale);
    document.documentElement.dataset.largeText = String(textScale > 1);
    try { storage.setItem('taxi-teori-text-scale', textScale); } catch { /* Reported by storage. */ }
  }, [textScale]);
  // ── State ────────────────────────────────────────────────────────────────
  const [restoredSession] = useState(() => loadSession(QUESTIONS));
  const [view,          setView]          = useState("home");
  const [mode,          setMode]          = useState(restoredSession?.mode ?? null);
  const [quiz,          setQuiz]          = useState(restoredSession?.quiz ?? null);
  // Updated synchronously in event handlers so rapid clicks/timeout see committed answers.
  const quizRef = useRef(restoredSession?.quiz ?? null);
  const [timeLeft,      setTimeLeft]      = useState(() => remainingSeconds(restoredSession?.deadline ?? null));
  const [flashIdx,      setFlashIdx]      = useState(0);
  const [flipped,       setFlipped]       = useState(false);
  const [flashcards,    setFlashcards]    = useState([]);
  const [storageError, setStorageError] = useState(() => storage.getError());
  useEffect(() => storage.subscribe(setStorageError), []);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [result,        setResult]        = useState(null);
  const [statsLoaded,   setStatsLoaded]   = useState(() => {
    const local = loadLocalStats();
    return local !== null || hasMigrated();
  });
  const [statusFilter,  setStatusFilter]  = useState("alla");
  const [stats,         setStats]         = useState(() => {
    const base = Object.fromEntries(QUESTIONS.map(q => [q.id, { c: 0, w: 0 }]));
    const local = loadLocalStats();
    if (local) {
      Object.keys(local).forEach(id => { if (base[id]) base[id] = local[id]; });
    }
    return base;
  });
  const statsRef = useRef(stats);
  const getQuestionStatus = (q) => questionStatus(q, stats);
  const [,              setShakeBtn]      = useState(null);
  const [popupQ,        setPopupQ]        = useState(null);
  const [statsQuestion,    setStatsQuestion]    = useState(null);
  const [statsSelected,    setStatsSelected]    = useState(null);
  const [statsAnswered,    setStatsAnswered]    = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [fragorFilter,     setFragorFilter]     = useState(null);
  const HISTORY_KEY = `taxi-teori-history-${INSTALL_ID}`;
  const [quizHistory, setQuizHistory] = useState(() => {
    try { return JSON.parse(storage.getItem(`taxi-teori-history-${INSTALL_ID}`) || "[]"); }
    catch { return []; }
  });
  // Stores arrays of question IDs from the last QUICK_HISTORY_SIZE quick tests.
  // Shape: [[id, id, …], [id, id, …], …]  — index 0 = most recent.
  const [quickTestHistory, setQuickTestHistory] = useState(() => {
    try { return JSON.parse(storage.getItem(`taxi-teori-quick-hist-${INSTALL_ID}`) || "[]"); }
    catch { return []; }
  });
  const SAVED_KEY = `taxi-teori-saved-${INSTALL_ID}`;
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(storage.getItem(`taxi-teori-saved-${INSTALL_ID}`) || "[]"); }
    catch { return []; }
  });
  const DAILY_KEY     = `taxi-teori-daily-${INSTALL_ID}`;
  const RIR_KEY       = `taxi-teori-rir-${INSTALL_ID}`;
  const CHECKLIST_KEY = `taxi-teori-checklist-${INSTALL_ID}`;
  const [dailyData,     setDailyData]     = useState(() => initDailyData(INSTALL_ID));
  const [rirBest,       setRirBest]       = useState(() => {
    try { return parseInt(storage.getItem(`taxi-teori-rir-${INSTALL_ID}`) || "0") || 0; } catch { return 0; }
  });
  const [checklistDone, setChecklistDone] = useState(() => {
    try {
      const raw = storage.getItem(`taxi-teori-checklist-${INSTALL_ID}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const [showOnboarding,   setShowOnboarding]   = useState(
    () => storage.getItem(`taxi-teori-onboarding-done-${INSTALL_ID}`) !== "1"
  );

  const timer      = useRef(null);
  const deadline  = useRef(restoredSession?.deadline ?? null);
  const mobileBack = useRef(() => false);
  const explainRef = useRef(null);
  const audioCtx   = useRef(null);
  const mainRef    = useRef(null);

  mobileBack.current = () => {
    if (showResetConfirm) { setShowResetConfirm(false); return true; }
    if (popupQ) { setPopupQ(null); return true; }
    if (statsQuestion) { setStatsQuestion(null); return true; }
    if (fragorFilter) { setFragorFilter(null); return true; }
    if (view === "quiz") {
      leaveQuiz();
      return true;
    }
    if (view === 'flashcard') { setView('utmaningar'); return true; }
    if (view === 'utmaningar') { setView('fragor'); return true; }
    if (['installningar', 'checklista'].includes(view)) { setView('mer'); return true; }
    if (view !== 'home') { setView('home'); return true; }
    return false;
  };
  useEffect(() => connectMobile(
    () => mobileBack.current(),
    () => { if (deadline.current !== null) setTimeLeft(remainingSeconds(deadline.current)); }
  ), []);

  // ── Theme DOM sync ───────────────────────────────────────────────────────
  useEffect(() => {
    try { storage.setItem('taxi-teori-theme', theme); } catch { /* Storage backend reports write errors to the app. */ }
    document.documentElement.setAttribute('data-theme', theme);
    setMobileTheme(theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D0D14' : '#F5F4EF');
  }, [theme]);

  // ── One-time migration: copy Supabase stats → storage ──────────────
  useEffect(() => {
    if (hasMigrated()) return;                    // already done
    if (loadLocalStats() !== null || !supabase) { // local-only installs need no server
      markMigrated();
      setStatsLoaded(true);
      return;
    }
    async function migrate() {
      try {
        const { data, error } = await supabase
          .from("stats")
          .select("*")
          .eq("installation_id", INSTALL_ID);
        if (error) throw error;
        if (data && data.length > 0) {
          const merged = Object.fromEntries(QUESTIONS.map(q => [q.id, { c: 0, w: 0 }]));
          data.forEach(row => {
            if (merged[row.question_id] !== undefined)
              merged[row.question_id] = { c: row.correct, w: row.wrong };
          });
          saveAllStats(merged);
          setStats(merged);
        }
      } catch (e) {
        console.error("Could not migrate stats from Supabase:", e);
      } finally {
        markMigrated();
        setStatsLoaded(true);
      }
    }
    migrate();
  }, []);

  // ── Commit counters and recent history before showing answer feedback ───
  const saveAnswer = (questionId, correct) => {
    const updated = commitPracticeAnswer(statsRef.current, questionId, correct);
    statsRef.current = updated;
    setStats(updated);
  };

  // ── Sync stats to storage whenever they change ───────────────────────
  useEffect(() => {
    statsRef.current = stats;
    saveAllStats(stats);
  }, [stats]);

  // ── Notifications: init channel + schedule/fire on app open (once at mount) ─
  useEffect(() => {
    ensureNotifChannel().catch(() => {});           // Android channel setup (idempotent, no-op on web)
    scheduleNextReminder(notifSettings, lang).catch(() => {}); // native: schedule next; web: no-op
    checkAndFireOnOpen(notifSettings, lang).catch(() => {});   // web: fire if in window; native: no-op
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset all progress ────────────────────────────────────────────────────
  const resetAllProgress = () => {
    clearSession();
    quizRef.current = null;
    setQuiz(null);
    deadline.current = null;
    clearTimeout(timer.current);
    setTimeLeft(null);
    clearLocalStats();
    clearRecentQuestions();
    setStats(Object.fromEntries(QUESTIONS.map(q => [q.id, { c: 0, w: 0 }])));
    setQuizHistory([]);
    try { storage.removeItem(`taxi-teori-history-${INSTALL_ID}`); } catch { /* Storage backend reports write errors to the app. */ }
    setQuickTestHistory([]);
    try { storage.removeItem(`taxi-teori-quick-hist-${INSTALL_ID}`); } catch { /* Storage backend reports write errors to the app. */ }
    setSavedIds([]);
    try { storage.removeItem(`taxi-teori-saved-${INSTALL_ID}`); } catch { /* Storage backend reports write errors to the app. */ }
    try { storage.removeItem(`taxi-teori-daily-${INSTALL_ID}`); } catch { /* Storage backend reports write errors to the app. */ }
    try { storage.removeItem(`taxi-teori-rir-${INSTALL_ID}`); } catch { /* Storage backend reports write errors to the app. */ }
    try { storage.removeItem(`taxi-teori-checklist-${INSTALL_ID}`); } catch { /* Storage backend reports write errors to the app. */ }
    setRirBest(0);
    setChecklistDone(new Set());
    setDailyData(initDailyData(INSTALL_ID));
    setShowResetConfirm(false);
    // Re-trigger onboarding for this installation only
    storage.removeItem(`taxi-teori-onboarding-done-${INSTALL_ID}`);
    setView("home");
    setShowOnboarding(true);
  };

  // ── Save / bookmark a question ────────────────────────────────────────────
  const toggleSave = (questionId) => {
    setSavedIds(prev => {
      const next = prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId];
      try { storage.setItem(`taxi-teori-saved-${INSTALL_ID}`, JSON.stringify(next)); } catch { /* Storage backend reports write errors to the app. */ }
      return next;
    });
  };

  // ── Daily question answer ─────────────────────────────────────────────────
  const answerDaily = (chosenIdx) => {
    if (dailyData.answered) return;
    const q = QUESTIONS.find(q => q.id === dailyData.questionId);
    if (!q) return;
    const correct = chosenIdx === q.correct;
    if (correct) playPling();
    else { playBuzz(); setShakeBtn(chosenIdx); setTimeout(() => setShakeBtn(null), 500); }
    const newStreak  = correct ? dailyData.streak + 1 : 0;
    const newBest    = Math.max(dailyData.bestStreak || 0, newStreak);
    const newData    = { ...dailyData, answered: true, chosenIdx, correct, streak: newStreak, bestStreak: newBest };
    setDailyData(newData);
    try { storage.setItem(DAILY_KEY, JSON.stringify(newData)); } catch { /* Storage backend reports write errors to the app. */ }
    saveAnswer(q.id, correct);
  };

  // ── Checklist step toggle ─────────────────────────────────────────────────
  const toggleChecklistStep = (idx) => {
    setChecklistDone(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      try { storage.setItem(CHECKLIST_KEY, JSON.stringify([...next])); } catch { /* Storage backend reports write errors to the app. */ }
      return next;
    });
  };

  // ── Onboarding handlers ───────────────────────────────────────────────────
  const handleOnboardingDone = () => {
    storage.setItem(`taxi-teori-onboarding-done-${INSTALL_ID}`, "1");
    setShowOnboarding(false);
  };

  // ── Audio feedback ────────────────────────────────────────────────────────
  const playPling = () => {
    try {
      if (notifSettings.sound) {
        if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = audioCtx.current;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
      }
      if (notifSettings.vibration) answerHaptic(true);
    } catch { /* Audio feedback is optional on unsupported devices. */ }
  };

  const playBuzz = () => {
    try {
      if (notifSettings.sound) {
        if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = audioCtx.current;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
      }
      if (notifSettings.vibration) answerHaptic(false);
    } catch { /* Audio feedback is optional on unsupported devices. */ }
  };

  // ── Scroll to explanation after answering ────────────────────────────────
  useEffect(() => {
    if (!isExamMode(mode) && quiz?.answered !== null && quiz?.answered !== undefined && explainRef.current) {
      setTimeout(() => {
        explainRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: "nearest" });
      }, 180);
    }
  }, [quiz?.answered, mode]);

  // ── Reset scroll to top on every view change ─────────────────────────────
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [view]);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (view === "quiz" && timeLeft !== null) {
      if (timeLeft <= 0) { endQuiz(); return; }
      timer.current = setTimeout(() => setTimeLeft(remainingSeconds(deadline.current)), 1000);
    }
    return () => clearTimeout(timer.current);
  // The timer reads the synchronous quiz ref; recreating on each answer is unnecessary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, timeLeft]);

  // ── Quiz logic ────────────────────────────────────────────────────────────
  const getQs = (m) => {
    if (m === "all" || m === "quick" || m === "rir") return QUESTIONS;
    if (m === "bilder") return QUESTIONS.filter(q => q.image);
    return QUESTIONS.filter(q => q.delprov === m);
  };

  const updateQuiz = (updated, activeMode = mode) => {
    quizRef.current = updated;
    setQuiz(updated);
    saveSession(updated, activeMode, deadline.current);
  };
  const leaveQuiz = () => {
    clearTimeout(timer.current);
    saveSession(quizRef.current, mode, deadline.current);
    setView('home');
  };
  const resumeQuiz = () => {
    if (deadline.current !== null && remainingSeconds(deadline.current) === 0) { endQuiz(); return; }
    setTimeLeft(remainingSeconds(deadline.current));
    setView('quiz');
  };
  const moveToQuestion = (index) => {
    if (deadline.current !== null && remainingSeconds(deadline.current) === 0) { endQuiz(); return; }
    updateQuiz(moveExam(quizRef.current, index));
    mainRef.current?.scrollTo({ top: 0 });
  };
  const [confirmation, setConfirmation] = useState(null);
  const submitExam = () => {
    const current = quizRef.current;
    if (!current || current.finished) return;
    if (remainingSeconds(deadline.current) === 0) endQuiz();
    else setConfirmation({ message: tf('exam_submit_confirm', current.questions.length - current.answers.length), action: endQuiz });
  };

  const startQuiz = (m, selectedQuestions = [], replaceConfirmed = false) => {
    if (QUESTIONS.length === 0) return;
    const baseMode = (m === 10 || m === 20 || m === 30) ? "all" : m;
    let qs;
    if (m === "review") {
      qs = shuffle(canonicalReviewQuestions(selectedQuestions, QUESTIONS));
    } else if (m === "quick") {
      // Use recency-weighted selection so recently-seen questions are less likely to reappear.
      qs = weightedPickQuestions(QUESTIONS, quickTestHistory, 15, QUICK_RECENCY_WEIGHTS);
    } else if (m === "focus") {
      qs = selectFocusQuestions(QUESTIONS, statsRef.current, loadRecentQuestions());
    } else {
      qs = shuffle(getQs(baseMode));
    }
    if (qs.length === 0) return;
    if (quizRef.current && !quizRef.current.finished && !replaceConfirmed) {
      setConfirmation({ message: t('quiz_replace_confirm'), action: () => startQuiz(m, selectedQuestions, true) });
      return;
    }
    clearTimeout(timer.current);
    setFragorFilter(null);
    setStatsQuestion(null);
    setPopupQ(null);
    if (m === "bilder") qs = qs.slice(0, 15);
    if (m === 1)       qs = qs.slice(0, 70);
    if (m === 2)       qs = qs.slice(0, 50);
    if (m === "rir")   qs = qs.slice(0, 200);
    if (m === 10 || m === 20 || m === 30) qs = qs.slice(0, m);
    const timeLimit = (m === 1 || m === 2) ? DELPROV_CONFIG[m].time * 60 : null;
    deadline.current = timeLimit === null ? null : Date.now() + timeLimit * 1000;
    setMode(m);
    updateQuiz(createQuiz(qs, m), m);
    setTimeLeft(timeLimit);
    setResult(null);
    setShakeBtn(null);
    setView("quiz");
  };

  const answer = (i) => {
    if (deadline.current !== null && remainingSeconds(deadline.current) === 0) { endQuiz(); return; }
    if (isExamMode(mode)) {
      updateQuiz(selectExamAnswer(quizRef.current, i));
      return;
    }
    const current = quizRef.current;
    const committed = commitQuizAnswer(current, i);
    if (committed === current) return;
    updateQuiz(committed);
    const attempt = committed.answers[committed.answers.length - 1];
    saveAnswer(attempt.id, attempt.correct);
    if (attempt.correct) { playPling(); }
    else { playBuzz(); setShakeBtn(i); setTimeout(() => setShakeBtn(null), 500); }
  };

  const next = () => {
    const current = quizRef.current;
    const advanced = advanceQuiz(current, mode);
    if (advanced === current) return;
    if (advanced.finished) { endQuiz(); return; }
    updateQuiz(advanced);
  };

  const endQuiz = () => {
    const current = quizRef.current;
    if (!current || current.finished) return;
    setConfirmation(null);
    quizRef.current = { ...current, finished: true };
    setQuiz(quizRef.current);
    const summary = quizResult(current, mode);
    const { score, total, answers, pct, passed, scoringVersion } = summary;
    const expired = deadline.current !== null && remainingSeconds(deadline.current) === 0;
    if (isExamMode(mode)) current.answers.forEach(a => saveAnswer(a.id, a.correct));
    deadline.current = null;
    clearTimeout(timer.current);
    const record = { ts: Date.now(), mode, score, total, pct, passed, scoringVersion };
    const newHistory = appendStudyHistory(record, quizHistory);
    setQuizHistory(newHistory);
    try { storage.setItem(`taxi-teori-history-${INSTALL_ID}`, JSON.stringify(newHistory)); } catch { /* Storage backend reports write errors to the app. */ }
    if (mode === "quick") {
      // Prepend the IDs from this test and keep only QUICK_HISTORY_SIZE slots.
      const ids = answers.map(a => a.id);
      const newQuickHist = [ids, ...quickTestHistory].slice(0, QUICK_HISTORY_SIZE);
      setQuickTestHistory(newQuickHist);
      try { storage.setItem(`taxi-teori-quick-hist-${INSTALL_ID}`, JSON.stringify(newQuickHist)); } catch { /* Storage backend reports write errors to the app. */ }
    }
    if (mode === "rir") {
      const newBest = Math.max(rirBest, score);
      setRirBest(newBest);
      try { storage.setItem(`taxi-teori-rir-${INSTALL_ID}`, String(newBest)); } catch { /* Storage backend reports write errors to the app. */ }
    }
    clearSession();
    setReviewFilter('all');
    setResult({ ...summary, expired });
    recordActivity(lang, notifSettings);
    setView("result");
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  // All counts are derived from QUESTIONS (not raw stats entries) to avoid
  // orphaned stats for deleted/replaced question IDs skewing the numbers.
  const tot      = QUESTIONS.reduce((a, q) => { const s = stats[q.id] || { c: 0, w: 0 }; return a + s.c + s.w; }, 0);
  const corr     = QUESTIONS.reduce((a, q) => { const s = stats[q.id] || { c: 0, w: 0 }; return a + s.c; }, 0);
  const acc      = tot > 0 ? Math.round(corr / tot * 100) : 0;
  const mastered = QUESTIONS.filter(q => getQuestionStatus(q) === "behärskad").length;

  const dpProgress = [1, 2].map(dp => {
    const qs        = QUESTIONS.filter(q => q.delprov === dp);
    const dpS       = qs.map(q => stats[q.id] || { c: 0, w: 0 });
    const dpTot     = dpS.reduce((a, b) => a + b.c + b.w, 0);
    const dpCorr    = dpS.reduce((a, b) => a + b.c, 0);
    const dpMastered = qs.filter(q => getQuestionStatus(q) === "behärskad").length;
    const dpAcc     = dpTot > 0 ? Math.round(dpCorr / dpTot * 100) : 0;
    const dpPct     = coveragePercent(dpMastered, qs.length);
    return { dp, cfg: DELPROV_CONFIG[dp], total: qs.length, mastered: dpMastered, acc: dpAcc, pct: dpPct, tried: dpTot > 0 };
  });

  const wrongCount = QUESTIONS.filter(q => getQuestionStatus(q) === "öva mer").length;

  const masterPct     = coveragePercent(mastered, QUESTIONS.length);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openFlashcards = () => {
    const random = shuffle(QUESTIONS).slice(0, 5);
    setFlashcards(random);
    setFlashIdx(0);
    setFlipped(false);
    setView("flashcard");
  };

  return <MobileDesign app={{confirmation,setConfirmation,lang,setLang,t,tf,tq,tStatus,dateLocale,theme,setTheme,textScale,setTextScale,view,setView,mode,quiz,timeLeft,flashIdx,setFlashIdx,flipped,setFlipped,flashcards,storageError,reviewFilter,setReviewFilter,result,statsLoaded,statusFilter,setStatusFilter,stats,getQuestionStatus,popupQ,setPopupQ,statsQuestion,setStatsQuestion,statsSelected,setStatsSelected,statsAnswered,setStatsAnswered,showResetConfirm,setShowResetConfirm,fragorFilter,setFragorFilter,quizHistory,savedIds,dailyData,rirBest,checklistDone,checklistSteps,toggleChecklistStep,showOnboarding,handleOnboardingDone,notifSettings,setNotifSettings,saveAnswer,playPling,playBuzz,toggleSave,answerDaily,resetAllProgress,leaveQuiz,resumeQuiz,moveToQuestion,submitExam,startQuiz,answer,next,endQuiz,tot,corr,acc,mastered,masterPct,dpProgress,wrongCount,openFlashcards,mainRef,explainRef}} />;
}
