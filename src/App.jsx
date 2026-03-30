import { useState, useEffect, useRef, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import "./App.css";
import OnboardingTour from "./OnboardingTour.jsx";
// DevPanel: static import is fine — the component guards itself with
// `if (!import.meta.env.DEV) return null`, and Vite dead-code-eliminates
// the render site `{import.meta.env.DEV && <DevPanel />}` in production.
import DevPanel from "./DevPanel.jsx";
import { getInstallationId } from "./installation.js";

// ─── Stable per-device ID (resolved once at module load) ──────────────────────
const INSTALL_ID = getInstallationId();
import { supabase } from "./supabase.js";
import { loadLocalStats, saveAllStats, clearLocalStats, hasMigrated, markMigrated } from "./progress.js";
import { QUESTIONS as importedQuestions } from "./questions.js";
import { sv } from "./locales/sv.js";
import { en } from "./locales/en.js";
import { QUESTIONS_EN } from "./locales/questions-en.js";
import {
  loadNotifSettings, saveNotifSettings,
  recordActivity, checkAndFireOnOpen,
  scheduleNextReminder, cancelScheduledReminders,
} from "./notifications.js";
import { ensureNotifChannel } from "./notif-platform.js";

// ─── Version (injected from package.json via vite.config.js) ─────────────────
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.0";

// ─── Data ─────────────────────────────────────────────────────────────────────
const QUESTIONS = importedQuestions;

const DELPROV_CONFIG = {
  1: { name: "Delprov 1", nameKey: "mode_dp1", subKey: "dp1_sub", total: 70, countedQ: 65, passMark: 48, time: 50 },
  2: { name: "Delprov 2", nameKey: "mode_dp2", subKey: "dp2_sub", total: 50, countedQ: 46, passMark: 34, time: 50 },
};

// ─── Quick Test recency config ────────────────────────────────────────────────
// How many recent Quick Tests to remember for weighting purposes.
const QUICK_HISTORY_SIZE = 8;
// Weight multiplier per "age slot" (index 0 = appeared in last test, index 1 = 2 tests ago, …).
// 1.0 means full weight (no penalty). Values below 1.0 reduce selection probability.
// Extend or shorten this array to tune the fade-out curve.
const QUICK_RECENCY_WEIGHTS = [0.05, 0.20, 0.40, 0.60, 0.80, 1.0, 1.0, 1.0];

// ─── Checklist steps ──────────────────────────────────────────────────────────
const CHECKLIST_STEPS = [
  { title: "Säkerställ att grundkraven är uppfyllda",                app: false,
    desc:  "Du behöver ha fyllt 20 år, ha haft B-körkort i minst två år, inte ha fått körkortet återkallat under de senaste två åren och uppfylla de medicinska kraven." },
  { title: "Boka läkarundersökning",                                 app: false,
    desc:  "Innan du ansöker ska du genomgå en läkarundersökning. Läkaren utfärdar ett läkarintyg som ska lämnas in i samband med ansökan." },
  { title: "Ta ställning till om du behöver förhandsbesked",         app: false,
    desc:  "Om du är osäker på om du kan bli godkänd på grund av sjukdom eller andra medicinska hinder kan du först ansöka om förhandsbesked hos Transportstyrelsen." },
  { title: "Visa stabil provberedskap i appen",                      app: true,
    desc:  "Rekommendationen är att du har godkända resultat flera gånger i rad och känner dig trygg i både Delprov 1 och Delprov 2 innan du bokar kunskapsprovet." },
  { title: "Boka kunskapsprovet hos Trafikverket",                   app: false,
    desc:  "Kunskapsprovet består av två delprov, och du väljer själv i vilken ordning du gör dem. Delprov 1 handlar om säkerhet och beteende, och delprov 2 handlar om lagstiftning." },
  { title: "Klara båda delproven inom sex månader",                  app: false,
    desc:  "För att kunskapsprovet ska räknas som godkänt måste båda delproven vara godkända inom sex månader från det första godkända delprovet." },
  { title: "Fotografera dig inför provet",                           app: false,
    desc:  "Innan ditt första prov för taxiförarlegitimation ska du fotografera dig hos Trafikverket. Kom i god tid så att foto och kontroll hinner göras." },
  { title: "Ta med giltig legitimation till provet",                 app: false,
    desc:  "Vid provtillfället behöver du kunna legitimera dig med en giltig ID-handling." },
  { title: "Genomför och klara körprovet",                          app: false,
    desc:  "Utöver teorin behöver du också bli godkänd på körprovet för taxiförarlegitimation." },
  { title: "Skicka in ansökan till Transportstyrelsen",             app: false,
    desc:  "När du har blivit godkänd på båda delproven och på körprovet är det dags att ansöka om taxiförarlegitimation hos Transportstyrelsen." },
  { title: "Kontrollera att dina godkända prov fortfarande är giltiga", app: false,
    desc:  "De skriftliga proven får inte vara äldre än tre år, och körprovet får inte vara äldre än ett år när du ansöker." },
  { title: "Invänta Transportstyrelsens slutliga prövning",          app: false,
    desc:  "Till sist prövar Transportstyrelsen att du uppfyller kraven på yrkeskompetens, medicinsk lämplighet och laglydnad innan legitimationen kan beviljas." },
];

// ─── Checklist steps — English ────────────────────────────────────────────────
const CHECKLIST_STEPS_EN = [
  { title: "Ensure you meet the basic requirements",                 app: false,
    desc:  "You must be at least 20 years old, have held a Category B driving licence for at least two years, not had your licence revoked in the past two years, and meet the medical requirements." },
  { title: "Book a medical examination",                             app: false,
    desc:  "Before applying you must undergo a medical examination. The doctor issues a medical certificate that must be submitted with your application." },
  { title: "Consider whether you need a preliminary decision",       app: false,
    desc:  "If you are unsure whether you can be approved due to illness or other medical obstacles, you may first apply for a preliminary decision from Transportstyrelsen." },
  { title: "Demonstrate solid exam readiness in the app",           app: true,
    desc:  "The recommendation is that you have passing results several times in a row and feel confident in both Sub-test 1 and Sub-test 2 before booking the knowledge test." },
  { title: "Book the knowledge test at Trafikverket",               app: false,
    desc:  "The knowledge test consists of two sub-tests, and you choose the order yourself. Sub-test 1 covers safety and conduct, and Sub-test 2 covers traffic law." },
  { title: "Pass both sub-tests within six months",                 app: false,
    desc:  "For the knowledge test to count as passed, both sub-tests must be passed within six months of the first passed sub-test." },
  { title: "Have your photo taken before the test",                 app: false,
    desc:  "Before your first taxi driver's licence test, you need to have your photo taken at Trafikverket. Arrive in good time so that the photo and check can be completed." },
  { title: "Bring valid ID to the test",                            app: false,
    desc:  "At the test session you will need to identify yourself with a valid ID document." },
  { title: "Complete and pass the driving test",                    app: false,
    desc:  "In addition to the theory test, you also need to pass the practical driving test for the taxi driver's licence." },
  { title: "Submit your application to Transportstyrelsen",         app: false,
    desc:  "Once you have passed both sub-tests and the driving test, it is time to apply for your taxi driver's licence at Transportstyrelsen." },
  { title: "Check that your passed tests are still valid",          app: false,
    desc:  "The written tests may not be more than three years old, and the driving test may not be more than one year old when you apply." },
  { title: "Await Transportstyrelsen's final review",               app: false,
    desc:  "Finally, Transportstyrelsen reviews that you meet the requirements for professional competence, medical fitness, and law-abidingness before the licence can be granted." },
];

// ─── Design tokens ────────────────────────────────────────────────────────────
const DARK_THEME = {
  // Surfaces
  bg:            "#0D0D14",
  surface:       "#141421",
  surfaceAlt:    "#1A1A28",
  surface3:      "#202030",
  headerBg:      "rgba(13,13,20,0.96)",

  // Borders — soft, glass-like
  border:        "rgba(255,255,255,0.08)",
  borderSoft:    "rgba(255,255,255,0.04)",
  borderGold:    "rgba(240,165,0,0.18)",
  borderGoldStr: "rgba(240,165,0,0.38)",

  // Text
  text:          "#F2ECE4",
  textSoft:      "#A8A9C0",
  muted:         "#666880",
  faint:         "#252538",

  // Amber (brand)
  gold:          "#F0A500",
  goldLight:     "#FFBE2E",
  goldDark:      "#B07800",
  goldBg:        "rgba(240,165,0,0.10)",
  goldBgHover:   "rgba(240,165,0,0.16)",

  // Correct
  green:         "#2CB87A",
  greenLight:    "#4CD99A",
  greenBg:       "rgba(44,184,122,0.12)",
  greenBorder:   "rgba(44,184,122,0.25)",

  // Wrong
  red:           "#D04848",
  redLight:      "#E86868",
  redBg:         "rgba(208,72,72,0.12)",
  redBorder:     "rgba(208,72,72,0.25)",
};

const LIGHT_THEME = {
  // Surfaces
  bg:            "#F5F4EF",
  surface:       "#FFFFFF",
  surfaceAlt:    "#F0EFE9",
  surface3:      "#E8E7DF",
  headerBg:      "rgba(245,244,239,0.96)",

  // Borders
  border:        "rgba(0,0,0,0.08)",
  borderSoft:    "rgba(0,0,0,0.04)",
  borderGold:    "rgba(240,165,0,0.18)",
  borderGoldStr: "rgba(240,165,0,0.38)",

  // Text
  text:          "#18171E",
  textSoft:      "#5A5866",
  muted:         "#9898A8",
  faint:         "#C5C4BD",

  // Amber (brand) — identical in both themes
  gold:          "#F0A500",
  goldLight:     "#FFBE2E",
  goldDark:      "#B07800",
  goldBg:        "rgba(240,165,0,0.10)",
  goldBgHover:   "rgba(240,165,0,0.16)",

  // Correct
  green:         "#2CB87A",
  greenLight:    "#4CD99A",
  greenBg:       "rgba(44,184,122,0.10)",
  greenBorder:   "rgba(44,184,122,0.22)",

  // Wrong
  red:           "#D04848",
  redLight:      "#E05050",
  redBg:         "rgba(208,72,72,0.08)",
  redBorder:     "rgba(208,72,72,0.20)",
};

const goldGrad = "linear-gradient(135deg, #FFBE2E 0%, #F0A500 55%, #B07800 100%)";

// ─── Theme context (lets helper components outside App() read C/btn styles) ───
const ThemeContext = createContext(null);

// ─── Utility ──────────────────────────────────────────────────────────────────
function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Daily-question helpers ────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dayBefore(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dailyQIdx(dateStr) {
  let h = 5381;
  for (let i = 0; i < dateStr.length; i++) h = (h * 33 ^ dateStr.charCodeAt(i)) >>> 0;
  return h % QUESTIONS.length;
}
function initDailyData(installId) {
  try {
    const raw    = localStorage.getItem(`taxi-teori-daily-${installId}`);
    const stored = raw ? JSON.parse(raw) : null;
    const today  = todayStr();
    if (stored?.date === today) return stored;
    const idx        = dailyQIdx(today);
    const qId        = QUESTIONS[idx]?.id ?? QUESTIONS[0].id;
    const yesterday  = dayBefore(today);
    const prevStreak = (stored?.date === yesterday && stored?.answered && stored?.correct)
      ? (stored.streak || 0) : 0;
    const bestStreak = Math.max(stored?.bestStreak || 0, stored?.streak || 0);
    return { date: today, questionId: qId, answered: false, chosenIdx: null, correct: null, streak: prevStreak, bestStreak };
  } catch {
    const today = todayStr();
    return { date: today, questionId: QUESTIONS[dailyQIdx(today)]?.id ?? QUESTIONS[0].id, answered: false, chosenIdx: null, correct: null, streak: 0, bestStreak: 0 };
  }
}

/**
 * Returns styling properties for a quiz / practice option button
 * based on whether it's correct, chosen, and whether the answer has been revealed.
 */
function optionStyles(C, i, correctIdx, chosenIdx, revealed) {
  const isCorrect = i === correctIdx;
  const isChosen  = i === chosenIdx;

  if (revealed) {
    if (isCorrect) return {
      bg: C.greenBg, brd: C.greenBorder, col: C.greenLight,
      badgeBg: "rgba(79,168,112,0.22)", badgeCol: C.greenLight, badgeBrd: C.green,
      indicator: "✓",
    };
    if (isChosen) return {
      bg: C.redBg,   brd: C.redBorder,   col: C.redLight,
      badgeBg: "rgba(184,80,88,0.22)",   badgeCol: C.redLight,  badgeBrd: C.red,
      indicator: "✗",
    };
    // Other options — dimmed
    return {
      bg: "transparent", brd: C.borderSoft, col: C.muted,
      badgeBg: "transparent",             badgeCol: C.faint,     badgeBrd: C.faint,
      indicator: null,
    };
  }

  if (isChosen) return {
    bg: C.goldBg, brd: C.gold, col: C.goldLight,
    badgeBg: "rgba(201,168,76,0.20)", badgeCol: C.goldLight, badgeBrd: C.gold,
    indicator: null,
  };

  return {
    bg: C.surface, brd: C.border, col: C.textSoft,
    badgeBg: C.surfaceAlt, badgeCol: C.muted, badgeBrd: C.border,
    indicator: null,
  };
}

// ─── Image lightbox ───────────────────────────────────────────────────────────

function ImageModal({ src, onClose }) {
  const { t } = useContext(ThemeContext);
  const [scale, setScale]       = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart  = useRef(null);
  const pinchState = useRef(null);
  const lastTap    = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Attach non-passive touch listener so we can call preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e) => {
      if (e.touches.length >= 2 && pinchState.current) {
        e.preventDefault();
        const dx   = e.touches[0].clientX - e.touches[1].clientX;
        const dy   = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const next = Math.min(Math.max(pinchState.current.scale * (dist / pinchState.current.dist), 1), 6);
        setScale(next);
        if (next === 1) setTranslate({ x: 0, y: 0 });
      } else if (e.touches.length === 1 && dragging && dragStart.current) {
        e.preventDefault();
        setTranslate({
          x: e.touches[0].clientX - dragStart.current.x,
          y: e.touches[0].clientY - dragStart.current.y,
        });
      }
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [dragging]);

  const resetView = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setScale(s => {
      const next = Math.min(Math.max(s * factor, 1), 6);
      if (next === 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = () => { scale > 1 ? resetView() : setScale(2.5); };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchState.current = { dist: Math.hypot(dx, dy), scale };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 280) handleDoubleClick();
      lastTap.current = now;
      dragStart.current = {
        x: e.touches[0].clientX - translate.x,
        y: e.touches[0].clientY - translate.y,
      };
      setDragging(true);
    }
  };

  const handleTouchEnd = () => {
    pinchState.current = null;
    setDragging(false);
  };

  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    dragStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
    setDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!dragging || scale <= 1) return;
    setTranslate({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const handleMouseUp = () => setDragging(false);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.93)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 300,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        animation: "fadeIn 0.14s ease both",
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "fixed", top: "16px", right: "16px",
          width: "38px", height: "38px", borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "#fff", fontSize: "20px", lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 301,
          WebkitTapHighlightColor: "transparent",
        }}
      >×</button>

      {/* Image container */}
      <div
        ref={containerRef}
        onClick={e => e.stopPropagation()}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          maxWidth: "96vw",
          maxHeight: "88dvh",
          overflow: "hidden",
          borderRadius: "16px",
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "none",
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            display: "block",
            maxWidth: "96vw",
            maxHeight: "88dvh",
            objectFit: "contain",
            borderRadius: "16px",
            border: `1px solid rgba(201,168,76,0.22)`,
            transform: `translate(${translate.x}px,${translate.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: (dragging || pinchState.current) ? "none" : "transform 0.18s ease",
          }}
        />
      </div>

      {/* Hint shown only at scale 1 */}
      {scale === 1 && (
        <div style={{
          position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.55)", borderRadius: "16px",
          padding: "6px 16px", fontSize: "11px", color: "rgba(255,255,255,0.45)",
          pointerEvents: "none", whiteSpace: "nowrap", letterSpacing: "0.3px",
        }}>
          {t("img_zoom_hint")}
        </div>
      )}
    </div>
  );
}

/** Drop-in replacement for a question image — adds click-to-enlarge */
function ZoomableImage({ src, style }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <img
        src={src}
        alt=""
        onClick={() => setOpen(true)}
        style={{ ...style, cursor: "zoom-in" }}
      />
      {open && <ImageModal src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Shared visual components ─────────────────────────────────────────────────

function Logo({ size = 36 }) {
  return (
    <img
      src={import.meta.env.BASE_URL + "branding/icon-180.png"}
      alt="Taxi Teori"
      style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.22),
        display: "block", flexShrink: 0, objectFit: "cover",
      }}
    />
  );
}

/** Small section label */
function Label({ children, color }) {
  const { C } = useContext(ThemeContext);
  return (
    <div style={{
      fontSize: "11px", fontWeight: "600", letterSpacing: "0.2px",
      color: color || C.muted,
      marginBottom: "12px",
    }}>
      {children}
    </div>
  );
}

/** Filled progress bar */
function ProgressBar({ value, total }) {
  const { C } = useContext(ThemeContext);
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ height: "4px", borderRadius: "99px", background: C.faint, marginBottom: "22px", overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: "99px",
        background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})`,
        width: `${pct}%`, transition: "width 0.4s ease",
      }} />
    </div>
  );
}

/** A/B/C/D badge used inside option buttons */
function OptionBadge({ letter, bg, border, color }) {
  return (
    <span style={{
      width: "28px", height: "28px", borderRadius: "8px",
      background: bg, border: `1px solid ${border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "11px", fontWeight: "700", flexShrink: 0, color,
      fontFamily: "'DM Mono', monospace",
      transition: "all 0.15s",
    }}>
      {letter}
    </span>
  );
}

/** Explanation block shown after answering */
function ExplanationBox({ text }) {
  const { C, t } = useContext(ThemeContext);
  if (!text) return null;
  return (
    <div style={{
      padding: "18px 20px",
      background: C.goldBg,
      borderRadius: "16px",
      border: `1px solid ${C.borderGold}`,
      boxShadow: "0 2px 16px rgba(240,165,0,0.08)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px",
      }}>
        <div style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: C.gold, opacity: 0.9, flexShrink: 0,
        }} />
        <span style={{
          fontSize: "11px", fontWeight: "600",
          color: C.gold, letterSpacing: "0.2px",
        }}>
          {t("explanation_label")}
        </span>
      </div>
      <p style={{ color: C.textSoft, fontSize: "14px", lineHeight: "1.72", margin: 0 }}>
        {text}
      </p>
    </div>
  );
}

/** Bottom-sheet overlay used for both result popup and stats popup */
function Popup({ onClose, children }) {
  const { C } = useContext(ThemeContext);
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 100, backdropFilter: "blur(8px)",
        animation: "fadeIn 0.16s ease both",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface,
          borderRadius: "24px 24px 0 0",
          border: `1px solid ${C.border}`,
          borderBottom: "none",
          padding: "12px 20px max(44px, env(safe-area-inset-bottom, 0px))",
          width: "100%", maxWidth: "580px",
          animation: "slideUp 0.28s cubic-bezier(0.34,1.1,0.64,1) both",
          maxHeight: "88dvh", overflowY: "auto",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.35)",
        }}
      >
        {/* Drag handle */}
        <div
          style={{ width: "36px", height: "4px", background: C.border, borderRadius: "99px", margin: "4px auto 20px", cursor: "pointer" }}
          onClick={onClose}
        />
        {children}
      </div>
    </div>,
    document.body
  );
}

/**
 * Unified question detail body used in both popups.
 * - view-only (result review): onSelectOption = null, revealed = true always
 * - interactive (stats practice): onSelectOption provided, revealed starts false
 */
function QuestionPopupBody({ q, chosen, revealed, onSelectOption, onClose, isSaved, onToggleSave }) {
  const { C, btnGold, btnGhost, t } = useContext(ThemeContext);
  const isViewOnly = !onSelectOption;
  const showAnswers = revealed || isViewOnly;

  return (
    <>
      <ZoomableImage
        src={q.image}
        style={{ width: "100%", borderRadius: "16px", marginBottom: "16px", border: `1px solid ${C.border}` }}
      />

      <p style={{
        fontSize: "16px", fontWeight: "600", color: C.text,
        lineHeight: "1.68", marginBottom: "18px", textAlign: "left",
      }}>
        {q.question}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
        {q.options.map((opt, i) => {
          const s = optionStyles(C, i, q.correct, chosen, showAnswers);
          return (
            <button key={i}
              onClick={() => !showAnswers && onSelectOption && onSelectOption(i)}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 14px",
                background: s.bg, border: `1px solid ${s.brd}`, borderRadius: "16px",
                color: s.col, fontSize: "14px", textAlign: "left",
                cursor: showAnswers ? "default" : "pointer",
                transition: "all 0.18s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <OptionBadge letter={"ABCDE"[i]} bg={s.badgeBg} border={s.badgeBrd} color={s.badgeCol} />
              <span style={{ flex: 1 }}>{opt}</span>
              {showAnswers && s.indicator && (
                <span style={{
                  fontSize: "12px", fontWeight: "700", flexShrink: 0,
                  color: i === q.correct ? C.greenLight : C.redLight,
                }}>
                  {s.indicator}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showAnswers && q.explanation && (
        <div style={{ marginBottom: "18px" }}>
          <ExplanationBox text={q.explanation} />
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        {onToggleSave && (
          <button
            onClick={() => onToggleSave(q.id)}
            style={{
              ...btnGhost,
              padding: "14px 16px", flexShrink: 0,
              borderColor: isSaved ? C.borderGoldStr : C.border,
              color: isSaved ? C.gold : C.muted,
              fontWeight: isSaved ? "700" : "500",
              fontSize: "13px",
              transition: "all 0.18s",
            }}
          >
            {isSaved ? t("saved") : t("save_bookmark")}
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            ...btnGold, flex: 1, padding: "14px", fontSize: "14px",
            boxShadow: "0 4px 20px rgba(201,168,76,0.14)",
          }}
        >
          {t("close")}
        </button>
      </div>
    </>
  );
}

/**
 * Mastery distribution — premium progress breakdown widget.
 * Headline mastery % → thick stacked bar → animated status rows.
 */
function MasteryBar({ questions, getStatus }) {
  const { C, t } = useContext(ThemeContext);
  if (!questions.length) return null;

  const counts = { "ej övad": 0, "öva mer": 0, "på väg": 0, "behärskad": 0 };
  questions.forEach(q => counts[getStatus(q)]++);

  const total       = questions.length;
  const masteredPct = Math.round(counts["behärskad"] / total * 100);
  const headlineCol = masteredPct >= 70 ? C.greenLight : masteredPct >= 35 ? C.gold : C.textSoft;

  const segments = [
    { key: "behärskad", color: C.green,   barColor: C.green,    label: t("status_mastered")      },
    { key: "på väg",    color: C.gold,    barColor: C.gold,     label: t("status_progressing")   },
    { key: "öva mer",   color: C.red,     barColor: C.red,      label: t("status_practice_more") },
    { key: "ej övad",   color: C.muted,   barColor: C.surface3, label: t("status_untried")       },
  ];

  return (
    <div>
      {/* ── Headline ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        marginBottom: "18px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "52px", fontWeight: "500", color: headlineCol, lineHeight: 1, letterSpacing: "-2px", fontFamily: "'DM Mono', monospace" }}>
            {masteredPct}%
          </span>
          <span style={{ fontSize: "12px", color: C.muted, fontWeight: "500", paddingBottom: "5px" }}>
            {t("mastery_suffix")}
          </span>
        </div>
        <div style={{ textAlign: "right", paddingBottom: "4px" }}>
          <div style={{ fontSize: "20px", fontWeight: "800", color: C.text, lineHeight: 1 }}>
            {counts["behärskad"]}
            <span style={{ fontSize: "12px", fontWeight: "500", color: C.muted }}> / {total}</span>
          </div>
          <div style={{ fontSize: "9px", color: C.faint, marginTop: "4px", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: "600" }}>
            {t("mastery_bar_label")}
          </div>
        </div>
      </div>

      {/* ── Stacked bar ──────────────────────────────────────── */}
      <div style={{
        display: "flex", height: "6px", borderRadius: "99px",
        overflow: "hidden", gap: "1px", background: C.faint,
        marginBottom: "22px",
      }}>
        {segments.map((seg, i) =>
          counts[seg.key] > 0 && (
            <div key={seg.key} style={{
              flex: counts[seg.key],
              background: seg.barColor,
              minWidth: "4px",
              animation: "fadeIn 0.45s ease both",
              animationDelay: `${0.1 + i * 0.07}s`,
            }} />
          )
        )}
      </div>

      {/* ── Status breakdown rows ─────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {segments.map((seg, i) => {
          const n      = counts[seg.key];
          const pct    = total > 0 ? (n / total) * 100 : 0;
          const active = n > 0;
          const isLast = i === segments.length - 1;
          return (
            <div key={seg.key} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "11px 0",
              borderBottom: isLast ? "none" : `1px solid ${C.borderSoft}`,
              opacity: active ? 1 : 0.45,
            }}>
              {/* Dot */}
              <div style={{
                width: "7px", height: "7px", borderRadius: "50%",
                background: seg.barColor, flexShrink: 0,
              }} />

              {/* Label */}
              <div style={{
                fontSize: "13px", fontWeight: "500",
                color: active ? C.textSoft : C.muted,
                flex: 1, minWidth: 0,
              }}>
                {seg.label}
              </div>

              {/* Proportional mini-bar */}
              <div style={{
                width: "72px", height: "3px", borderRadius: "99px",
                background: C.faint, flexShrink: 0, overflow: "hidden",
              }}>
                {active && (
                  <div style={{
                    height: "100%", borderRadius: "99px",
                    width: `${pct}%`,
                    background: seg.barColor,
                    animation: "scoreBarGrow 0.7s cubic-bezier(0.4, 0, 0.2, 1) both",
                    animationDelay: `${0.05 + i * 0.08}s`,
                    minWidth: "3px",
                  }} />
                )}
              </div>

              {/* Count */}
              <div style={{
                fontSize: "15px", fontWeight: "700",
                color: active ? seg.color : C.faint,
                minWidth: "28px", textAlign: "right", lineHeight: 1,
              }}>
                {n}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Score progress bar for the result screen.
 * Shows user's score vs. pass mark as a visual indicator.
 */
function ScoreBar({ score, total, passMark }) {
  const { C, tf } = useContext(ThemeContext);
  const scorePct = total > 0 ? (score / total) * 100 : 0;
  const passPct  = passMark && total > 0 ? (passMark / total) * 100 : null;
  const passed   = passMark ? score >= passMark : scorePct >= 70;

  return (
    <div style={{ marginTop: "18px", paddingBottom: passMark ? "24px" : "0" }}>
      <div style={{ position: "relative", height: "5px", background: C.border, borderRadius: "5px" }}>
        {/* Score fill */}
        <div
          className="score-bar-fill"
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${scorePct}%`,
            background: passed
              ? `linear-gradient(90deg, ${C.green}, ${C.greenLight})`
              : `linear-gradient(90deg, ${C.red},  ${C.redLight})`,
            borderRadius: "5px",
          }}
        />

        {/* Pass mark line */}
        {passPct !== null && (
          <div style={{
            position: "absolute",
            left: `${passPct}%`,
            top: "-5px", bottom: "-5px",
            width: "2px",
            background: C.gold,
            borderRadius: "1px",
            transform: "translateX(-50%)",
          }}>
            <div style={{
              position: "absolute",
              top: "14px",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "9px",
              fontWeight: "700",
              color: C.gold,
              whiteSpace: "nowrap",
              letterSpacing: "0.3px",
            }}>
              {tf("score_bar_pass_label", passMark)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Vilotid question predicate ──────────────────────────────────────────────
// Matches questions about rest-time regulations, logbooks, and driving hours.
// IDs 383 and 398 are explicitly excluded: they are Delprov 1 safety questions
// about fatigue/sleep awareness, not vilotid rule questions.
const VILOTID_EXCLUDE_IDS = new Set([383, 398]);
function isVilotidQuestion(q) {
  if (VILOTID_EXCLUDE_IDS.has(q.id)) return false;
  const text = [q.question, ...(q.options || []), q.explanation || ""].join(" ").toLowerCase();
  return /vilotid|dygnsvila|veckovila|viloperiod|vilotidsförordning|tidbok/.test(text);
}

// ─── Taxiregler question predicate ───────────────────────────────────────────
// Matches questions specifically about taxi-business regulations:
// taxiförarlegitimation, taxameter, trafiktillstånd, pricing rules, inspection.
function isTaxiregelQuestion(q) {
  const text = [q.question, ...(q.options || []), q.explanation || ""].join(" ").toLowerCase();
  return /taxiförarlegitimation|taxameter|trafiktillstånd|prisinformation|taxetabell|jämförpris|summatariff|plombering|kontrollrapport|yrkesmässig taxitrafik|förarbevis/.test(text);
}

// ─── Navigering question predicate ───────────────────────────────────────────
// Navigation questions live in navigering-1.js and use IDs starting at 431.
// All are delprov: 1, so we exclude them from the general "Fordon & säkerhet"
// category to give them their own dedicated category.
function isNavigeringQuestion(q) {
  return q.delprov === 1 && q.id >= 431;
}

/** Clean geometric SVG icons for the bottom navigation */
function NavIcon({ name, active = false, size = 22 }) {
  const sw = active ? "1.8" : "1.5";
  if (name === "prov") return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={{ display: "block" }}>
      <rect x="5.5" y="2.5" width="11" height="15" rx="2" stroke="currentColor" strokeWidth={sw}/>
      <path d="M8 8h6M8 11h6M8 14h3.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  );
  if (name === "fragor") return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={{ display: "block" }}>
      <path d="M4 5.5h14M4 10.5h10M4 15.5h6.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  );
  if (name === "home") return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={{ display: "block" }}>
      <path d="M3 10.5L11 3.5l8 7V19a1 1 0 01-1 1H14.5v-5h-7v5H4a1 1 0 01-1-1v-8.5z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round"/>
    </svg>
  );
  if (name === "utmaningar") return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={{ display: "block" }}>
      <path d="M11 2.5l2.2 5.8 6.3.5-4.8 4.1 1.5 6L11 16l-5.2 2.9 1.5-6L2.5 8.8l6.3-.5L11 2.5z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
  if (name === "mer") return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={{ display: "block" }}>
      <circle cx="5.5" cy="11" r="1.5" fill="currentColor"/>
      <circle cx="11" cy="11" r="1.5" fill="currentColor"/>
      <circle cx="16.5" cy="11" r="1.5" fill="currentColor"/>
    </svg>
  );
  return null;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Language ─────────────────────────────────────────────────────────────
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('taxi-teori-language') || 'sv'; } catch { return 'sv'; }
  });
  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem('taxi-teori-language', l); } catch {}
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
    try { return localStorage.getItem('taxi-teori-theme') || 'light'; } catch { return 'light'; }
  });
  const C = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  const card = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "18px",
    boxShadow: "0 2px 20px rgba(0,0,0,0.22)",
  };
  const btnGold = {
    background: goldGrad, border: "none", borderRadius: "14px",
    fontWeight: "700", color: "#090909", cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: "8px", letterSpacing: "0.3px", WebkitTapHighlightColor: "transparent",
    boxShadow: "0 4px 20px rgba(240,165,0,0.20)",
  };
  const btnGhost = {
    background: "transparent", border: `1px solid ${C.border}`,
    color: C.muted, padding: "8px 16px", borderRadius: "14px",
    cursor: "pointer", fontSize: "13px", fontWeight: "500",
    display: "inline-flex", alignItems: "center", gap: "6px",
    WebkitTapHighlightColor: "transparent",
    transition: "border-color 0.15s, color 0.15s, transform 0.11s, opacity 0.11s",
  };

  // ── State ────────────────────────────────────────────────────────────────
  const [view,          setView]          = useState("home");
  const [mode,          setMode]          = useState(null);
  const [quiz,          setQuiz]          = useState(null);
  const [timeLeft,      setTimeLeft]      = useState(null);
  const [flashIdx,      setFlashIdx]      = useState(0);
  const [flipped,       setFlipped]       = useState(false);
  const [flashcards,    setFlashcards]    = useState([]);
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
  const [shakeBtn,      setShakeBtn]      = useState(null);
  const [popupQ,        setPopupQ]        = useState(null);
  const [statsQuestion,    setStatsQuestion]    = useState(null);
  const [statsSelected,    setStatsSelected]    = useState(null);
  const [statsAnswered,    setStatsAnswered]    = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [fragorFilter,     setFragorFilter]     = useState(null);
  const HISTORY_KEY = `taxi-teori-history-${INSTALL_ID}`;
  const [quizHistory, setQuizHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`taxi-teori-history-${INSTALL_ID}`) || "[]"); }
    catch { return []; }
  });
  // Stores arrays of question IDs from the last QUICK_HISTORY_SIZE quick tests.
  // Shape: [[id, id, …], [id, id, …], …]  — index 0 = most recent.
  const [quickTestHistory, setQuickTestHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`taxi-teori-quick-hist-${INSTALL_ID}`) || "[]"); }
    catch { return []; }
  });
  const SAVED_KEY = `taxi-teori-saved-${INSTALL_ID}`;
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`taxi-teori-saved-${INSTALL_ID}`) || "[]"); }
    catch { return []; }
  });
  const DAILY_KEY     = `taxi-teori-daily-${INSTALL_ID}`;
  const RIR_KEY       = `taxi-teori-rir-${INSTALL_ID}`;
  const CHECKLIST_KEY = `taxi-teori-checklist-${INSTALL_ID}`;
  const [dailyData,     setDailyData]     = useState(() => initDailyData(INSTALL_ID));
  const [rirBest,       setRirBest]       = useState(() => {
    try { return parseInt(localStorage.getItem(`taxi-teori-rir-${INSTALL_ID}`) || "0") || 0; } catch { return 0; }
  });
  const [checklistDone, setChecklistDone] = useState(() => {
    try {
      const raw = localStorage.getItem(`taxi-teori-checklist-${INSTALL_ID}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const [showOnboarding,   setShowOnboarding]   = useState(
    () => localStorage.getItem(`taxi-teori-onboarding-done-${INSTALL_ID}`) !== "1"
  );

  const timer      = useRef(null);
  const explainRef = useRef(null);
  const audioCtx   = useRef(null);
  const mainRef    = useRef(null);

  // ── Theme DOM sync ───────────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('taxi-teori-theme', theme); } catch {}
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D0D14' : '#F5F4EF');
  }, [theme]);

  // ── One-time migration: copy Supabase stats → localStorage ──────────────
  useEffect(() => {
    if (hasMigrated()) return;                    // already done
    if (loadLocalStats() !== null) {              // local data exists — no need
      markMigrated();
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

  // ── Persist a single question stat ───────────────────────────────────────
  const saveStat = (questionId, correct, wrong) => {
    setStats(prev => ({ ...prev, [questionId]: { c: correct, w: wrong } }));
  };

  // ── Sync stats to localStorage whenever they change ───────────────────────
  useEffect(() => {
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
    clearLocalStats();
    setStats(Object.fromEntries(QUESTIONS.map(q => [q.id, { c: 0, w: 0 }])));
    setQuizHistory([]);
    try { localStorage.removeItem(`taxi-teori-history-${INSTALL_ID}`); } catch {}
    setQuickTestHistory([]);
    try { localStorage.removeItem(`taxi-teori-quick-hist-${INSTALL_ID}`); } catch {}
    setSavedIds([]);
    try { localStorage.removeItem(`taxi-teori-saved-${INSTALL_ID}`); } catch {}
    try { localStorage.removeItem(`taxi-teori-daily-${INSTALL_ID}`); } catch {}
    try { localStorage.removeItem(`taxi-teori-rir-${INSTALL_ID}`); } catch {}
    try { localStorage.removeItem(`taxi-teori-checklist-${INSTALL_ID}`); } catch {}
    setRirBest(0);
    setChecklistDone(new Set());
    setDailyData(initDailyData(INSTALL_ID));
    setShowResetConfirm(false);
    // Re-trigger onboarding for this installation only
    localStorage.removeItem(`taxi-teori-onboarding-done-${INSTALL_ID}`);
    setView("home");
    setShowOnboarding(true);
  };

  // ── Save / bookmark a question ────────────────────────────────────────────
  const toggleSave = (questionId) => {
    setSavedIds(prev => {
      const next = prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId];
      try { localStorage.setItem(`taxi-teori-saved-${INSTALL_ID}`, JSON.stringify(next)); } catch {}
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
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(newData)); } catch {}
    const cur = stats[q.id] || { c: 0, w: 0 };
    saveStat(q.id, cur.c + (correct ? 1 : 0), cur.w + (correct ? 0 : 1));
  };

  // ── Checklist step toggle ─────────────────────────────────────────────────
  const toggleChecklistStep = (idx) => {
    setChecklistDone(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // ── Onboarding handlers ───────────────────────────────────────────────────
  const handleOnboardingDone = () => {
    localStorage.setItem(`taxi-teori-onboarding-done-${INSTALL_ID}`, "1");
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
      if (notifSettings.vibration && navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } catch (e) {}
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
      if (notifSettings.vibration && navigator.vibrate) navigator.vibrate([180]);
    } catch (e) {}
  };

  // ── Scroll to explanation after answering ────────────────────────────────
  useEffect(() => {
    if (quiz?.answered !== null && quiz?.answered !== undefined && explainRef.current) {
      setTimeout(() => {
        explainRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 180);
    }
  }, [quiz?.answered]);

  // ── Reset scroll to top on every view change ─────────────────────────────
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [view]);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (view === "quiz" && timeLeft !== null) {
      if (timeLeft <= 0) { endQuiz(quiz.answers); return; }
      timer.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    }
    return () => clearTimeout(timer.current);
  }, [view, timeLeft]);

  // ── Quiz logic ────────────────────────────────────────────────────────────
  const getQs = (m) => {
    if (m === "all" || m === "quick" || m === "rir") return QUESTIONS;
    if (m === "focus") return QUESTIONS.filter(q => {
      const s = stats[q.id] || { c: 0, w: 0 };
      return s.w > 0 && s.c === 0; // wrong pool: has wrongs AND never answered correctly
    });
    if (m === "bilder") return QUESTIONS.filter(q => q.image);
    return QUESTIONS.filter(q => q.delprov === m);
  };

  // Weighted random selection without replacement.
  // `pool` is the candidate question array; `history` is [[id,…], [id,…], …]
  // with index 0 being the most recently played quick test.
  const weightedPickQuestions = (pool, history, n) => {
    // Build a lookup: questionId → best (lowest) recency index across all history slots.
    const recencyIndex = new Map();
    history.forEach((ids, slotIdx) => {
      ids.forEach(id => {
        if (!recencyIndex.has(id) || recencyIndex.get(id) > slotIdx) {
          recencyIndex.set(id, slotIdx);
        }
      });
    });

    // Assign weights — items not in history get 1.0 (full weight).
    const items = pool.map(q => ({
      q,
      w: recencyIndex.has(q.id)
        ? (QUICK_RECENCY_WEIGHTS[recencyIndex.get(q.id)] ?? 1.0)
        : 1.0,
    }));

    const result = [];
    while (result.length < n && items.length > 0) {
      const total = items.reduce((sum, it) => sum + it.w, 0);
      let r = Math.random() * total;
      let chosen = items.length - 1; // fallback to last item
      for (let i = 0; i < items.length; i++) {
        r -= items[i].w;
        if (r <= 0) { chosen = i; break; }
      }
      result.push(items[chosen].q);
      items.splice(chosen, 1);
    }
    return result;
  };

  const startQuiz = (m) => {
    clearTimeout(timer.current);
    if (QUESTIONS.length === 0) return;
    const baseMode = (m === 10 || m === 20 || m === 30) ? "all" : m;
    let qs;
    if (m === "quick") {
      // Use recency-weighted selection so recently-seen questions are less likely to reappear.
      qs = weightedPickQuestions(QUESTIONS, quickTestHistory, 15);
    } else {
      qs = [...getQs(baseMode)].sort(() => Math.random() - 0.5);
    }
    if (qs.length === 0) return;
    if (m === "focus" || m === "bilder") qs = qs.slice(0, 15);
    if (m === 1)       qs = qs.slice(0, 70);
    if (m === 2)       qs = qs.slice(0, 50);
    if (m === "rir")   qs = qs.slice(0, 200);
    if (m === 10 || m === 20 || m === 30) qs = qs.slice(0, m);
    const timeLimit = (m === 1 || m === 2) ? DELPROV_CONFIG[m].time * 60 : null;
    setMode(m);
    setQuiz({ questions: qs, current: 0, answers: [], answered: null });
    setTimeLeft(timeLimit);
    setResult(null);
    setView("quiz");
  };

  const answer = (i) => {
    if (quiz.answered !== null) return;
    if (i === quiz.questions[quiz.current].correct) { playPling(); }
    else { playBuzz(); setShakeBtn(i); setTimeout(() => setShakeBtn(null), 500); }
    setQuiz(q => ({ ...q, answered: i }));
  };

  const next = () => {
    const q    = quiz.questions[quiz.current];
    const ok   = quiz.answered === q.correct;
    const ans  = [...quiz.answers, { id: q.id, correct: ok, chosen: quiz.answered, q }];
    const newC = stats[q.id].c + (ok ? 1 : 0);
    const newW = stats[q.id].w + (ok ? 0 : 1);
    saveStat(q.id, newC, newW);
    if (mode === "rir" && !ok) { endQuiz(ans); return; }
    if (quiz.current + 1 >= quiz.questions.length) endQuiz(ans);
    else setQuiz(s => ({ ...s, current: s.current + 1, answers: ans, answered: null }));
  };

  const endQuiz = (answers) => {
    clearTimeout(timer.current);
    const score = answers.filter(a => a.correct).length;
    const total = answers.length;
    const record = { ts: Date.now(), mode, score, total, pct: Math.round(score / total * 100) };
    const newHistory = [record, ...quizHistory].slice(0, 10);
    setQuizHistory(newHistory);
    try { localStorage.setItem(`taxi-teori-history-${INSTALL_ID}`, JSON.stringify(newHistory)); } catch {}
    if (mode === "quick") {
      // Prepend the IDs from this test and keep only QUICK_HISTORY_SIZE slots.
      const ids = answers.map(a => a.id);
      const newQuickHist = [ids, ...quickTestHistory].slice(0, QUICK_HISTORY_SIZE);
      setQuickTestHistory(newQuickHist);
      try { localStorage.setItem(`taxi-teori-quick-hist-${INSTALL_ID}`, JSON.stringify(newQuickHist)); } catch {}
    }
    if (mode === "rir") {
      const newBest = Math.max(rirBest, score);
      setRirBest(newBest);
      try { localStorage.setItem(`taxi-teori-rir-${INSTALL_ID}`, String(newBest)); } catch {}
    }
    setResult({ score, total, answers, mode, expired: timeLeft === 0 });
    recordActivity(lang, notifSettings);
    setView("result");
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  // All counts are derived from QUESTIONS (not raw stats entries) to avoid
  // orphaned stats for deleted/replaced question IDs skewing the numbers.
  const tot      = QUESTIONS.reduce((a, q) => { const s = stats[q.id] || { c: 0, w: 0 }; return a + s.c + s.w; }, 0);
  const corr     = QUESTIONS.reduce((a, q) => { const s = stats[q.id] || { c: 0, w: 0 }; return a + s.c; }, 0);
  const acc      = tot > 0 ? Math.round(corr / tot * 100) : 0;
  const mastered = QUESTIONS.filter(q => { const s = stats[q.id] || { c: 0, w: 0 }; return s.c >= 2 && s.c > s.w; }).length;

  const dpProgress = [1, 2].map(dp => {
    const qs        = QUESTIONS.filter(q => q.delprov === dp);
    const dpS       = qs.map(q => stats[q.id] || { c: 0, w: 0 });
    const dpTot     = dpS.reduce((a, b) => a + b.c + b.w, 0);
    const dpCorr    = dpS.reduce((a, b) => a + b.c, 0);
    const dpMastered = dpS.filter(s => s.c >= 2 && s.c > s.w).length;
    const dpAcc     = dpTot > 0 ? Math.round(dpCorr / dpTot * 100) : 0;
    const dpPct     = Math.round(dpMastered / qs.length * 100);
    return { dp, cfg: DELPROV_CONFIG[dp], total: qs.length, mastered: dpMastered, acc: dpAcc, pct: dpPct, tried: dpTot > 0 };
  });

  const wrongCount = QUESTIONS.filter(q => {
    const s = stats[q.id] || { c: 0, w: 0 };
    return s.w > 0 && s.c === 0;
  }).length;

  const masterPct     = QUESTIONS.length > 0 ? Math.round(mastered / QUESTIONS.length * 100) : 0;
  const overallStatus = masterPct >= 80 ? t("overall_ready") : masterPct >= 50 ? t("overall_almost") : masterPct >= 20 ? t("overall_going") : t("overall_start");
  const overallColor  = masterPct >= 80 ? C.greenLight   : masterPct >= 50 ? C.gold         : masterPct >= 20 ? C.gold  : C.muted;

  const getQuestionStatus = (q) => {
    const s   = stats[q.id] || { c: 0, w: 0 };
    const att = s.c + s.w;
    if (att === 0)              return "ej övad";
    if (s.c >= 2 && s.c > s.w) return "behärskad";
    if (s.c > s.w)              return "på väg";
    return "öva mer";
  };

  const filteredQuestions = statusFilter === "alla"
    ? QUESTIONS
    : QUESTIONS.filter(q => getQuestionStatus(q) === statusFilter);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openFlashcards = () => {
    const random = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5);
    setFlashcards(random);
    setFlashIdx(0);
    setFlipped(false);
    setView("flashcard");
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!statsLoaded) {
    return (
      <div style={{
        minHeight: "100dvh", background: C.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "20px",
      }}>
        {/* Brand mark */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "16px",
            background: `linear-gradient(135deg, ${C.goldLight} 0%, ${C.gold} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(240,165,0,0.28)",
            fontSize: "28px",
          }}>🚕</div>
          <div style={{
            fontSize: "18px", fontWeight: "700", color: C.text,
            letterSpacing: "0.3px",
            fontFamily: "'Manrope', sans-serif",
          }}>
            Taxi Teori
          </div>
          <div style={{
            fontSize: "12px", color: C.muted,
            marginTop: "-6px",
          }}>
            Studieapp
          </div>
        </div>
        {/* Loading bar */}
        <div style={{ width: "96px", height: "3px", borderRadius: "99px", background: C.faint, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: "99px", background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})`, animation: "loadBar 1.5s ease-in-out infinite" }} />
        </div>
      </div>
    );
  }

  const showBottomNav = view !== "quiz";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <ThemeContext.Provider value={{ C, btnGold, btnGhost, t, tf, lang, tStatus }}>
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.text }}>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <main ref={mainRef} className="main-content">

        {/* ══════════════════════════════════════════════════════════════
            HEM
        ══════════════════════════════════════════════════════════════ */}
        {view === "home" && (
          <div style={{ animation: "screenIn 0.28s ease both" }}>

            {/* ══ HERO ════════════════════════════════════════════════════ */}
            <div className="home-card-1" style={{ padding: "6px 0 20px", marginBottom: "4px" }}>
              {tot === 0 ? (
                /* ── New user: centered welcome ── */
                <div style={{ textAlign: "center" }}>
                  <h1 style={{
                    fontSize: "34px", fontWeight: "800", color: C.text,
                    letterSpacing: "-1.1px", lineHeight: 1.05,
                    margin: "0 0 10px", padding: 0,
                  }}>
                    {t("hero_new_title1")}<br />
                    <span style={{ color: C.gold }}>{t("hero_new_title2")}</span>
                  </h1>
                  <p style={{
                    fontSize: "13px", color: C.textSoft, lineHeight: 1.65,
                    margin: "0 auto", maxWidth: "240px", fontWeight: "500",
                  }}>
                    {t("hero_new_sub")}
                  </p>
                </div>
              ) : (
                /* ── Returning user: mastery state ── */
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <h1 style={{
                      fontSize: "27px", fontWeight: "800", color: C.text,
                      letterSpacing: "-0.7px", lineHeight: 1.05,
                      margin: "0 0 7px", padding: 0,
                    }}>
                      {wrongCount > 0
                        ? t("hero_keep_training")
                        : masterPct >= 80
                          ? t("hero_almost_ready")
                          : t("hero_good_job")}
                    </h1>
                    <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
                      <span style={{ color: masterPct >= 80 ? C.greenLight : C.textSoft, fontWeight: "700" }}>{mastered}</span>
                      <span style={{ color: C.textSoft }}> / {QUESTIONS.length} {t("status_mastered").toLowerCase()}</span>
                    </div>
                    {/* Inline progress bar */}
                    <div style={{ marginTop: "10px", height: "3px", borderRadius: "99px", background: C.faint, overflow: "hidden", maxWidth: "150px" }}>
                      <div style={{
                        height: "100%", borderRadius: "99px",
                        width: `${masterPct}%`,
                        background: masterPct >= 80 ? C.greenLight : C.gold,
                        transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                  </div>
                  {/* Mastery ring */}
                  <div style={{ position: "relative", flexShrink: 0, width: "80px", height: "80px" }}>
                    <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: "block" }}>
                      <circle cx="40" cy="40" r="32" fill="none" stroke={C.faint} strokeWidth="5" />
                      <circle cx="40" cy="40" r="32" fill="none"
                        stroke={masterPct >= 80 ? C.green : C.gold}
                        strokeWidth="5" strokeLinecap="round"
                        strokeDasharray="201.1"
                        strokeDashoffset={201.1 * (1 - masterPct / 100)}
                        style={{
                          transform: "rotate(-90deg)", transformOrigin: "50% 50%",
                          transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)",
                          filter: masterPct >= 80
                            ? "drop-shadow(0 0 6px rgba(44,184,122,0.5))"
                            : "drop-shadow(0 0 6px rgba(240,165,0,0.4))",
                        }}
                      />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: "17px", fontWeight: "600", lineHeight: 1,
                        color: masterPct >= 80 ? C.greenLight : C.gold,
                      }}>
                        {masterPct}%
                      </span>
                      <span style={{ fontSize: "8.5px", color: C.muted, fontWeight: "600", letterSpacing: "0.2px" }}>{t("mastery_ring_label")}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ══ PRIMARY CTA — SNABBPROV ═════════════════════════════════ */}
            <button
              id="ob-snabbprov"
              className="home-card-2 pressable"
              onClick={() => startQuiz("quick")}
              style={{
                width: "100%", marginBottom: "6px",
                padding: "0",
                borderRadius: "18px", overflow: "hidden",
                border: "none",
                background: goldGrad,
                display: "block", cursor: "pointer", textAlign: "left",
                WebkitTapHighlightColor: "transparent",
                boxShadow: "0 6px 24px rgba(240,165,0,0.30), 0 1px 4px rgba(0,0,0,0.5)",
                fontFamily: "inherit",
              }}
            >
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "40px", height: "40px", flexShrink: 0, borderRadius: "12px",
                  background: "rgba(0,0,0,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "17px", color: "rgba(255,255,255,0.9)",
                }}>▶</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "17px", fontWeight: "800", color: "#09090E",
                    letterSpacing: "-0.3px", lineHeight: 1, marginBottom: "4px",
                  }}>
                    {t("start_snabbprov")}
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "rgba(0,0,0,0.45)" }}>
                    {t("snabbprov_sub")}
                  </div>
                </div>
                <div style={{ fontSize: "18px", color: "rgba(0,0,0,0.35)", flexShrink: 0 }}>→</div>
              </div>
            </button>

            {/* ══ FOKUSTRÄNING — only when active ═════════════════════════ */}
            {wrongCount > 0 && (
              <button
                id="ob-fokustranin"
                className="home-card-3 pressable"
                onClick={() => startQuiz("focus")}
                style={{
                  width: "100%", marginBottom: "6px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  border: `1px solid ${C.redBorder}`,
                  background: C.redBg,
                  display: "flex", alignItems: "center", gap: "12px",
                  cursor: "pointer", textAlign: "left",
                  WebkitTapHighlightColor: "transparent",
                  fontFamily: "inherit",
                }}
              >
                <div style={{
                  width: "36px", height: "36px", flexShrink: 0, borderRadius: "10px",
                  background: "rgba(208,72,72,0.18)", border: `1px solid ${C.redBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px",
                }}>🎯</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>
                    {t("fokus_title")}
                  </div>
                  <div style={{ fontSize: "11px", color: C.textSoft }}>
                    {tf("fokus_sub", wrongCount)}
                  </div>
                </div>
                <div style={{
                  fontSize: "10px", fontWeight: "700", color: C.redLight,
                  border: `1px solid ${C.redBorder}`,
                  padding: "4px 10px", flexShrink: 0,
                  fontFamily: "'DM Mono', monospace", letterSpacing: "0.5px",
                  borderRadius: "6px",
                }}>
                  {t("fokus_btn")}
                </div>
              </button>
            )}

            {/* ══ DAGENS FRÅGA — featured daily module ════════════════════ */}
            <button
              id="ob-dagensfraga"
              onClick={() => setView("utmaningar")}
              className="home-card-3b pressable"
              style={{
                width: "100%", marginBottom: "6px",
                padding: "14px 16px",
                background: dailyData.answered
                  ? "rgba(44,184,122,0.07)"
                  : "rgba(240,165,0,0.06)",
                border: `1px solid ${dailyData.answered ? C.greenBorder : C.borderGold}`,
                borderRadius: "16px",
                display: "flex", alignItems: "center", gap: "14px",
                cursor: "pointer", textAlign: "left",
                WebkitTapHighlightColor: "transparent",
                fontFamily: "inherit",
              }}
            >
              {/* Circular streak badge — the visual anchor */}
              <div style={{
                flexShrink: 0,
                width: "54px", height: "54px",
                borderRadius: "50%",
                background: dailyData.streak > 0
                  ? "radial-gradient(circle at 38% 38%, rgba(240,165,0,0.20), rgba(240,165,0,0.07))"
                  : dailyData.answered
                    ? "rgba(44,184,122,0.12)"
                    : C.surface,
                border: `1.5px solid ${dailyData.streak > 0 ? C.gold : dailyData.answered ? C.green : C.border}`,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                boxShadow: dailyData.streak > 0
                  ? "0 0 14px rgba(240,165,0,0.18)"
                  : "none",
              }}>
                <div style={{
                  fontSize: "20px", fontWeight: "700", lineHeight: 1,
                  color: dailyData.streak > 0 ? C.gold : dailyData.answered ? C.greenLight : C.textSoft,
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {dailyData.answered && dailyData.streak === 0 ? "✓" : dailyData.streak > 0 ? dailyData.streak : "–"}
                </div>
                <div style={{
                  fontSize: "7.5px", fontWeight: "700", marginTop: "2px",
                  color: dailyData.streak > 0 ? C.goldDark : dailyData.answered ? C.green : C.muted,
                  letterSpacing: "0.3px",
                }}>
                  {dailyData.answered && dailyData.streak === 0 ? t("streak_done_label") : t("streak_label")}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: "800", letterSpacing: "-0.2px", marginBottom: "4px" }}>
                  <span style={{ color: C.gold }}>{t("dagensfraga_label")}</span>
                  <span style={{ color: C.text }}> {t("dagensfraga_name")}</span>
                </div>
                <div style={{ fontSize: "11px", color: C.textSoft, lineHeight: 1.5 }}>
                  {dailyData.answered
                    ? t("dagensfraga_answered")
                    : t("dagensfraga_unanswered")}
                </div>
              </div>

              {/* Circular arrow */}
              <div style={{
                flexShrink: 0, width: "30px", height: "30px",
                borderRadius: "50%",
                background: dailyData.answered ? "rgba(44,184,122,0.12)" : C.goldBg,
                border: `1px solid ${dailyData.answered ? C.greenBorder : C.borderGold}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px",
                color: dailyData.answered ? C.greenLight : C.gold,
              }}>→</div>
            </button>

            {/* ══ READINESS CARD — returning users ════════════════════════ */}
            {tot > 0 && (
              <div className="home-card-4" style={{
                marginTop: "8px",
                borderRadius: "16px",
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
                position: "relative",
                overflow: "hidden",
              }}>
                {/* Left accent strip — color signals readiness */}
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0, width: "3px",
                  background: masterPct >= 80 ? C.green : masterPct >= 50 ? C.gold : C.textSoft,
                  opacity: masterPct >= 80 ? 0.9 : 0.6,
                }} />

                <div style={{ padding: "14px 16px 14px 20px" }}>
                  {/* Label */}
                  <div style={{
                    fontSize: "10px", fontWeight: "700", color: C.textSoft,
                    letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "10px",
                  }}>
                    {t("provsäkerhet_title")}
                  </div>

                  {/* Inline stats — secondary weight, not dominant */}
                  <div style={{ display: "flex", alignItems: "baseline", marginBottom: "10px" }}>
                    {[
                      { val: mastered,   unit: ` ${t("provsäkerhet_done")}`,   color: masterPct >= 80 ? C.greenLight : C.textSoft },
                      { val: `${acc}%`,  unit: ` ${t("provsäkerhet_acc")}`,    color: acc >= 70 ? C.textSoft : C.textSoft },
                      { val: tot,        unit: ` ${t("provsäkerhet_tried")}`,  color: C.textSoft },
                    ].map(({ val, unit, color }, i) => (
                      <div key={unit} style={{ display: "flex", alignItems: "baseline" }}>
                        {i > 0 && (
                          <span style={{ fontSize: "10px", color: C.muted, margin: "0 8px" }}>·</span>
                        )}
                        <span style={{ fontSize: "14px", fontWeight: "700", color }}>{val}</span>
                        <span style={{ fontSize: "10px", color: C.muted, marginLeft: "2px" }}>{unit}</span>
                      </div>
                    ))}
                  </div>

                  {/* Contextual message */}
                  <div style={{ fontSize: "12px", color: C.textSoft, lineHeight: 1.55, marginBottom: "12px" }}>
                    {masterPct >= 80
                      ? t("provsäkerhet_high")
                      : masterPct >= 50
                        ? <><span style={{ color: C.gold, fontWeight: "700" }}>{QUESTIONS.length - mastered}</span> {tf("provsäkerhet_mid", QUESTIONS.length - mastered).replace(/^\d+ /, "")}</>
                        : t("provsäkerhet_low")}
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => setView("prov")}
                    style={{
                      background: "none", border: "none", padding: "0",
                      cursor: "pointer", fontFamily: "inherit",
                      WebkitTapHighlightColor: "transparent",
                      display: "flex", alignItems: "center", gap: "4px",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: "700", color: masterPct >= 80 ? C.greenLight : C.gold }}>
                      {masterPct >= 80 ? t("provsäkerhet_btn_high") : t("provsäkerhet_btn_low")}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ══ GUIDED JOURNEY + APP PEEK — new users only ══════════════ */}
            {tot === 0 && (
              <div className="home-card-4" style={{
                marginTop: "8px",
                borderRadius: "16px",
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{
                    fontSize: "10px", fontWeight: "700", color: C.textSoft,
                    letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "12px",
                  }}>
                    {t("guided_title")}
                  </div>
                  {[
                    { n: "1", title: t("guided_s1_t"), d: t("guided_s1_d") },
                    { n: "2", title: t("guided_s2_t"), d: t("guided_s2_d") },
                    { n: "3", title: t("guided_s3_t"), d: t("guided_s3_d") },
                  ].map(({ n, title, d }, idx, arr) => (
                    <div key={n} style={{
                      display: "flex", alignItems: "flex-start", gap: "12px",
                      marginBottom: idx < arr.length - 1 ? "10px" : "0",
                    }}>
                      <div style={{
                        width: "22px", height: "22px", flexShrink: 0, borderRadius: "7px",
                        background: C.goldBg, border: `1px solid ${C.borderGold}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'DM Mono', monospace", fontSize: "10px", fontWeight: "700", color: C.gold,
                      }}>{n}</div>
                      <div style={{ paddingTop: "2px" }}>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>{title}</div>
                        <div style={{ fontSize: "11px", color: C.textSoft, lineHeight: 1.4 }}>{d}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quiet link to explore */}
                <button
                  onClick={() => setView("prov")}
                  style={{
                    width: "100%", padding: "11px 16px",
                    background: "none", border: "none", borderTop: `1px solid ${C.border}`,
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    WebkitTapHighlightColor: "transparent",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: "11px", color: C.muted }}>
                    {tf("questions_hint", QUESTIONS.length)}
                  </span>
                  <span style={{ fontSize: "11px", color: C.gold, fontWeight: "700" }}>{t("explore_btn")}</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PROV
        ══════════════════════════════════════════════════════════════ */}
        {view === "prov" && (() => {
          const PASS = 70;
          const modeName = (m) =>
            m === "quick" ? t("mode_snabbprov") : m === "focus" ? t("mode_focus") :
            m === 1 ? "DP1" : m === 2 ? "DP2" :
            m === 10 ? "10" : m === 20 ? "20" : m === 30 ? "30" : t("mode_all");
          const TEST_MODES = new Set(["quick", 10, 20, 30, 1, 2]);
          const chartEntries = [...quizHistory]
            .filter(e => TEST_MODES.has(e.mode))
            .slice(0, 8)
            .reverse();
          const isNewUser = tot === 0 && chartEntries.length === 0;
          const lastEntry = chartEntries.length > 0 ? chartEntries[chartEntries.length - 1] : null;

          // Next-best-action recommendation
          const nextAction = (() => {
            if (isNewUser) return { type: "start", label: t("start_snabbprov"), sub: t("prov_next_first_sub"), mode: "quick" };
            if (wrongCount > 0 && masterPct < 50) return { type: "focus", label: t("fokus_title"), sub: tf("fokus_sub", wrongCount), mode: "focus" };
            if (masterPct >= 80) return { type: "delprov", label: t("mode_dp1"), sub: t("prov_next_ready_sub"), mode: 1 };
            if (masterPct >= 50) return { type: "quick", label: t("mode_snabbprov"), sub: t("prov_next_keep_sub"), mode: "quick" };
            return { type: "quick", label: t("mode_snabbprov"), sub: t("prov_next_snabb_sub"), mode: "quick" };
          })();

          // Readiness state
          const readinessLevel = masterPct >= 80 ? "high" : masterPct >= 50 ? "mid" : tot > 0 ? "low" : "none";

          return (
            <div style={{ animation: "screenIn 0.28s ease both" }}>

              {/* ── PAGE HEADER ─────────────────────────────────────────── */}
              <div style={{ paddingBottom: "18px" }}>
                <div style={{ fontSize: "34px", fontWeight: "800", color: C.text, letterSpacing: "-0.8px", lineHeight: 1.05, marginBottom: "5px" }}>
                  {isNewUser
                    ? t("prov_title_new")
                    : masterPct >= 80
                    ? t("prov_title_ready")
                    : t("prov_title_progress")}
                </div>
                <div style={{ fontSize: "12px", color: C.textSoft, fontWeight: "500", lineHeight: 1.55 }}>
                  {isNewUser
                    ? t("prov_sub_new")
                    : masterPct >= 80
                    ? tf("prov_sub_ready", masterPct)
                    : tf("prov_sub_progress", mastered, QUESTIONS.length)}
                </div>
              </div>

              {/* ── NEW USER: GUIDED START ───────────────────────────────── */}
              {isNewUser && (
                <div style={{ marginBottom: "8px" }}>
                  {/* Primary CTA */}
                  <button className="pressable" onClick={() => startQuiz("quick")}
                    style={{ width: "100%", marginBottom: "6px", padding: "0", borderRadius: "18px",
                      overflow: "hidden", border: "none", background: goldGrad, display: "block",
                      cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent",
                      boxShadow: "0 6px 24px rgba(240,165,0,0.28), 0 1px 4px rgba(0,0,0,0.5)",
                      fontFamily: "inherit" }}>
                    <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{ width: "44px", height: "44px", flexShrink: 0, borderRadius: "13px",
                        background: "rgba(0,0,0,0.18)", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: "20px" }}>▶</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "17px", fontWeight: "800", color: "#09090E", letterSpacing: "-0.3px", lineHeight: 1, marginBottom: "4px" }}>{t("start_snabbprov")}</div>
                        <div style={{ fontSize: "11px", fontWeight: "600", color: "rgba(0,0,0,0.45)" }}>{t("mode_snabbprov_prov_sub")}</div>
                      </div>
                      <div style={{ fontSize: "20px", color: "rgba(0,0,0,0.30)", flexShrink: 0 }}>→</div>
                    </div>
                  </button>

                  {/* How it works */}
                  <div style={{ ...card, padding: "16px 18px", marginBottom: "6px" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: C.textSoft, letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: "14px" }}>{t("prov_howto_title")}</div>
                    {[
                      { n: "1", title: t("prov_s1_t"), d: t("prov_s1_d") },
                      { n: "2", title: t("prov_s2_t"), d: t("prov_s2_d") },
                      { n: "3", title: t("prov_s3_t"), d: t("prov_s3_d") },
                    ].map(({ n, title, d }, idx, arr) => (
                      <div key={n} style={{ display: "flex", alignItems: "flex-start", gap: "12px",
                        marginBottom: idx < arr.length - 1 ? "12px" : 0 }}>
                        <div style={{ width: "24px", height: "24px", flexShrink: 0, borderRadius: "8px",
                          background: C.goldBg, border: `1px solid ${C.borderGold}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "'DM Mono', monospace", fontSize: "10px", fontWeight: "700", color: C.gold }}>{n}</div>
                        <div style={{ paddingTop: "3px" }}>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>{title}</div>
                          <div style={{ fontSize: "11px", color: C.textSoft, lineHeight: 1.4 }}>{d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── RETURNING USER: READINESS + NEXT ACTION ─────────────── */}
              {!isNewUser && (
                <div style={{ marginBottom: "8px" }}>

                  {/* Readiness card */}
                  <div style={{ borderRadius: "16px", border: `1px solid ${C.borderGold}`,
                    background: C.surface, marginBottom: "6px", overflow: "hidden", position: "relative" }}>
                    <div style={{ height: "2px", background: goldGrad }} />
                    <div style={{ padding: "16px 18px", position: "relative" }}>
                      <div style={{
                        position: "absolute", top: 0, right: 0, width: "160px", height: "120px",
                        background: "radial-gradient(ellipse at top right, rgba(201,168,76,0.06) 0%, transparent 70%)",
                        pointerEvents: "none",
                      }} />
                      {/* Top row: label + status badge */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                        <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "2px", textTransform: "uppercase" }}>{t("prov_readiness_label")}</div>
                        <div style={{ fontSize: "10px", fontWeight: "700", color: overallColor,
                          background: `${overallColor}14`, border: `1px solid ${overallColor}35`,
                          padding: "3px 10px", borderRadius: "16px" }}>{overallStatus}</div>
                      </div>

                      {/* Mastery % large + progress bar inline */}
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "2px", lineHeight: 1, flexShrink: 0 }}>
                          <span style={{ fontSize: "44px", fontWeight: "800", color: C.text, letterSpacing: "-3px" }}>{masterPct}</span>
                          <span style={{ fontSize: "20px", fontWeight: "700", color: C.gold, letterSpacing: "-1px" }}>%</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "11px", color: C.textSoft, marginBottom: "7px" }}>
                            {tf("prov_sub_progress", mastered, QUESTIONS.length)}
                          </div>
                          {/* Progress bar */}
                          <div style={{ position: "relative", height: "6px" }}>
                            <div style={{ position: "absolute", inset: 0, background: C.border, borderRadius: "3px" }} />
                            <div style={{ position: "absolute", inset: 0, borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: "3px", width: `${masterPct}%`,
                                background: readinessLevel === "high"
                                  ? `linear-gradient(90deg, ${C.green}, ${C.greenLight})`
                                  : readinessLevel === "mid"
                                  ? `linear-gradient(90deg, #7a5c18, ${C.gold})`
                                  : `linear-gradient(90deg, rgba(184,80,88,0.7), ${C.redLight})`,
                                transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                              }} />
                            </div>
                            <div style={{ position: "absolute", left: `${PASS}%`,
                              top: "-3px", height: "12px", width: "2px",
                              background: C.gold, borderRadius: "1px", opacity: 0.5 }} />
                          </div>
                          <div style={{ marginTop: "4px", fontSize: "8px", color: C.muted, opacity: 0.7 }}>
                            {t("prov_readiness_label")} {PASS}%
                          </div>
                        </div>
                      </div>

                      {/* Contextual message */}
                      <div style={{ fontSize: "12px", color: C.textSoft, lineHeight: 1.55 }}>
                        {readinessLevel === "high"
                          ? t("provsäkerhet_high")
                          : readinessLevel === "mid"
                          ? tf("provsäkerhet_mid", QUESTIONS.length - mastered)
                          : t("provsäkerhet_low")}
                      </div>
                    </div>

                    {/* Delprov breakdown */}
                    <div style={{ height: "1px", background: C.border }} />
                    <div style={{ padding: "14px 18px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                      {dpProgress.map(({ dp, cfg: dpCfg, total, mastered: dpM, acc: dpA, pct, tried }) => {
                        const toPass   = Math.max(0, Math.ceil(total * 70 / 100) - dpM);
                        const barCol   = pct >= 70 ? C.greenLight : pct >= 40 ? C.gold : tried ? C.redLight : C.border;
                        const dpStatus = pct >= 70 ? t("dp_status_ready") : pct >= 40 ? t("dp_status_going") : tried ? t("dp_status_practice") : t("dp_status_new");
                        const detail   = !tried
                          ? t("prov_no_training")
                          : pct >= 70
                          ? tf("prov_dp_detail_mid", dpM, total, dpA)
                          : tf("prov_dp_detail_low", toPass, dpA);
                        return (
                          <div key={dp}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                              <div>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: C.text }}>{t(dpCfg.nameKey)}</span>
                                <span style={{ fontSize: "10px", color: C.textSoft, marginLeft: "6px" }}>{t(dpCfg.subKey)}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
                                <span style={{ fontSize: "14px", fontWeight: "800", color: C.text, letterSpacing: "-0.5px" }}>
                                  {pct}<span style={{ fontSize: "10px", color: barCol, fontWeight: "700" }}>%</span>
                                </span>
                                <span style={{ fontSize: "9px", fontWeight: "700", color: barCol,
                                  background: `${barCol}15`, border: `1px solid ${barCol}35`,
                                  padding: "2px 7px", borderRadius: "16px" }}>{dpStatus}</span>
                              </div>
                            </div>
                            <div style={{ position: "relative", height: "4px", marginBottom: "4px" }}>
                              <div style={{ position: "absolute", inset: 0, background: C.border, borderRadius: "16px" }} />
                              <div style={{ position: "absolute", inset: 0, borderRadius: "16px", overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: "16px", width: `${pct}%`,
                                  background: barCol, transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)" }} />
                              </div>
                              <div style={{ position: "absolute", left: "70%", top: "-2px", height: "8px",
                                width: "1.5px", background: C.gold, borderRadius: "1px", opacity: 0.5 }} />
                            </div>
                            <div style={{ fontSize: "10px", color: C.textSoft }}>{detail}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* NEXT BEST ACTION */}
                  <button className="pressable" onClick={() => startQuiz(nextAction.mode)}
                    style={{ width: "100%", marginBottom: "6px", padding: "13px 16px",
                      borderRadius: "14px", border: `1px solid ${nextAction.type === "focus" ? C.redBorder : C.borderGoldStr}`,
                      background: nextAction.type === "focus" ? C.redBg : C.goldBg,
                      display: "flex", alignItems: "center", gap: "12px",
                      cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent", fontFamily: "inherit" }}>
                    <div style={{ width: "38px", height: "38px", flexShrink: 0, borderRadius: "11px",
                      background: nextAction.type === "focus" ? "rgba(208,72,72,0.18)" : "rgba(240,165,0,0.18)",
                      border: `1px solid ${nextAction.type === "focus" ? C.redBorder : C.borderGold}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "16px" }}>
                      {nextAction.type === "focus" ? "🎯" : nextAction.type === "delprov" ? "🏁" : "⚡"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.6px",
                        color: nextAction.type === "focus" ? C.redLight : C.gold, marginBottom: "3px" }}>{t("recommended_next")}</div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>{nextAction.label}</div>
                      <div style={{ fontSize: "11px", color: C.textSoft }}>{nextAction.sub}</div>
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: "700",
                      color: nextAction.type === "focus" ? C.redLight : C.gold,
                      border: `1px solid ${nextAction.type === "focus" ? C.redBorder : C.borderGold}`,
                      padding: "4px 10px", borderRadius: "6px", flexShrink: 0,
                      fontFamily: "'DM Mono', monospace", letterSpacing: "0.5px" }}>{t("start_cta")}</div>
                  </button>

                  {/* RESULT HISTORY CHART — only when there are entries */}
                  {chartEntries.length > 0 && (
                    <div style={{ ...card, padding: "14px 14px 10px", marginBottom: "6px", position: "relative" }}>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: C.textSoft, letterSpacing: "0.6px",
                        textTransform: "uppercase", marginBottom: "10px" }}>{t("result_history_title")}</div>
                      {/* Chart bars */}
                      <div style={{ position: "relative", height: "72px", display: "flex", alignItems: "flex-end", gap: "4px" }}>
                        <div style={{ position: "absolute", left: 0, right: 0,
                          bottom: `${PASS * 0.72}px`, height: "1px",
                          borderTop: "1px dashed rgba(201,168,76,0.40)", pointerEvents: "none", zIndex: 1 }} />
                        <div style={{ position: "absolute", left: 0, bottom: `${PASS * 0.72 + 3}px`,
                          fontSize: "8px", color: C.gold, fontWeight: "600", zIndex: 10,
                          background: C.surface, paddingRight: "4px" }}>70%</div>
                        {chartEntries.map((entry, i) => {
                          const barH = Math.max(3, Math.round(entry.pct * 0.72));
                          const isLast = i === chartEntries.length - 1;
                          return (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 3 }}>
                              <div style={{ fontSize: "7px", fontWeight: "700", lineHeight: 1, marginBottom: "3px",
                                color: entry.pct >= 70 ? C.greenLight : entry.pct >= 50 ? C.gold : C.redLight }}>
                                {isLast ? `${entry.pct}%` : ""}
                              </div>
                              <div style={{ width: "100%", height: `${barH}px`,
                                background: entry.pct >= 70 ? C.green : entry.pct >= 50 ? "#b8860b" : C.red,
                                borderRadius: "3px 3px 2px 2px",
                                opacity: isLast ? 1 : 0.45 + (i / chartEntries.length) * 0.4 }} />
                            </div>
                          );
                        })}
                      </div>
                      {/* X-axis */}
                      <div style={{ display: "flex", gap: "4px", marginTop: "5px" }}>
                        {chartEntries.map((entry, i) => (
                          <div key={i} style={{ flex: 1, textAlign: "center",
                            fontSize: "7.5px", color: C.muted, lineHeight: 1 }}>
                            {modeName(entry.mode)}
                          </div>
                        ))}
                      </div>
                      {/* Summary row */}
                      {chartEntries.length >= 2 && (() => {
                        const avg = Math.round(chartEntries.reduce((s, e) => s + e.pct, 0) / chartEntries.length);
                        const best = Math.max(...chartEntries.map(e => e.pct));
                        const passed = chartEntries.filter(e => e.pct >= 70).length;
                        return (
                          <div style={{ display: "flex", marginTop: "10px",
                            borderTop: `1px solid ${C.borderSoft}`, paddingTop: "10px" }}>
                            {[[`${avg}%`, t("result_avg")], [`${best}%`, t("result_best")], [`${passed}/${chartEntries.length}`, t("result_passed_lbl")]].map(([val, lbl], i) => (
                              <div key={lbl} style={{ flex: 1, textAlign: "center",
                                borderLeft: i > 0 ? `1px solid ${C.borderSoft}` : "none" }}>
                                <div style={{ fontSize: "14px", fontWeight: "800", color: C.text, letterSpacing: "-0.3px", lineHeight: 1, marginBottom: "3px" }}>{val}</div>
                                <div style={{ fontSize: "9px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px" }}>{lbl}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* ── VÄLJ TEST ─────────────────────────────────────────────── */}
              <div style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: C.textSoft, letterSpacing: "0.6px",
                  textTransform: "uppercase", marginBottom: "10px" }}>
                  {isNewUser ? t("test_length_new") : t("test_length_returning")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {(isNewUser
                    ? [
                        { m: "quick", label: t("mode_snabbprov"), sub: t("mode_snabbprov_sub_new"), icon: "⚡", primary: true },
                        { m: 10,      label: t("mode_10"),        sub: t("mode_10_sub"),            icon: "10", primary: false },
                        { m: 20,      label: t("mode_20"),        sub: t("mode_20_sub"),            icon: "20", primary: false },
                        { m: 30,      label: t("mode_30"),        sub: t("mode_30_sub"),            icon: "30", primary: false },
                      ]
                    : [
                        { m: "quick", label: t("mode_snabbprov"), sub: t("mode_snabbprov_sub_ret"), icon: "⚡", primary: false },
                        { m: 10,      label: t("mode_10"),        sub: t("mode_10_sub").split(" · ")[0], icon: "10", primary: false },
                        { m: 20,      label: t("mode_20"),        sub: t("mode_20_sub").split(" · ")[0], icon: "20", primary: false },
                        { m: 30,      label: t("mode_30"),        sub: t("mode_30_sub").split(" · ")[0], icon: "30", primary: false },
                      ]
                  ).map(({ m, label, sub, icon, primary }) => (
                    <button key={String(m)} className="pressable-sm" onClick={() => startQuiz(m)}
                      style={{ ...card, width: "100%", padding: "12px 14px",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "12px",
                        textAlign: "left", WebkitTapHighlightColor: "transparent",
                        borderColor: primary ? C.borderGoldStr : C.border,
                        transition: "border-color 0.15s, background 0.15s", fontFamily: "inherit" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderGoldStr; e.currentTarget.style.background = C.surfaceAlt; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = primary ? C.borderGoldStr : C.border; e.currentTarget.style.background = C.surface; }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
                        background: primary ? C.goldBg : C.surfaceAlt,
                        border: `1px solid ${primary ? C.borderGold : C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: primary ? "17px" : "11px", fontWeight: "800",
                        color: primary ? C.gold : C.muted, letterSpacing: "-0.5px" }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: primary ? "700" : "600", color: C.text, marginBottom: "1px" }}>{label}</div>
                        <div style={{ fontSize: "10px", color: C.muted }}>{sub}</div>
                      </div>
                      <span style={{ color: C.muted, fontSize: "16px", lineHeight: 1 }}>›</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── OFFICIELLA DELPROV ───────────────────────────────────── */}
              <div style={{ paddingBottom: "4px" }}>

                {/* Section header + explanation */}
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.6px", textTransform: "uppercase", color: C.textSoft }}>
                      {t("official_tests_title")}
                    </div>
                    <div style={{ fontSize: "8px", fontWeight: "700", color: C.gold, letterSpacing: "0.4px",
                      background: C.goldBg, border: `1px solid ${C.borderGold}`,
                      padding: "2px 7px", borderRadius: "5px", fontFamily: "'DM Mono', monospace",
                      flexShrink: 0 }}>{t("official_badge")}</div>
                  </div>
                  <div style={{ fontSize: "11px", color: C.textSoft, lineHeight: 1.65 }}>
                    {t("official_desc")}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[1, 2].map(dp => {
                    const dpCfg = DELPROV_CONFIG[dp];
                    const prog  = dpProgress.find(p => p.dp === dp);
                    const barCol    = prog.pct >= 70 ? C.greenLight : prog.pct >= 40 ? C.gold : prog.tried ? C.redLight : C.border;
                    const statusLbl = prog.pct >= 70 ? t("dp_status_ready") : prog.pct >= 40 ? t("dp_status_going") : prog.tried ? t("dp_status_practice") : t("dp_status_new");
                    return (
                      <button key={dp} id={`ob-delprov${dp}`} className="pressable-sm" onClick={() => startQuiz(dp)}
                        style={{ ...card, padding: "0", cursor: "pointer", textAlign: "left", display: "block",
                          overflow: "hidden", transition: "border-color 0.18s, background 0.18s",
                          WebkitTapHighlightColor: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderGoldStr; e.currentTarget.style.background = C.surfaceAlt; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}>
                        <div style={{ padding: "14px 14px 0" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                            <div>
                              <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: "3px" }}>
                                {t(dpCfg.nameKey)}
                              </div>
                              <div style={{ fontSize: "12px", fontWeight: "700", color: C.text, lineHeight: 1.3 }}>
                                {t(dpCfg.subKey)}
                              </div>
                            </div>
                            <div style={{ fontSize: "8px", fontWeight: "700", color: barCol,
                              background: `${barCol}15`, border: `1px solid ${barCol}30`,
                              padding: "2px 6px", borderRadius: "16px", flexShrink: 0, marginLeft: "4px" }}>{statusLbl}</div>
                          </div>
                          <div style={{ height: "3px", background: C.border, borderRadius: "16px", overflow: "hidden", marginBottom: "14px" }}>
                            <div style={{ height: "100%", borderRadius: "16px", width: `${prog.pct}%`,
                              background: barCol, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
                          </div>
                        </div>
                        <div style={{ padding: "9px 14px", borderTop: `1px solid ${C.border}`,
                          background: C.surfaceAlt }}>
                          <div style={{ fontSize: "9px", color: C.textSoft, lineHeight: 1.7 }}>
                            {tf("dp_questions_time", dpCfg.total, dpCfg.time)}
                          </div>
                          <div style={{ fontSize: "9px", color: C.muted, lineHeight: 1.7 }}>
                            {tf("dp_pass_mark", dpCfg.passMark, dpCfg.countedQ)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════
            UTMANINGAR
        ══════════════════════════════════════════════════════════════ */}
        {view === "utmaningar" && (() => {
          const dailyQ         = QUESTIONS.find(q => q.id === dailyData.questionId);
          const dailyDateLabel = dailyQ
            ? new Date(dailyData.date + "T12:00:00").toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" })
            : "";
          const bilderCount    = QUESTIONS.filter(q => q.image).length;
          const isNewUser      = tot === 0;

          return (
            <div style={{ animation: "screenIn 0.28s ease both" }}>

              {/* ── PAGE HEADER ────────────────────────────────────────── */}
              <div className="utmaning-s1" style={{ paddingBottom: "14px", marginBottom: "20px" }}>
                <div style={{ fontSize: "28px", fontWeight: "800", color: C.text, letterSpacing: "-0.6px", lineHeight: 1.1, marginBottom: "4px" }}>
                  {t("chal_title")}
                </div>
                <div style={{ fontSize: "13px", color: C.muted, fontWeight: "500" }}>
                  {t("chal_sub")}
                </div>
              </div>

              {/* ── NEW USER INTRO ─────────────────────────────────────── */}
              {isNewUser && (
                <div className="utmaning-s1b" style={{
                  padding: "11px 14px", marginBottom: "18px", borderRadius: "12px",
                  background: "rgba(240,165,0,0.05)", border: `1px solid ${C.borderGold}`,
                  fontSize: "12px", color: C.textSoft, lineHeight: 1.6,
                }}>
                  <span style={{ fontWeight: "700", color: C.gold }}>{t("chal_tips_prefix")}</span>{" "}
                  {t("chal_tips_text")}
                </div>
              )}

              {/* ══ MODE 1: Dagens fråga ════════════════════════════════════ */}
              <div className="utmaning-s2" style={{
                background: C.surface,
                border: `1px solid ${
                  dailyData.answered && dailyData.correct  ? C.greenBorder :
                  dailyData.answered && !dailyData.correct ? C.redBorder   :
                  C.borderGold
                }`,
                borderTop: `2px solid ${
                  dailyData.answered && dailyData.correct  ? C.green :
                  dailyData.answered && !dailyData.correct ? C.red   :
                  C.gold
                }`,
                borderRadius: "16px",
                overflow: "hidden",
                marginBottom: "12px",
              }}>
                {/* Header */}
                <div style={{
                  padding: "13px 18px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "linear-gradient(135deg, rgba(201,168,76,0.05) 0%, transparent 100%)",
                }}>
                  <div>
                    <div style={{
                      fontSize: "10px", fontWeight: "800", letterSpacing: "1.4px",
                      textTransform: "uppercase", color: C.gold, marginBottom: "3px",
                    }}>
                      {t("daily_q_section_title")}
                    </div>
                    <div style={{ fontSize: "12px", color: C.muted, textTransform: "capitalize" }}>
                      {dailyDateLabel}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      background: dailyData.streak > 0 ? C.goldBg : C.surfaceAlt,
                      border: `1px solid ${dailyData.streak > 0 ? C.borderGold : C.border}`,
                      borderRadius: "16px", padding: "5px 11px",
                      fontSize: "13px", fontWeight: "700",
                      color: dailyData.streak > 0 ? C.gold : C.muted,
                    }}>
                      🔥 {dailyData.streak} {dailyData.streak === 1 ? t("streak_day") : t("streak_days")}
                    </div>
                    {dailyData.bestStreak > 1 && (
                      <div style={{ fontSize: "10px", color: C.faint, paddingRight: "2px" }}>
                        {t("streak_best")} {dailyData.bestStreak}
                      </div>
                    )}
                  </div>
                </div>

                {/* Question body */}
                {dailyQ ? (() => {
                  const tDailyQ = tq(dailyQ);
                  return (
                  <div style={{ padding: "16px 18px 18px" }}>
                    {tDailyQ.image && (
                      <ZoomableImage src={tDailyQ.image} style={{
                        width: "100%", borderRadius: "16px", marginBottom: "14px",
                        border: `1px solid ${C.border}`,
                      }} />
                    )}
                    <p style={{
                      fontSize: "15px", lineHeight: "1.68", color: C.text,
                      fontWeight: "600", marginBottom: "14px",
                    }}>
                      {tDailyQ.question}
                    </p>

                    {/* Options */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      {tDailyQ.options.map((opt, i) => {
                        const s     = optionStyles(C, i, tDailyQ.correct, dailyData.chosenIdx, dailyData.answered);
                        const shake = shakeBtn === i;
                        return (
                          <button key={i}
                            className={`quiz-opt${shake ? " shake" : ""}`}
                            onClick={() => answerDaily(i)}
                            disabled={dailyData.answered}
                            style={{
                              width: "100%", textAlign: "left",
                              display: "flex", alignItems: "center", gap: "11px",
                              padding: "10px 13px",
                              background: s.bg, border: `1px solid ${s.brd}`,
                              borderRadius: "16px",
                              cursor: dailyData.answered ? "default" : "pointer",
                              WebkitTapHighlightColor: "transparent",
                              transition: "background 0.18s, border-color 0.18s",
                              animation: dailyData.answered && i === tDailyQ.correct
                                ? "correctReveal 0.4s ease" : undefined,
                            }}
                          >
                            <span style={{
                              width: "26px", height: "26px", borderRadius: "7px", flexShrink: 0,
                              background: s.badgeBg, border: `1px solid ${s.badgeBrd}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: s.indicator ? "12px" : "11px", fontWeight: "700", color: s.badgeCol,
                            }}>
                              {s.indicator || "ABCDE"[i]}
                            </span>
                            <span style={{ fontSize: "13px", color: s.col, lineHeight: 1.4 }}>{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Post-answer result + explanation */}
                    {dailyData.answered && (
                      <div style={{ marginTop: "13px", animation: "popIn 0.45s cubic-bezier(0.34,1.4,0.64,1) both" }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: "9px",
                          padding: "10px 13px", borderRadius: "16px",
                          background: dailyData.correct ? C.greenBg : C.redBg,
                          border: `1px solid ${dailyData.correct ? C.greenBorder : C.redBorder}`,
                          marginBottom: tDailyQ.explanation ? "9px" : "0",
                        }}>
                          <span style={{ fontSize: "14px", flexShrink: 0 }}>
                            {dailyData.correct ? "✓" : "✗"}
                          </span>
                          <span style={{
                            fontSize: "13px", fontWeight: "600",
                            color: dailyData.correct ? C.greenLight : C.redLight,
                          }}>
                            {dailyData.correct
                              ? (dailyData.streak === 1
                                  ? t("daily_correct_start")
                                  : tf("daily_correct_streak", dailyData.streak))
                              : t("daily_wrong")}
                          </span>
                        </div>
                        {tDailyQ.explanation && (
                          <div style={{
                            padding: "10px 13px",
                            background: "rgba(201,168,76,0.04)",
                            borderRadius: "16px",
                            border: `1px solid rgba(201,168,76,0.12)`,
                          }}>
                            <p style={{ color: C.textSoft, fontSize: "13px", lineHeight: "1.65", margin: 0 }}>
                              {tDailyQ.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })() : (
                  <div style={{ padding: "24px 18px", textAlign: "center", color: C.faint, fontSize: "13px" }}>
                    {t("daily_no_question")}
                  </div>
                )}

                {/* Completion footer — clearly visible once answered */}
                {dailyData.answered && (
                  <div style={{
                    padding: "11px 18px",
                    borderTop: `1px solid ${C.border}`,
                    textAlign: "center",
                    fontSize: "12px",
                    color: C.muted,
                    background: "rgba(255,255,255,0.01)",
                    letterSpacing: "0.1px",
                  }}>
                    {t("daily_come_back")}
                  </div>
                )}
              </div>

              {/* ══ MODE 2: Rätt i rad ══════════════════════════════════════ */}
              <button
                onClick={() => startQuiz("rir")}
                className="pressable utmaning-s3"
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                  padding: "0", marginBottom: "10px",
                  borderRadius: "20px", overflow: "hidden",
                  border: `1px solid ${C.borderGold}`,
                  background: C.goldBg,
                  boxShadow: "0 4px 24px rgba(240,165,0,0.10)",
                  position: "relative",
                }}
              >

                <div style={{ padding: "20px 20px 18px", display: "flex", alignItems: "center", gap: "16px" }}>
                  {/* Icon badge */}
                  <div style={{
                    width: "50px", height: "50px", borderRadius: "16px", flexShrink: 0,
                    background: "rgba(201,168,76,0.1)", border: `1px solid rgba(201,168,76,0.2)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "24px",
                  }}>
                    🎯
                  </div>

                  {/* Text block */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cat-pill" style={{ marginBottom: "8px" }}>
                      <span className="cat-pill-dot" />
                      <span className="cat-pill-text">{t("challenge_pill")}</span>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: "700", color: C.text, letterSpacing: "-0.3px", lineHeight: 1, marginBottom: "6px", fontFamily: "'Manrope', sans-serif" }}>
                      {t("rir_card_title")}
                    </div>
                    <div style={{ fontSize: "12px", color: C.muted, lineHeight: 1.5 }}>
                      {t("rir_card_sub2")}
                    </div>
                  </div>

                  {/* Record circle — mirrors Dagens fråga streak circle */}
                  <div style={{
                    flexShrink: 0,
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    border: rirBest > 0
                      ? `1.5px solid rgba(201,168,76,0.55)`
                      : `1.5px solid rgba(201,168,76,0.20)`,
                    background: rirBest > 0
                      ? "radial-gradient(circle at 38% 36%, rgba(201,168,76,0.16) 0%, rgba(201,168,76,0.06) 100%)"
                      : "radial-gradient(circle at 38% 36%, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.02) 100%)",
                    boxShadow: rirBest > 0
                      ? "0 0 0 5px rgba(201,168,76,0.06), 0 0 0 10px rgba(201,168,76,0.025)"
                      : "none",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "2px",
                  }}>
                    <div style={{
                      fontSize: "18px",
                      fontWeight: "800",
                      lineHeight: 1,
                      letterSpacing: "-0.5px",
                      color: rirBest > 0 ? C.gold : C.muted,
                    }}>
                      {rirBest}
                    </div>
                    <div style={{
                      fontSize: "7px",
                      fontWeight: "700",
                      letterSpacing: "0.8px",
                      textTransform: "uppercase",
                      color: rirBest > 0 ? C.goldDark : C.faint,
                    }}>
                      {t("rir_record_lbl")}
                    </div>
                  </div>
                </div>
              </button>

              {/* ══ MODE 3: Bildutmaning ════════════════════════════════════ */}
              <button
                onClick={() => startQuiz("bilder")}
                className="pressable utmaning-s4"
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                  padding: "0", marginBottom: "10px",
                  borderRadius: "20px", overflow: "hidden",
                  border: "1px solid rgba(90,120,200,0.18)",
                  background: "rgba(80,100,180,0.07)",
                  boxShadow: "0 4px 24px rgba(80,100,180,0.07)",
                  position: "relative",
                }}
              >
                <div style={{ padding: "20px 20px 18px", display: "flex", alignItems: "center", gap: "16px" }}>
                  {/* Icon badge */}
                  <div style={{
                    width: "50px", height: "50px", borderRadius: "16px", flexShrink: 0,
                    background: "rgba(90,120,200,0.10)", border: "1px solid rgba(90,120,200,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "22px",
                  }}>
                    🖼️
                  </div>

                  {/* Text block */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      marginBottom: "8px",
                      background: "rgba(90,120,200,0.10)",
                      border: "1px solid rgba(90,120,200,0.18)",
                      borderRadius: "20px",
                      padding: "2px 8px 2px 6px",
                    }}>
                      <span style={{
                        width: "5px", height: "5px", borderRadius: "50%",
                        background: "rgba(140,160,230,0.9)", flexShrink: 0,
                      }} />
                      <span style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.9px", textTransform: "uppercase", color: "rgba(160,180,240,0.9)" }}>{t("challenge_pill")}</span>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: "700", color: C.text, letterSpacing: "-0.3px", lineHeight: 1, marginBottom: "6px" }}>
                      {t("bild_card_title")}
                    </div>
                    <div style={{ fontSize: "12px", color: C.muted, lineHeight: 1.5 }}>
                      {t("bild_card_sub2")}
                    </div>
                  </div>

                  {/* Count circle */}
                  <div style={{
                    flexShrink: 0,
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    border: "1.5px solid rgba(90,120,200,0.28)",
                    background: "radial-gradient(circle at 38% 36%, rgba(90,120,200,0.12) 0%, rgba(90,120,200,0.04) 100%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "2px",
                  }}>
                    <div style={{ fontSize: "15px", fontWeight: "800", lineHeight: 1, letterSpacing: "-0.5px", color: "rgba(160,180,240,0.85)" }}>
                      {bilderCount}
                    </div>
                    <div style={{ fontSize: "7px", fontWeight: "700", letterSpacing: "0.8px", textTransform: "uppercase", color: "rgba(120,140,210,0.7)" }}>
                      {t("bild_count_lbl")}
                    </div>
                  </div>
                </div>
              </button>

            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════
            QUIZ
        ══════════════════════════════════════════════════════════════ */}
        {view === "quiz" && quiz && (() => {
          const q         = tq(quiz.questions[quiz.current]);
          const cfg       = (mode === 1 || mode === 2) ? DELPROV_CONFIG[mode] : null;
          const danger    = timeLeft !== null && timeLeft < 300;
          const modeLabel = mode === "quick" ? t("mode_snabbprov") : mode === "focus" ? t("mode_focus") : mode === "rir" ? t("mode_rir") : mode === "bilder" ? t("mode_bilder") : mode === "all" ? t("mode_all") : mode === 10 ? t("mode_10") : mode === 20 ? t("mode_20") : mode === 30 ? t("mode_30") : cfg ? t(cfg.nameKey) : "";

          return (
            <div>
              {/* Quiz progress bar — thin amber strip at very top of content */}
              <div style={{
                height: "2px", background: C.faint,
                marginBottom: "20px",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0,
                  width: `${((quiz.current) / quiz.questions.length) * 100}%`,
                  background: C.gold,
                  transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>

              {/* Top bar */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "24px",
              }}>
                <button
                  onClick={() => { clearTimeout(timer.current); setView((mode === "rir" || mode === "bilder") ? "utmaningar" : "home"); }}
                  style={{
                    ...btnGhost,
                    fontSize: "13px", padding: "8px 14px",
                  }}
                >
                  {t("quiz_cancel")}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {timeLeft !== null && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      background: danger ? C.redBg : C.surface,
                      border: `1px solid ${danger ? C.redBorder : C.border}`,
                      borderRadius: "10px",
                      padding: "5px 12px",
                      fontSize: "13px", fontWeight: "600",
                      color: danger ? C.redLight : C.textSoft,
                      fontFamily: "'DM Mono', monospace",
                      transition: "all 0.4s",
                    }}>
                      {fmt(timeLeft)}
                    </div>
                  )}
                  <div style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: "10px",
                    padding: "5px 12px",
                    fontSize: "13px", fontWeight: "600",
                    fontFamily: "'DM Mono', monospace",
                    color: C.gold,
                  }}>
                    {quiz.current + 1}
                    <span style={{ color: C.muted }}> / {quiz.questions.length}</span>
                  </div>
                </div>
              </div>

              {/* Mode label */}
              <div className="cat-pill" style={{ marginBottom: "14px" }}>
                <span className="cat-pill-dot" />
                <span className="cat-pill-text">{modeLabel}</span>
              </div>

              {/* Question image */}
              <ZoomableImage
                src={q.image}
                style={{
                  width: "100%", borderRadius: "16px", marginBottom: "18px",
                  border: `1px solid ${C.border}`,
                }}
              />

              {/* Question text */}
              <p style={{
                fontSize: "18px", lineHeight: "1.68", color: C.text,
                fontWeight: "700", marginBottom: "22px",
                fontFamily: "'Manrope', sans-serif",
                letterSpacing: "-0.2px",
              }}>
                {q.question}
              </p>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {q.options.map((opt, i) => {
                  const s = optionStyles(C, i, q.correct, quiz.answered, quiz.answered !== null);
                  return (
                    <button key={i}
                      className={quiz.answered === null ? "quiz-opt" : ""}
                      onClick={() => answer(i)}
                      style={{
                        background: s.bg,
                        border: `1px solid ${s.brd}`,
                        borderRadius: "16px",
                        padding: "14px 15px", color: s.col,
                        fontSize: "14px", fontWeight: "500", textAlign: "left",
                        cursor: quiz.answered !== null ? "default" : "pointer",
                        transition: "background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s",
                        boxShadow: quiz.answered !== null && i === q.correct
                          ? "0 2px 16px rgba(44,184,122,0.15)"
                          : quiz.answered === i && i !== q.correct
                          ? "0 2px 12px rgba(208,72,72,0.12)"
                          : "none",
                        display: "flex", alignItems: "center", gap: "12px",
                        animation: shakeBtn === i
                          ? "shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97) both"
                          : (quiz.answered !== null && i === q.correct
                            ? "correctReveal 0.38s cubic-bezier(0.34,1.2,0.64,1) both"
                            : "none"),
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <OptionBadge letter={"ABCDE"[i]} bg={s.badgeBg} border={s.badgeBrd} color={s.badgeCol} />
                      <span style={{ flex: 1, lineHeight: 1.5 }}>{opt}</span>
                      {quiz.answered !== null && s.indicator && (
                        <span style={{
                          fontSize: "12px", fontWeight: "700", flexShrink: 0,
                          color: i === q.correct ? C.greenLight : C.redLight,
                          fontFamily: "'DM Mono', monospace",
                        }}>
                          {s.indicator}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation + next button */}
              {quiz.answered !== null && (
                <div ref={explainRef} style={{ animation: "popIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both" }}>
                  {q.explanation && (
                    <div style={{ marginTop: "18px" }}>
                      <ExplanationBox text={q.explanation} />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                    <button
                      onClick={() => toggleSave(q.id)}
                      style={{
                        ...btnGhost,
                        padding: "16px",
                        flexShrink: 0,
                        borderColor: savedIds.includes(q.id) ? C.gold : C.border,
                        color: savedIds.includes(q.id) ? C.gold : C.muted,
                        fontWeight: savedIds.includes(q.id) ? "700" : "500",
                        fontSize: "13px",
                        transition: "all 0.15s",
                      }}
                    >
                      {savedIds.includes(q.id) ? t("saved") : t("save_bookmark")}
                    </button>
                    <button onClick={next}
                      className="pressable"
                      style={{
                        ...btnGold, flex: 1, padding: "16px",
                        fontSize: "13px", letterSpacing: "1.5px", textTransform: "uppercase",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {quiz.current + 1 >= quiz.questions.length ? t("quiz_see_result") : t("quiz_next")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════
            RESULT
        ══════════════════════════════════════════════════════════════ */}
        {view === "result" && result && (() => {
          const cfg    = (result.mode === 1 || result.mode === 2) ? DELPROV_CONFIG[result.mode] : null;
          const pct    = Math.round(result.score / result.total * 100);
          const passed = cfg ? result.score >= cfg.passMark : pct >= 70;

          return (
            <div style={{ animation: "screenIn 0.28s ease both" }}>

              {/* Score card */}
              {result.mode === "rir" ? (
                <div style={{
                  ...card,
                  borderColor: result.score >= 10 ? C.borderGoldStr : C.border,
                  padding: "28px 24px 24px",
                  marginBottom: "24px",
                  background: result.score >= 10
                    ? "linear-gradient(135deg, rgba(201,168,76,0.07) 0%, transparent 100%)"
                    : "rgba(255,255,255,0.01)",
                  textAlign: "center",
                }}>
                  <div className="result-emoji" style={{ fontSize: "44px", marginBottom: "12px" }}>
                    {result.score >= 20 ? "🔥" : result.score >= 10 ? "💪" : result.score >= 5 ? "📖" : "🎯"}
                  </div>
                  <div className="result-badge" style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: C.gold, marginBottom: "16px" }}>
                    {t("result_rir_title")}
                  </div>
                  <div className="result-score" style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "4px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "64px", fontWeight: "500", color: C.text, lineHeight: 1, letterSpacing: "-3px", fontFamily: "'DM Mono', monospace" }}>
                      {result.score}
                    </span>
                    <span style={{ fontSize: "18px", fontWeight: "500", color: C.muted }}>
                      &nbsp;{t("result_correct_unit")}
                    </span>
                  </div>
                  {rirBest > 0 && (
                    <div style={{ fontSize: "12px", color: result.score >= rirBest && result.score > 0 ? C.gold : C.muted, marginTop: "4px" }}>
                      {result.score >= rirBest && result.score > 0 ? t("result_new_record") : `${t("result_record_prefix")} ${rirBest}`}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  ...card,
                  borderColor: passed ? C.greenBorder : C.redBorder,
                  padding: "28px 24px 24px",
                  marginBottom: "24px",
                  background: passed
                    ? "linear-gradient(135deg, rgba(79,168,112,0.06) 0%, transparent 100%)"
                    : "linear-gradient(135deg, rgba(184,80,88,0.06) 0%, transparent 100%)",
                  textAlign: "center",
                }}>
                  <div className="result-emoji" style={{ fontSize: "44px", marginBottom: "12px" }}>
                    {passed ? "🏆" : result.expired ? "⏰" : "📖"}
                  </div>

                  <div className="result-badge" style={{
                    fontSize: "15px", fontWeight: "700", letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: passed ? C.greenLight : C.redLight,
                    marginBottom: "16px",
                  }}>
                    {passed ? t("result_passed") : t("result_failed")}
                    {result.expired && (
                      <span style={{ display: "block", fontSize: "11px", textTransform: "none", letterSpacing: "0", fontWeight: "500", marginTop: "4px", color: C.redLight }}>
                        {t("result_time_expired")}
                      </span>
                    )}
                  </div>

                  {/* Score number */}
                  <div className="result-score" style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "4px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "64px", fontWeight: "500", color: C.text, lineHeight: 1, letterSpacing: "-3px", fontFamily: "'DM Mono', monospace" }}>
                      {result.score}
                    </span>
                    <span style={{ fontSize: "24px", fontWeight: "500", color: C.muted }}>
                      / {result.total}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: C.muted, marginBottom: "4px" }}>
                    {tf("result_pct_correct", pct)}
                  </div>

                  {/* Score bar */}
                  <ScoreBar score={result.score} total={result.total} passMark={cfg?.passMark} />

                  {cfg && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      background: C.surfaceAlt, border: `1px solid ${C.border}`,
                      borderRadius: "99px", padding: "6px 14px",
                      fontSize: "11px", color: C.muted,
                      marginTop: "6px",
                    }}>
                      {t("result_pass_mark_label")}{" "}
                      <span style={{ color: C.gold, fontWeight: "700" }}>{tf("result_pass_mark_val", cfg.passMark, cfg.countedQ)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Answer review */}
              <Label>{t("result_review_title")}</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
                {result.answers.map((a, i) => (
                  <button key={i}
                    className="review-item"
                    onClick={() => setPopupQ({ ...tq(a.q), chosen: a.chosen })}
                    style={{
                      display: "flex", alignItems: "center", gap: "11px",
                      padding: "11px 14px",
                      background: a.correct ? C.greenBg : C.redBg,
                      border: `1px solid ${a.correct ? C.greenBorder : C.redBorder}`,
                      borderRadius: "16px", cursor: "pointer",
                      width: "100%", textAlign: "left",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <span style={{
                      width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                      background: a.correct ? "rgba(79,168,112,0.25)" : "rgba(184,80,88,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: "700",
                      color: a.correct ? C.greenLight : C.redLight,
                    }}>
                      {a.correct ? "✓" : "✗"}
                    </span>
                    <span style={{ fontSize: "12px", color: C.textSoft, flex: 1, lineHeight: 1.45 }}>
                      {a.q.question.substring(0, 70)}...
                    </span>
                    <span style={{ color: C.muted, fontSize: "14px", lineHeight: 1, flexShrink: 0 }}>›</span>
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => startQuiz(result.mode)}
                  className="pressable"
                  style={{ ...btnGold, flex: 1, padding: "15px", fontSize: "14px" }}>
                  {result.mode === "rir" ? t("result_new_round") : t("result_retry")}
                </button>
                <button onClick={() => setView((result.mode === "rir" || result.mode === "bilder") ? "utmaningar" : "home")}
                  className="pressable-sm"
                  style={{ ...btnGhost, flex: 1, padding: "15px", fontSize: "14px", justifyContent: "center" }}>
                  {(result.mode === "rir" || result.mode === "bilder") ? t("result_back_challenges") : t("result_back_home")}
                </button>
              </div>

              {/* Result question popup */}
              {popupQ && (
                <Popup onClose={() => setPopupQ(null)}>
                  <QuestionPopupBody
                    q={popupQ}
                    chosen={popupQ.chosen}
                    revealed={true}
                    onSelectOption={null}
                    onClose={() => setPopupQ(null)}
                    isSaved={savedIds.includes(popupQ.id)}
                    onToggleSave={toggleSave}
                  />
                </Popup>
              )}
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════
            FLASHCARD
        ══════════════════════════════════════════════════════════════ */}
        {view === "flashcard" && (() => {
          const qs = flashcards;
          if (!qs.length) return (
            <div style={{ textAlign: "center", paddingTop: "60px" }}>
              <div style={{ fontSize: "44px", marginBottom: "14px" }}>📭</div>
              <p style={{ color: C.muted, marginBottom: "18px", fontSize: "14px" }}>{t("flash_empty")}</p>
              <button onClick={() => setView("mer")} style={btnGhost}>{t("back_mer")}</button>
            </div>
          );

          const q       = tq(qs[flashIdx]);
          const dpLabel = DELPROV_CONFIG[q.delprov];

          return (
            <div>
              {/* Top bar */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "20px",
              }}>
                <button onClick={() => setView("mer")} style={btnGhost}>{t("back_mer")}</button>
                <div style={{
                  background: C.goldBg, border: `1px solid ${C.borderGold}`,
                  borderRadius: "16px", padding: "5px 13px",
                  fontSize: "13px", fontWeight: "700", color: C.gold,
                }}>
                  {flashIdx + 1}
                  <span style={{ color: C.muted, fontWeight: "500" }}> / {qs.length}</span>
                </div>
              </div>

              <ProgressBar value={flashIdx + 1} total={qs.length} />

              {/* Category */}
              <Label color={C.gold}>{t(dpLabel.nameKey)} — {t(dpLabel.subKey)}</Label>

              {/* 3-D flip card */}
              <div className="flash-scene" style={{ marginBottom: "18px" }}>
                <div className={`flash-card${flipped ? " is-flipped" : ""}`} onClick={() => setFlipped(f => !f)}>

                  {/* Front */}
                  <div className="flash-face flash-front" style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderTop: `3px solid ${C.gold}`,
                  }}>
                    <div style={{
                      fontSize: "9px", fontWeight: "700", letterSpacing: "3px",
                      color: C.gold, marginBottom: "18px", textTransform: "uppercase",
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {t("flash_question_side").toUpperCase()} · {t("flash_tap_hint").toUpperCase()}
                    </div>
                    <ZoomableImage
                      src={q.image}
                      style={{ width: "100%", borderRadius: "16px", marginBottom: "14px", border: `1px solid ${C.border}` }}
                    />
                    <p style={{ fontSize: "16px", lineHeight: "1.72", color: C.text, margin: 0 }}>
                      {q.question}
                    </p>
                  </div>

                  {/* Back */}
                  <div className="flash-face flash-back" style={{
                    background: C.greenBg,
                    border: `1px solid ${C.greenBorder}`,
                    borderTop: `3px solid ${C.green}`,
                  }}>
                    <div style={{
                      fontSize: "9px", fontWeight: "700", letterSpacing: "3px",
                      color: C.greenLight, marginBottom: "18px", textTransform: "uppercase",
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {t("flash_answer_side").toUpperCase()}
                    </div>
                    <p style={{
                      fontSize: "16px", fontWeight: "700", color: C.greenLight,
                      marginBottom: q.explanation ? "16px" : 0,
                    }}>
                      ✓ {q.options[q.correct]}
                    </p>
                    {q.explanation && (
                      <p style={{ fontSize: "13px", color: C.textSoft, lineHeight: "1.68", margin: 0 }}>
                        {q.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "8px" }}>
                <button
                  className={flashIdx === 0 ? "" : "pressable-sm"}
                  onClick={() => { setFlashIdx(i => Math.max(0, i - 1)); setFlipped(false); }}
                  disabled={flashIdx === 0}
                  style={{
                    ...btnGhost,
                    opacity: flashIdx === 0 ? 0.28 : 1,
                    cursor: flashIdx === 0 ? "default" : "pointer",
                    justifyContent: "center", padding: "13px", fontSize: "18px",
                  }}
                >
                  ←
                </button>
                <button
                  className="pressable-sm"
                  onClick={() => setFlipped(f => !f)}
                  style={{
                    background: C.goldBg, border: `1px solid ${C.borderGold}`,
                    borderRadius: "16px", color: C.gold, cursor: "pointer",
                    fontSize: "13px", fontWeight: "700", padding: "13px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: "6px", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {t("flash_flip_btn")}
                </button>
                <button
                  className="pressable-sm"
                  onClick={() => {
                    if (flashIdx === qs.length - 1) { setView("mer"); }
                    else { setFlashIdx(i => i + 1); setFlipped(false); }
                  }}
                  style={{
                    ...btnGhost,
                    border: flashIdx === qs.length - 1 ? `1px solid ${C.borderGoldStr}` : `1px solid ${C.border}`,
                    color: flashIdx === qs.length - 1 ? C.gold : C.muted,
                    fontWeight: flashIdx === qs.length - 1 ? "700" : "400",
                    justifyContent: "center", padding: "13px",
                    fontSize: flashIdx === qs.length - 1 ? "12px" : "18px",
                  }}
                >
                  {flashIdx === qs.length - 1 ? t("flash_done") : "→"}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════
            FRÅGOR
        ══════════════════════════════════════════════════════════════ */}
        {view === "fragor" && (() => {
          // ── Derived data ─────────────────────────────────────────────────
          const statusCounts = {
            "ej övad":   QUESTIONS.filter(q => getQuestionStatus(q) === "ej övad").length,
            "öva mer":   QUESTIONS.filter(q => getQuestionStatus(q) === "öva mer").length,
            "på väg":    QUESTIONS.filter(q => getQuestionStatus(q) === "på väg").length,
            "behärskad": mastered,
          };

          const categories = [
            { key: "fordon",       label: t("cat_fordon"),       icon: "🔧", qs: QUESTIONS.filter(q => q.delprov === 1 && !isNavigeringQuestion(q)) },
            { key: "trafikregler", label: t("cat_trafikregler"),  icon: "🚦", qs: QUESTIONS.filter(q => q.delprov === 2 && !isTaxiregelQuestion(q) && !isVilotidQuestion(q)) },
            { key: "taxiregler",   label: t("cat_taxiregler"),    icon: "📋", qs: QUESTIONS.filter(isTaxiregelQuestion) },
            { key: "vilotid",      label: t("cat_vilotid"),       icon: "⏱️", qs: QUESTIONS.filter(isVilotidQuestion) },
            { key: "navigering",   label: t("cat_navigering"),    icon: "🗺️", qs: QUESTIONS.filter(isNavigeringQuestion) },
            { key: "bilder",       label: t("cat_bilder"),        icon: "🖼️", qs: QUESTIONS.filter(q => q.image) },
          ].map(cat => {
            const masteredCount = cat.qs.filter(q => getQuestionStatus(q) === "behärskad").length;
            const triedCount    = cat.qs.filter(q => getQuestionStatus(q) !== "ej övad").length;
            return { ...cat, masteredCount, triedCount, pct: cat.qs.length > 0 ? Math.round(masteredCount / cat.qs.length * 100) : 0 };
          });

          // Category signals
          const triedCats    = categories.filter(c => c.triedCount > 0 && c.pct < 100);
          const weakestCat   = triedCats.length > 0 ? triedCats.reduce((min, c) => c.pct < min.pct ? c : min, triedCats[0]) : null;
          const nearMasteryCat = categories.find(c => c.pct >= 70 && c.pct < 100);

          // ── Browse pool ──────────────────────────────────────────────────
          const browseQs = (() => {
            if (!fragorFilter) return [];
            if (fragorFilter === "felaktiga")    return QUESTIONS.filter(q => { const s = stats[q.id] || { c: 0, w: 0 }; return s.w > 0 && s.c === 0; });
            if (fragorFilter === "sparade")      return QUESTIONS.filter(q => savedIds.includes(q.id));
            if (fragorFilter === "fordon")       return QUESTIONS.filter(q => q.delprov === 1 && !isNavigeringQuestion(q));
            if (fragorFilter === "trafikregler") return QUESTIONS.filter(q => q.delprov === 2 && !isTaxiregelQuestion(q) && !isVilotidQuestion(q));
            if (fragorFilter === "taxiregler")   return QUESTIONS.filter(isTaxiregelQuestion);
            if (fragorFilter === "vilotid")      return QUESTIONS.filter(isVilotidQuestion);
            if (fragorFilter === "navigering")   return QUESTIONS.filter(isNavigeringQuestion);
            if (fragorFilter === "bilder")       return QUESTIONS.filter(q => q.image);
            return QUESTIONS.filter(q => getQuestionStatus(q) === fragorFilter);
          })();

          const browseTitle = {
            "felaktiga":    t("browse_felaktiga"),
            "sparade":      t("browse_sparade"),
            "ej övad":      t("browse_ej_ovad"),
            "öva mer":      t("browse_ova_mer"),
            "på väg":       t("browse_pa_vag"),
            "behärskad":    t("browse_behärskad"),
            "fordon":       t("cat_fordon"),
            "trafikregler": t("cat_trafikregler"),
            "taxiregler":   t("cat_taxiregler"),
            "vilotid":      t("cat_vilotid"),
            "navigering":   t("cat_navigering"),
            "bilder":       t("cat_bilder"),
          }[fragorFilter] || "";

          const statusColor = (status) => ({ "behärskad": C.greenLight, "på väg": C.gold, "öva mer": C.redLight, "ej övad": C.faint }[status]);

          // State classification
          const isNewUser    = tot === 0;
          const isHighMastery = masterPct >= 90;
          const untriedCount = statusCounts["ej övad"];
          const imageCount   = QUESTIONS.filter(q => q.image).length;

          return (
            <div style={{ animation: "screenIn 0.28s ease both" }}>

              {fragorFilter ? (
                /* ══ BROWSE MODE ══════════════════════════════════════════ */
                <>
                  {/* Back bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <button
                      onClick={() => setFragorFilter(null)}
                      style={{
                        background: "none", border: "none", padding: "6px 0",
                        color: C.muted, cursor: "pointer", fontSize: "13px",
                        display: "flex", alignItems: "center", gap: "5px",
                        fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      {t("browse_back")}
                    </button>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: C.text }}>{browseTitle}</div>
                    <div style={{ marginLeft: "auto", fontSize: "11px", color: C.muted }}>{browseQs.length} st</div>
                  </div>

                  {browseQs.length === 0 ? (
                    <div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: "28px", marginBottom: "12px", opacity: 0.4 }}>
                        {fragorFilter === "sparade" ? "🔖" : "✓"}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: C.muted, marginBottom: "6px" }}>{t("fragor_saved_empty_title")}</div>
                      <div style={{ fontSize: "12px", color: C.textSoft, lineHeight: 1.65 }}>
                        {fragorFilter === "felaktiga"
                          ? t("browse_no_status")
                          : fragorFilter === "sparade"
                          ? t("browse_no_saved")
                          : t("browse_no_match")}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      {browseQs.map(q => {
                        const st = getQuestionStatus(q);
                        const sc = statusColor(st);
                        const saved = savedIds.includes(q.id);
                        return (
                          <button key={q.id} type="button"
                            className="stat-q-item"
                            onClick={() => { setStatsSelected(null); setStatsAnswered(false); setStatsQuestion(q); }}
                            style={{
                              display: "flex", alignItems: "center", gap: "10px",
                              padding: "11px 14px", ...card, borderRadius: "16px",
                              width: "100%", cursor: "pointer", textAlign: "left",
                              WebkitTapHighlightColor: "transparent",
                            }}
                          >
                            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: sc, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: "12px", color: C.textSoft, lineHeight: 1.45 }}>
                              {q.question.substring(0, 62)}…
                            </span>
                            {saved && <span style={{ fontSize: "10px", color: C.gold, flexShrink: 0 }}>🔖</span>}
                            <span style={{ fontSize: "10px", color: sc, whiteSpace: "nowrap", fontWeight: "600" }}>{tStatus(st)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* ══ HUB MODE ═════════════════════════════════════════════ */
                <>

                  {/* ── STATE-AWARE HEADER ───────────────────────────────── */}
                  <div className="fragor-s1" style={{ paddingBottom: "18px" }}>
                    <div style={{ fontSize: "34px", fontWeight: "800", color: C.text, letterSpacing: "-0.8px", lineHeight: 1.05, marginBottom: "5px" }}>
                      {isNewUser
                        ? t("fragor_title_new")
                        : isHighMastery
                        ? t("fragor_title_high")
                        : wrongCount > 0
                        ? t("fragor_title_wrong")
                        : t("fragor_title_normal")}
                    </div>
                    <div style={{ fontSize: "12px", color: C.textSoft, lineHeight: 1.55 }}>
                      {isNewUser
                        ? t("fragor_sub_new")
                        : isHighMastery
                        ? tf("fragor_sub_high", masterPct)
                        : wrongCount > 0
                        ? tf("fragor_sub_wrong", wrongCount)
                        : tf("fragor_sub_normal", mastered, QUESTIONS.length)}
                    </div>
                  </div>

                  {/* ── FOCUS AREA (state-aware) ──────────────────────────── */}
                  <div className="fragor-s2" style={{ marginBottom: "8px" }}>

                    {isNewUser ? (
                      /* New user: Quick Test first */
                      <>
                        <button className="pressable" onClick={() => startQuiz("quick")}
                          style={{ width: "100%", marginBottom: "6px", padding: "0", borderRadius: "16px",
                            overflow: "hidden", border: "none", background: goldGrad,
                            display: "block", cursor: "pointer", textAlign: "left",
                            WebkitTapHighlightColor: "transparent",
                            boxShadow: "0 4px 20px rgba(240,165,0,0.22), 0 1px 4px rgba(0,0,0,0.4)",
                            fontFamily: "inherit" }}>
                          <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ width: "40px", height: "40px", flexShrink: 0, borderRadius: "11px",
                              background: "rgba(0,0,0,0.16)", display: "flex", alignItems: "center",
                              justifyContent: "center", fontSize: "18px" }}>▶</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "16px", fontWeight: "800", color: "#09090E", letterSpacing: "-0.3px", lineHeight: 1, marginBottom: "3px" }}>{t("start_snabbprov")}</div>
                              <div style={{ fontSize: "11px", fontWeight: "600", color: "rgba(0,0,0,0.42)" }}>{t("prov_next_first_sub")}</div>
                            </div>
                            <div style={{ fontSize: "18px", color: "rgba(0,0,0,0.28)", flexShrink: 0 }}>→</div>
                          </div>
                        </button>
                        <div style={{ fontSize: "11px", color: C.muted, textAlign: "center", padding: "2px 0 4px" }}>
                          {t("fragor_new_hint")}
                        </div>
                      </>
                    ) : wrongCount > 0 ? (
                      /* Wrong answers: primary focus card — premium, not alarming */
                      <div style={{ ...card, padding: "16px 18px", marginBottom: "6px",
                        borderColor: "rgba(208,72,72,0.18)", background: C.surface }}>
                        <div style={{ marginBottom: "14px" }}>
                          <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: "8px" }}>
                            {t("fragor_wrong_section_title")}
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                            <span style={{ fontSize: "32px", fontWeight: "800", color: C.redLight, letterSpacing: "-1px", lineHeight: 1 }}>{wrongCount}</span>
                            <span style={{ fontSize: "13px", color: C.textSoft }}>{t("fragor_wrong_unit")}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="pressable-sm" onClick={() => setFragorFilter("felaktiga")}
                            style={{ flex: 1, padding: "9px 14px", borderRadius: "11px",
                              border: `1px solid ${C.border}`, background: "transparent",
                              color: C.muted, cursor: "pointer", fontSize: "12px", fontWeight: "600",
                              fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
                            {t("fragor_browse_btn")}
                          </button>
                          <button className="pressable-sm" onClick={() => startQuiz("focus")}
                            style={{ flex: 1, padding: "9px 14px", borderRadius: "11px",
                              border: "1px solid rgba(208,72,72,0.28)", background: "rgba(208,72,72,0.08)",
                              color: C.redLight, cursor: "pointer", fontSize: "12px", fontWeight: "700",
                              fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
                            {t("fragor_train_btn")}
                          </button>
                        </div>
                      </div>
                    ) : isHighMastery ? (
                      /* High mastery: maintenance card */
                      <div style={{ ...card, padding: "16px 18px", marginBottom: "6px",
                        borderColor: C.greenBorder, background: "rgba(44,184,122,0.04)" }}>
                        <div style={{ fontSize: "10px", fontWeight: "700", color: C.greenLight, letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: "8px" }}>{t("fragor_maintenance_title")}</div>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: C.text, marginBottom: "4px" }}>{tf("fragor_maintenance_msg", masterPct)}</div>
                        <div style={{ fontSize: "12px", color: C.textSoft, lineHeight: 1.6, marginBottom: "14px" }}>
                          {t("fragor_maintenance_sub")}
                        </div>
                        <button className="pressable-sm" onClick={() => setView("prov")}
                          style={{ padding: "9px 16px", borderRadius: "11px",
                            border: `1px solid ${C.greenBorder}`, background: "rgba(44,184,122,0.10)",
                            color: C.greenLight, cursor: "pointer", fontSize: "12px", fontWeight: "700",
                            fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
                          {t("fragor_maintenance_btn")}
                        </button>
                      </div>
                    ) : savedIds.length > 0 ? (
                      /* No wrongs + saved questions: surface saved as focus */
                      <button className="pressable-sm" onClick={() => setFragorFilter("sparade")}
                        style={{ ...card, padding: "13px 16px", width: "100%", marginBottom: "6px",
                          display: "flex", alignItems: "center", gap: "12px",
                          cursor: "pointer", textAlign: "left",
                          fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                          borderColor: C.borderGoldStr, background: C.goldBg }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                          background: "rgba(240,165,0,0.18)", border: `1px solid ${C.borderGold}`,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>🔖</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "2px" }}>{t("fragor_saved_title")}</div>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: C.text }}>{tf("fragor_saved_count", savedIds.length)}</div>
                        </div>
                        <span style={{ color: C.gold, fontSize: "16px" }}>›</span>
                      </button>
                    ) : weakestCat ? (
                      /* Spotlight: weakest tried category */
                      <button className="pressable-sm" onClick={() => setFragorFilter(weakestCat.key)}
                        style={{ ...card, padding: "13px 16px", width: "100%", marginBottom: "6px",
                          display: "flex", alignItems: "center", gap: "12px",
                          cursor: "pointer", textAlign: "left",
                          fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                          borderColor: "rgba(208,72,72,0.25)" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                          background: "rgba(208,72,72,0.10)", border: "1px solid rgba(208,72,72,0.22)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>
                          {weakestCat.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "10px", fontWeight: "700", color: C.redLight, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "2px" }}>{t("fragor_weakest_label")}</div>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: C.text }}>{weakestCat.label}</div>
                          <div style={{ fontSize: "10px", color: C.muted }}>{weakestCat.pct}% {t("mastery_suffix")}</div>
                        </div>
                        <span style={{ color: C.muted, fontSize: "16px" }}>›</span>
                      </button>
                    ) : null}

                    {/* Saved: compact secondary row, only when wrong-answers focus is primary */}
                    {wrongCount > 0 && savedIds.length > 0 && (
                      <button className="pressable-sm" onClick={() => setFragorFilter("sparade")}
                        style={{ ...card, padding: "10px 14px", width: "100%",
                          display: "flex", alignItems: "center", gap: "10px",
                          cursor: "pointer", textAlign: "left",
                          fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                          borderColor: C.borderGoldStr, background: C.goldBg }}>
                        <span style={{ fontSize: "13px" }}>🔖</span>
                        <span style={{ flex: 1, fontSize: "12px", fontWeight: "600", color: C.text }}>{t("fragor_saved_title")}</span>
                        <span style={{ fontSize: "10px", color: C.muted, fontFamily: "'DM Mono', monospace" }}>{tf("fragor_saved_count_short", savedIds.length)}</span>
                        <span style={{ color: C.gold, fontSize: "13px" }}>›</span>
                      </button>
                    )}

                    {/* Saved: empty hint only for new users — clearly inactive but readable */}
                    {isNewUser && (
                      <div style={{ ...card, padding: "11px 14px", marginTop: "6px",
                        display: "flex", alignItems: "center", gap: "10px",
                        borderColor: C.borderSoft, background: "rgba(255,255,255,0.01)" }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "9px", flexShrink: 0,
                          background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "13px", opacity: 0.55 }}>🔖</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "11px", fontWeight: "600", color: C.muted }}>{t("fragor_saved_empty_title")}</div>
                          <div style={{ fontSize: "10px", color: C.muted, opacity: 0.7, lineHeight: 1.4 }}>{t("fragor_saved_empty_hint")}</div>
                        </div>
                        <span style={{ fontSize: "10px", color: C.muted, opacity: 0.55, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>0 st</span>
                      </div>
                    )}
                  </div>

                  {/* ── QUICK ACCESS PILLS ────────────────────────────────── */}
                  <div className="fragor-s2b" style={{ marginBottom: "16px", paddingTop: "4px" }}>
                    <div className="fragor-pills"
                      style={{ display: "flex", gap: "6px", overflowX: "auto",
                        paddingBottom: "2px", WebkitOverflowScrolling: "touch" }}>
                      {[
                        { key: "felaktiga", label: t("fragor_pills_wrong"),   count: wrongCount,      color: C.redLight, border: "rgba(208,72,72,0.30)" },
                        { key: "sparade",   label: t("fragor_pills_saved"),   count: savedIds.length, color: C.gold,     border: C.borderGold },
                        { key: "ej övad",   label: t("fragor_pills_untried"), count: untriedCount,    color: C.textSoft, border: C.border },
                        { key: "bilder",    label: t("fragor_pills_images"),  count: imageCount,      color: C.textSoft, border: C.border },
                      ].map(({ key, label, count, color, border }) => {
                        const disabled = count === 0;
                        return (
                          <button key={key}
                            className={!disabled ? "pressable-sm" : ""}
                            onClick={() => !disabled && setFragorFilter(key)}
                            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "5px",
                              padding: "6px 11px", borderRadius: "99px",
                              border: `1px solid ${disabled ? C.border : border}`,
                              background: disabled ? "transparent" : `${color}12`,
                              cursor: disabled ? "default" : "pointer",
                              opacity: disabled ? 0.35 : 1,
                              fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
                            <span style={{ fontSize: "11px", fontWeight: "600", color: disabled ? C.muted : color, whiteSpace: "nowrap" }}>{label}</span>
                            <span style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", fontWeight: "700",
                              color: disabled ? C.muted : color,
                              background: `${color}18`, padding: "1px 5px", borderRadius: "99px", lineHeight: "1.5" }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── KUNSKAPSNIVÅ (redesigned as integrated card) ──────── */}
                  <div className="fragor-s3" style={{ marginBottom: "18px" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: C.textSoft, letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: "10px" }}>{t("fragor_knowledge_title")}</div>
                    <div style={{ ...card, padding: "14px 16px" }}>
                      {/* Stacked proportion bar */}
                      <div style={{ display: "flex", height: "5px", borderRadius: "3px", overflow: "hidden", marginBottom: "14px", gap: "1px" }}>
                        {[
                          { key: "behärskad", color: C.green },
                          { key: "på väg",    color: C.gold },
                          { key: "öva mer",   color: C.red },
                          { key: "ej övad",   color: "rgba(255,255,255,0.08)" },
                        ].map(({ key, color }) => {
                          const w = QUESTIONS.length > 0 ? (statusCounts[key] / QUESTIONS.length) * 100 : 0;
                          return w > 0
                            ? <div key={key} style={{ height: "100%", width: `${w}%`, background: color, transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)" }} />
                            : null;
                        })}
                      </div>
                      {/* Compact tappable rows */}
                      {[
                        { key: "behärskad", label: t("status_mastered"),      color: C.greenLight },
                        { key: "på väg",    label: t("status_progressing"),   color: C.gold },
                        { key: "öva mer",   label: t("status_practice_more"), color: C.redLight },
                        { key: "ej övad",   label: t("status_untried"),       color: "rgba(255,255,255,0.35)" },
                      ].map(({ key, label, color }, i, arr) => {
                        const count = statusCounts[key];
                        const pct   = QUESTIONS.length > 0 ? Math.round(count / QUESTIONS.length * 100) : 0;
                        const clickable = count > 0;
                        return (
                          <button key={key}
                            className={clickable ? "pressable-sm" : ""}
                            onClick={() => clickable && setFragorFilter(key)}
                            style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%",
                              padding: `${i === 0 ? "0" : "8px"} 0 ${i === arr.length - 1 ? "0" : "8px"}`,
                              borderTop: i > 0 ? `1px solid ${C.borderSoft}` : "none",
                              background: "none", border: "none",
                              cursor: clickable ? "pointer" : "default",
                              fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                              opacity: count === 0 ? 0.38 : 1, textAlign: "left" }}>
                            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                            <div style={{ flex: 1, fontSize: "12px", fontWeight: "600", color: C.text }}>{label}</div>
                            <div style={{ fontSize: "14px", fontWeight: "800", color, letterSpacing: "-0.4px", lineHeight: 1 }}>{count}</div>
                            <div style={{ fontSize: "10px", color: C.muted, width: "30px", textAlign: "right" }}>{pct}%</div>
                            {clickable && <div style={{ fontSize: "13px", color: C.muted, lineHeight: 1, marginLeft: "2px" }}>›</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── ÖVA EFTER ÄMNE (category list) ──────────────────── */}
                  <div className="fragor-s4">
                    <div style={{ fontSize: "10px", fontWeight: "700", color: C.textSoft, letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: "10px" }}>{t("fragor_category_title")}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      {categories.map(({ key, label, icon, qs, masteredCount, triedCount, pct }) => {
                        const barCol   = pct >= 80 ? C.greenLight : pct >= 50 ? C.gold : pct > 0 ? C.redLight : "rgba(255,255,255,0.12)";
                        const isWeakest = weakestCat && weakestCat.key === key && triedCount > 0;
                        const isNear    = nearMasteryCat && nearMasteryCat.key === key && !isWeakest;
                        return (
                          <button key={key}
                            className="pressable-sm"
                            onClick={() => setFragorFilter(key)}
                            style={{ ...card, width: "100%", padding: "0",
                              cursor: "pointer", textAlign: "left", overflow: "hidden",
                              fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                              borderColor: isWeakest ? "rgba(208,72,72,0.22)" : isNear ? C.borderGold : C.border }}>
                            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px" }}>
                              <div style={{ width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
                                background: pct > 0 ? `${barCol}14` : C.surfaceAlt,
                                border: `1px solid ${pct > 0 ? `${barCol}28` : C.border}`,
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>
                                {icon}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                                  <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                                  {isWeakest && (
                                    <span style={{ fontSize: "8px", fontWeight: "700", color: C.redLight,
                                      background: "rgba(208,72,72,0.12)", border: "1px solid rgba(208,72,72,0.22)",
                                      padding: "1px 5px", borderRadius: "4px", letterSpacing: "0.3px", flexShrink: 0 }}>{t("cat_weakest_badge")}</span>
                                  )}
                                  {isNear && (
                                    <span style={{ fontSize: "8px", fontWeight: "700", color: C.gold,
                                      background: C.goldBg, border: `1px solid ${C.borderGold}`,
                                      padding: "1px 5px", borderRadius: "4px", letterSpacing: "0.3px", flexShrink: 0 }}>{t("cat_near_badge")}</span>
                                  )}
                                </div>
                                <div style={{ fontSize: "10px", color: C.muted }}>{tf("cat_mastered_of", masteredCount, qs.length)}</div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: "14px", fontWeight: "800", color: pct > 0 ? barCol : C.muted, letterSpacing: "-0.3px", lineHeight: 1 }}>
                                  {pct}<span style={{ fontSize: "10px", fontWeight: "600" }}>%</span>
                                </div>
                                <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>›</div>
                              </div>
                            </div>
                            <div style={{ height: "2px", background: C.border }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: barCol,
                                transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </>
              )}

              {/* Practice popup — present in both hub and browse mode */}
              {statsQuestion && (
                <Popup onClose={() => setStatsQuestion(null)}>
                  <QuestionPopupBody
                    q={tq(statsQuestion)}
                    chosen={statsSelected}
                    revealed={statsAnswered}
                    onSelectOption={(i) => {
                      if (statsAnswered) return;
                      const ok  = i === statsQuestion.correct;
                      const cur = stats[statsQuestion.id] || { c: 0, w: 0 };
                      saveStat(statsQuestion.id, cur.c + (ok ? 1 : 0), cur.w + (ok ? 0 : 1));
                      setStatsSelected(i);
                      setStatsAnswered(true);
                    }}
                    onClose={() => setStatsQuestion(null)}
                    isSaved={savedIds.includes(statsQuestion.id)}
                    onToggleSave={toggleSave}
                  />
                </Popup>
              )}

            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════
            MER
        ══════════════════════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════
            CHECKLISTA
        ══════════════════════════════════════════════════════════════ */}
        {view === "checklista" && (
          <div style={{ animation: "screenIn 0.28s ease both" }}>

            {/* Top bar */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "20px",
            }}>
              <button onClick={() => setView("mer")} style={btnGhost}>{t("checklist_view_back")}</button>
              <div style={{
                fontSize: "12px", fontWeight: "600",
                background: checklistDone.size === checklistSteps.length && checklistSteps.length > 0
                  ? C.greenBg : C.goldBg,
                border: `1px solid ${checklistDone.size === checklistSteps.length && checklistSteps.length > 0
                  ? C.greenBorder : C.borderGold}`,
                borderRadius: "16px", padding: "5px 12px",
                color: checklistDone.size === checklistSteps.length && checklistSteps.length > 0
                  ? C.green : C.goldDark,
              }}>
                {checklistDone.size} / {checklistSteps.length}
              </div>
            </div>

            <Label color={C.gold}>{t("checklist_view_label")}</Label>
            <p style={{ fontSize: "13px", color: C.textSoft, lineHeight: "1.6", margin: "0 0 20px" }}>
              {t("checklist_view_intro")}
            </p>

            {/* Step list */}
            <div style={{ ...card, overflow: "hidden" }}>
              {checklistSteps.map(({ title, desc, app }, i, arr) => {
                const done = checklistDone.has(i);
                const last = i === arr.length - 1;
                return (
                  <button
                    key={i}
                    onClick={() => toggleChecklistStep(i)}
                    style={{
                      width: "100%", textAlign: "left", cursor: "pointer",
                      display: "flex", gap: "14px",
                      padding: "15px 18px",
                      border: "none",
                      borderBottom: last ? "none" : `1px solid ${C.border}`,
                      background: done ? C.greenBg : "transparent",
                      WebkitTapHighlightColor: "transparent",
                      transition: "background 0.18s",
                    }}
                  >
                    {/* Check indicator */}
                    <div
                      className={`checklist-check ${done ? "is-done" : "is-undone"}`}
                      style={{
                        width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                        marginTop: "1px",
                        background: done ? C.greenBg : C.surfaceAlt,
                        border: `1.5px solid ${done ? C.green : app ? C.borderGoldStr : C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "11px", fontWeight: "800",
                        color: done ? C.green : C.muted,
                      }}
                    >
                      {done ? "✓" : ""}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "7px",
                        marginBottom: "4px", flexWrap: "wrap",
                      }}>
                        <span style={{
                          fontSize: "13px", fontWeight: "700", lineHeight: 1.35,
                          color: done ? C.textSoft : app ? C.gold : C.text,
                          textDecoration: done ? "line-through" : "none",
                          textDecorationColor: C.muted,
                          transition: "color 0.18s",
                        }}>
                          {title}
                        </span>
                        {app && !done && (
                          <span style={{
                            fontSize: "9px", fontWeight: "700", letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            color: C.goldDark,
                            background: C.goldBg, border: `1px solid ${C.borderGold}`,
                            borderRadius: "4px", padding: "1px 5px",
                            flexShrink: 0, whiteSpace: "nowrap",
                          }}>
                            App
                          </span>
                        )}
                      </div>
                      <p style={{
                        fontSize: "12px", lineHeight: "1.65", margin: 0,
                        color: done ? C.muted : C.textSoft,
                        transition: "color 0.18s",
                      }}>
                        {desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* All done state */}
            {checklistDone.size === checklistSteps.length && checklistSteps.length > 0 && (
              <div style={{
                marginTop: "20px", padding: "18px 20px",
                background: C.greenBg, border: `1px solid ${C.greenBorder}`,
                borderRadius: "16px", textAlign: "center",
                animation: "popIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both",
              }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: C.green, marginBottom: "3px" }}>
                  {t("checklist_all_done")}
                </div>
                <div style={{ fontSize: "12px", color: C.green }}>
                  {t("checklist_good_luck")}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            INSTÄLLNINGAR
        ══════════════════════════════════════════════════════════════ */}
        {view === "installningar" && (
          <div style={{ animation: "screenIn 0.28s ease both" }}>

            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <button onClick={() => setView("mer")} style={btnGhost}>{t("settings_back")}</button>
            </div>

            {/* ── UTSEENDE ─────────────────────────────────────────────── */}
            <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{t("settings_appearance_lbl")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "24px" }}>
              {[
                {
                  id: "light",
                  label: t("settings_light"),
                  preview: { bg: "#F5F4EF", surface: "#FFFFFF", text: "#18171E", muted: "#9898A8", border: "rgba(0,0,0,0.08)" },
                },
                {
                  id: "dark",
                  label: t("settings_dark"),
                  preview: { bg: "#0D0D14", surface: "#141421", text: "#F2ECE4", muted: "#666880", border: "rgba(255,255,255,0.08)" },
                },
              ].map(({ id, label, preview }) => {
                const active = theme === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    className="pressable"
                    style={{
                      background: active ? C.goldBg : C.surface,
                      border: `1.5px solid ${active ? C.gold : C.border}`,
                      borderRadius: "16px",
                      padding: "12px",
                      cursor: "pointer",
                      textAlign: "left",
                      WebkitTapHighlightColor: "transparent",
                      transition: "border-color 0.18s, background 0.18s",
                    }}
                  >
                    {/* Mini preview thumbnail */}
                    <div style={{
                      background: preview.bg,
                      borderRadius: "10px",
                      padding: "8px",
                      marginBottom: "10px",
                      border: `1px solid ${preview.border}`,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        background: preview.surface,
                        borderRadius: "6px 6px 0 0",
                        height: "10px",
                        marginBottom: "5px",
                        display: "flex", alignItems: "center", paddingLeft: "5px", gap: "3px",
                      }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F0A500" }} />
                        <div style={{ width: "18px", height: "3px", borderRadius: "2px", background: preview.muted, opacity: 0.4 }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", paddingLeft: "2px" }}>
                        <div style={{ height: "3px", borderRadius: "2px", background: preview.text, opacity: 0.7, width: "60%" }} />
                        <div style={{ height: "3px", borderRadius: "2px", background: preview.muted, opacity: 0.4, width: "80%" }} />
                        <div style={{ height: "3px", borderRadius: "2px", background: preview.muted, opacity: 0.3, width: "50%" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: active ? C.gold : C.text }}>
                        {label}
                      </span>
                      {active && (
                        <span style={{
                          width: "16px", height: "16px", borderRadius: "50%",
                          background: C.gold,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3l2 2 4-4" stroke="#090909" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── SPRÅK ────────────────────────────────────────────────── */}
            <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{t("settings_language_lbl")}</div>
            <div style={{ ...card, overflow: "hidden", marginBottom: "24px" }}>
              {[
                {
                  id: "sv",
                  name: "Svenska",
                  flag: (
                    /* Swedish flag — official blue #006AA7, yellow #FECC02, Nordic cross */
                    <svg viewBox="0 0 16 10" style={{ width: "24px", height: "auto", display: "block", borderRadius: "2px", flexShrink: 0 }}>
                      <rect width="16" height="10" fill="#006AA7"/>
                      <rect x="0" y="4" width="16" height="2" fill="#FECC02"/>
                      <rect x="5" y="0" width="2" height="10" fill="#FECC02"/>
                    </svg>
                  ),
                },
                {
                  id: "en",
                  name: "English",
                  flag: (
                    /* Union Jack — #012169 blue, #C8102E red, white fimbriation */
                    <svg viewBox="0 0 60 30" style={{ width: "24px", height: "auto", display: "block", borderRadius: "2px", flexShrink: 0 }}>
                      <rect width="60" height="30" fill="#012169"/>
                      <path d="M0,0 L60,30 M60,0 L0,30" stroke="white" strokeWidth="6"/>
                      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4"/>
                      <rect x="24" y="0" width="12" height="30" fill="white"/>
                      <rect x="0" y="11" width="60" height="8" fill="white"/>
                      <rect x="26" y="0" width="8" height="30" fill="#C8102E"/>
                      <rect x="0" y="13" width="60" height="4" fill="#C8102E"/>
                    </svg>
                  ),
                },
              ].map(({ id, name, flag }, idx, arr) => {
                const active = lang === id;
                return (
                  <button
                    key={id}
                    onClick={() => setLang(id)}
                    className="pressable"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "13px 16px",
                      background: active ? C.goldBg : "transparent",
                      border: "none",
                      borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : "none",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      textAlign: "left",
                      transition: "background 0.18s",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Flag SVG */}
                    {flag}

                    {/* Language name */}
                    <span style={{
                      flex: 1,
                      fontSize: "14px",
                      fontWeight: "600",
                      color: active ? C.gold : C.text,
                      letterSpacing: "0.1px",
                      transition: "color 0.18s",
                    }}>
                      {name}
                    </span>

                    {/* Radio indicator */}
                    <div style={{
                      width: "18px", height: "18px",
                      borderRadius: "50%",
                      background: active ? C.gold : "transparent",
                      border: `1.5px solid ${active ? C.gold : C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      transition: "background 0.18s, border-color 0.18s",
                    }}>
                      {active && (
                        <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                          <path d="M1 3.5l2 2 4-4" stroke="#090909" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── AVISERINGAR ──────────────────────────────────────────── */}
            <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{t("settings_notifications_lbl")}</div>
            <div style={{ ...card, overflow: "hidden", marginBottom: "24px" }}>

              {/* Study reminders toggle */}
              <button
                onClick={() => setNotifSettings({ ...notifSettings, enabled: !notifSettings.enabled })}
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  padding: "13px 16px",
                  display: "flex", alignItems: "center", gap: "12px",
                  background: "none", border: "none",
                  WebkitTapHighlightColor: "transparent",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: C.text, lineHeight: 1.2 }}>
                    {t("settings_notif_enabled_title")}
                  </div>
                  <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>
                    {t("settings_notif_enabled_sub")}
                  </div>
                </div>
                <div style={{
                  width: "44px", height: "26px", borderRadius: "13px", flexShrink: 0,
                  background: notifSettings.enabled ? C.gold : C.surfaceAlt,
                  border: `1.5px solid ${notifSettings.enabled ? C.gold : C.border}`,
                  position: "relative",
                  transition: "background 0.2s, border-color 0.2s",
                  pointerEvents: "none",
                }}>
                  <div style={{
                    position: "absolute", top: "3px",
                    left: notifSettings.enabled ? "21px" : "3px",
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: notifSettings.enabled ? "#090909" : C.muted,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }} />
                </div>
              </button>

              {/* Timing selector — only when enabled */}
              {notifSettings.enabled && (
                <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: C.muted, marginBottom: "8px" }}>
                    {t("settings_notif_timing_lbl")}
                  </div>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    background: C.surfaceAlt, borderRadius: "10px", padding: "3px", gap: "3px",
                  }}>
                    {[
                      { key: "day",     label: t("settings_notif_timing_day") },
                      { key: "lunch",   label: t("settings_notif_timing_lunch") },
                      { key: "evening", label: t("settings_notif_timing_evening") },
                    ].map(({ key, label }) => {
                      const sel = notifSettings.timing === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setNotifSettings({ ...notifSettings, timing: key })}
                          style={{
                            background: sel ? C.gold : "transparent",
                            border: "none", borderRadius: "7px",
                            padding: "9px 4px", cursor: "pointer",
                            textAlign: "center",
                            WebkitTapHighlightColor: "transparent",
                            transition: "background 0.18s",
                          }}
                        >
                          <div style={{ fontSize: "13px", fontWeight: "700", color: sel ? "#090909" : C.text, letterSpacing: "0.1px" }}>
                            {label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── SVARSFEEDBACK ─────────────────────────────────────────── */}
            <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{t("settings_feedback_lbl")}</div>
            <div style={{ ...card, overflow: "hidden", marginBottom: "24px" }}>

              {/* Vibration toggle */}
              <button
                onClick={() => setNotifSettings({ ...notifSettings, vibration: !notifSettings.vibration })}
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  padding: "13px 16px",
                  display: "flex", alignItems: "center", gap: "12px",
                  background: "none", border: "none",
                  borderBottom: `1px solid ${C.border}`,
                  WebkitTapHighlightColor: "transparent",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: C.text, lineHeight: 1.2 }}>
                    {t("settings_vibration_title")}
                  </div>
                  <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>
                    {t("settings_vibration_sub")}
                  </div>
                </div>
                <div style={{
                  width: "44px", height: "26px", borderRadius: "13px", flexShrink: 0,
                  background: notifSettings.vibration ? C.gold : C.surfaceAlt,
                  border: `1.5px solid ${notifSettings.vibration ? C.gold : C.border}`,
                  position: "relative",
                  transition: "background 0.2s, border-color 0.2s",
                  pointerEvents: "none",
                }}>
                  <div style={{
                    position: "absolute", top: "3px",
                    left: notifSettings.vibration ? "21px" : "3px",
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: notifSettings.vibration ? "#090909" : C.muted,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }} />
                </div>
              </button>

              {/* Sound toggle */}
              <button
                onClick={() => setNotifSettings({ ...notifSettings, sound: !notifSettings.sound })}
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  padding: "13px 16px",
                  display: "flex", alignItems: "center", gap: "12px",
                  background: "none", border: "none",
                  WebkitTapHighlightColor: "transparent",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: C.text, lineHeight: 1.2 }}>
                    {t("settings_sound_title")}
                  </div>
                  <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>
                    {t("settings_sound_sub")}
                  </div>
                </div>
                <div style={{
                  width: "44px", height: "26px", borderRadius: "13px", flexShrink: 0,
                  background: notifSettings.sound ? C.gold : C.surfaceAlt,
                  border: `1.5px solid ${notifSettings.sound ? C.gold : C.border}`,
                  position: "relative",
                  transition: "background 0.2s, border-color 0.2s",
                  pointerEvents: "none",
                }}>
                  <div style={{
                    position: "absolute", top: "3px",
                    left: notifSettings.sound ? "21px" : "3px",
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: notifSettings.sound ? "#090909" : C.muted,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }} />
                </div>
              </button>
            </div>

            {/* ── DATA ─────────────────────────────────────────────────── */}
            <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{t("settings_data_lbl")}</div>
            <div style={{ ...card, overflow: "hidden" }}>
              {/* Reset data row */}
              <button
                onClick={() => setShowResetConfirm(true)}
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  padding: "13px 16px",
                  display: "flex", alignItems: "center", gap: "12px",
                  background: "none", border: "none",
                  WebkitTapHighlightColor: "transparent",
                  borderBottom: `1px solid ${C.borderSoft}`,
                }}
              >
                <span style={{
                  width: "34px", height: "34px", borderRadius: "12px", flexShrink: 0,
                  background: "rgba(184,80,88,0.08)", border: "1px solid rgba(184,80,88,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px",
                }}>🗑</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: C.redLight, marginBottom: "1px" }}>
                    {t("settings_reset_title")}
                  </div>
                  <div style={{ fontSize: "11px", color: C.muted }}>{t("settings_reset_sub")}</div>
                </div>
                <span style={{ color: C.muted, fontSize: "16px", lineHeight: 1 }}>›</span>
              </button>

              {/* Version row */}
              <div style={{
                padding: "10px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ fontSize: "12px", color: C.faint }}>{t("settings_version")}</div>
                <div style={{ fontSize: "11px", color: C.faint, fontFamily: "'DM Mono', monospace" }}>v{APP_VERSION}</div>
              </div>
            </div>

          </div>
        )}

        {view === "mer" && (
          <div style={{ animation: "screenIn 0.28s ease both" }}>

            {/* ══ STATISTIK ═══════════════════════════════════════════════ */}
            <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{t("mer_stats_title")}</div>

            {tot === 0 ? (
              /* No-data placeholder — compact and calm */
              <div style={{ ...card, padding: "13px 16px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
                  background: C.surfaceAlt, border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: "12px", height: "2px", background: C.faint, borderRadius: "2px" }} />
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: C.muted, lineHeight: 1, marginBottom: "3px" }}>{t("mer_no_activity")}</div>
                  <div style={{ fontSize: "11px", color: C.faint }}>{t("mer_no_activity_sub")}</div>
                </div>
              </div>
            ) : (
              /* Unified stats block — accuracy hero row + 3-column secondary */
              <div style={{ ...card, overflow: "hidden", marginBottom: "10px" }}>
                {/* Hero: Accuracy */}
                <div className="stat-card-1" style={{
                  padding: "14px 18px 12px",
                  borderBottom: `1px solid ${C.borderSoft}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "linear-gradient(135deg, rgba(201,168,76,0.05) 0%, transparent 100%)",
                }}>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "6px", opacity: 0.8 }}>
                      {t("mer_accuracy")}
                    </div>
                    <div style={{ fontSize: "40px", fontWeight: "500", color: C.gold, lineHeight: 1, letterSpacing: "-1.5px", fontFamily: "'DM Mono', monospace" }}>
                      {acc}<span style={{ fontSize: "18px", fontWeight: "400", letterSpacing: "-0.5px" }}>%</span>
                    </div>
                  </div>
                  <div style={{
                    width: "50px", height: "50px", borderRadius: "50%",
                    background: `conic-gradient(${C.gold} ${acc * 3.6}deg, ${C.border} 0deg)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: C.surface }} />
                  </div>
                </div>
                {/* Secondary: 3 stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                  {[
                    [tot,        t("mer_attempts"),    C.text,       "stat-card-2"],
                    [corr,       t("mer_correct"),     C.greenLight, "stat-card-3"],
                    [`${mastered}/${QUESTIONS.length}`, t("mer_mastered_lbl"), "#b8a0d0", "stat-card-4"],
                  ].map(([v, l, color, cn], i) => (
                    <div key={l} className={cn} style={{
                      padding: "10px 14px",
                      borderRight: i < 2 ? `1px solid ${C.borderSoft}` : "none",
                    }}>
                      <div style={{ fontSize: "18px", fontWeight: "800", color, lineHeight: 1, letterSpacing: "-0.5px" }}>{v}</div>
                      <div style={{ fontSize: "9px", color: C.muted, marginTop: "4px", fontWeight: "600", letterSpacing: "0.3px" }}>
                        {l}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mastery distribution */}
            <div style={{ ...card, padding: "12px 16px 10px", marginBottom: "20px" }}>
              <div style={{ fontSize: "9px", fontWeight: "700", color: C.muted, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "12px" }}>
                {t("mer_knowledge_dist")}
              </div>
              <MasteryBar questions={QUESTIONS} getStatus={getQuestionStatus} />
            </div>

            {/* ══ CHECKLISTA ══════════════════════════════════════════════ */}
            <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{t("mer_checklist_title")}</div>
            {(() => {
              const done  = checklistDone.size;
              const total = checklistSteps.length;
              const pct   = Math.round(done / total * 100);
              return (
                <button
                  className="pressable-sm"
                  onClick={() => setView("checklista")}
                  style={{
                    ...card, width: "100%", cursor: "pointer", textAlign: "left",
                    padding: "0", marginBottom: "24px", overflow: "hidden",
                    display: "block", border: `1px solid ${done === total && total > 0 ? C.greenBorder : C.border}`,
                    background: done === total && total > 0 ? "linear-gradient(135deg, rgba(79,168,112,0.05) 0%, transparent 100%)" : C.surface,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <div style={{ padding: "13px 16px 12px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{
                      width: "34px", height: "34px", borderRadius: "12px", flexShrink: 0,
                      background: done === total && total > 0 ? C.greenBg : C.surfaceAlt,
                      border: `1px solid ${done === total && total > 0 ? C.greenBorder : C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "18px",
                    }}>
                      {done === total && total > 0 ? "✓" : "☑"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>
                        {t("mer_checklist_name")}
                      </div>
                      <div style={{ fontSize: "11px", color: C.muted }}>
                        {done === 0
                          ? t("mer_checklist_start")
                          : done === total
                          ? t("checklist_all_done")
                          : tf("mer_checklist_in_progress", done, total)}
                      </div>
                    </div>
                    <span style={{ color: C.muted, fontSize: "16px", lineHeight: 1, flexShrink: 0 }}>›</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: "3px", background: C.borderSoft }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: done === total && total > 0 ? C.green : goldGrad,
                      transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
                      minWidth: done > 0 ? "3px" : "0",
                    }} />
                  </div>
                </button>
              );
            })()}

            {/* ══ VERKTYG ════════════════════════════════════════════════ */}
            <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{t("mer_tools_title")}</div>
            <div style={{ ...card, overflow: "hidden", marginBottom: "24px" }}>
              <button
                id="ob-flashcards"
                className="pressable-sm"
                onClick={openFlashcards}
                style={{
                  width: "100%", cursor: "pointer", textAlign: "left",
                  padding: "13px 16px",
                  display: "flex", alignItems: "center", gap: "12px",
                  background: "none", border: "none",
                  borderBottom: `1px solid ${C.borderSoft}`,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{
                  width: "34px", height: "34px", borderRadius: "12px", flexShrink: 0,
                  background: C.surfaceAlt, border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px",
                }}>🃏</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "1px" }}>
                    {t("mer_flashcards_title")}
                  </div>
                  <div style={{ fontSize: "11px", color: C.muted }}>{t("mer_flashcards_sub")}</div>
                </div>
                <span style={{ color: C.muted, fontSize: "16px", lineHeight: 1 }}>›</span>
              </button>

              {/* Inställningar entry */}
              <button
                className="pressable-sm"
                onClick={() => setView("installningar")}
                style={{
                  width: "100%", cursor: "pointer", textAlign: "left",
                  padding: "13px 16px",
                  display: "flex", alignItems: "center", gap: "12px",
                  background: "none", border: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{
                  width: "34px", height: "34px", borderRadius: "12px", flexShrink: 0,
                  background: C.surfaceAlt, border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px",
                }}>⚙️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "1px" }}>
                    {t("mer_settings_title")}
                  </div>
                  <div style={{ fontSize: "11px", color: C.muted }}>{t("mer_settings_sub")}</div>
                </div>
                <span style={{ color: C.muted, fontSize: "16px", lineHeight: 1 }}>›</span>
              </button>
            </div>

          </div>
        )}
      </main>

      {/* ── ONBOARDING TOUR ─────────────────────────────────────────────── */}
      {showOnboarding && view === "home" && (
        <OnboardingTour
          onComplete={handleOnboardingDone}
          onSkip={handleOnboardingDone}
        />
      )}

      {/* ── BOTTOM NAV (mobile only) ─────────────────────────────────────── */}
      {showBottomNav && (
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            {[["prov","prov","nav_prov"],["fragor","fragor","nav_fragor"],["home","home","nav_home"],["utmaningar","utmaningar","nav_utmaningar"],["mer","mer","nav_mer"]].map(([v, ico, labelKey]) => (
              <button key={v}
                id={v !== "home" ? `ob-nav-${v}` : undefined}
                className={`bottom-nav-btn${(view === v || (v === "mer" && view === "installningar")) ? " active" : ""}`}
                onClick={() => setView(v)}
                style={{ color: (view === v || (v === "mer" && view === "installningar")) ? C.gold : C.muted }}
              >
                <span className="bottom-nav-icon"><NavIcon name={ico} active={view === v} /></span>
                <span className="bottom-nav-label">
                  {t(labelKey)}
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* ── RESET CONFIRM DIALOG ─────────────────────────────────────────── */}
      {showResetConfirm && createPortal(
        <div
          onClick={() => setShowResetConfirm(false)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: "24px 24px max(24px, env(safe-area-inset-bottom, 0px))",
            animation: "fadeIn 0.16s ease both",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "24px",
              padding: "28px 24px 24px",
              width: "100%", maxWidth: "360px",
              boxShadow: "0 8px 48px rgba(0,0,0,0.40)",
              animation: "popIn 0.24s cubic-bezier(0.34,1.2,0.64,1) both",
            }}
          >
            <div style={{
              width: "48px", height: "48px", borderRadius: "16px",
              background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "18px", fontSize: "22px",
            }}>
              ⚠️
            </div>
            <div style={{ fontSize: "17px", fontWeight: "800", color: C.text, marginBottom: "10px", letterSpacing: "-0.2px" }}>
              {t("reset_title")}
            </div>
            <div style={{ fontSize: "13px", color: C.textSoft, lineHeight: 1.6, marginBottom: "26px" }}>
              {t("reset_body")}
              <br /><br />
              <span style={{ color: C.muted, fontWeight: "600" }}>{t("reset_irreversible")}</span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  flex: 1, padding: "13px", borderRadius: "16px",
                  border: `1px solid ${C.border}`, background: "transparent",
                  color: C.muted, cursor: "pointer", fontSize: "13px", fontWeight: "600",
                  fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                }}
              >
                {t("reset_cancel")}
              </button>
              <button
                onClick={resetAllProgress}
                style={{
                  flex: 1, padding: "13px", borderRadius: "16px",
                  border: "1px solid rgba(200,60,60,0.5)",
                  background: "rgba(200,60,60,0.14)",
                  color: "#e05050",
                  cursor: "pointer",
                  fontSize: "13px", fontWeight: "700",
                  fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                  transition: "background 0.15s",
                }}
              >
                {t("reset_confirm")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── DEV PANEL (development only) ─────────────────────────────────── */}
      {import.meta.env.DEV && (
        <DevPanel
          questions={QUESTIONS}
          installId={INSTALL_ID}
          stats={stats}                   setStats={setStats}
          savedIds={savedIds}             setSavedIds={setSavedIds}
          quizHistory={quizHistory}       setQuizHistory={setQuizHistory}
          dailyData={dailyData}           setDailyData={setDailyData}
          rirBest={rirBest}               setRirBest={setRirBest}
          checklistDone={checklistDone}   setChecklistDone={setChecklistDone}
          showOnboarding={showOnboarding} setShowOnboarding={setShowOnboarding}
          checklistSteps={checklistSteps}
          saveAllStats={saveAllStats}
          lang={lang}
          notifSettings={notifSettings}   setNotifSettings={setNotifSettings}
        />
      )}

    </div>
    </ThemeContext.Provider>
  );
}
