import { useState, useEffect, useRef } from "react";
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

// ─── Version (injected from package.json via vite.config.js) ─────────────────
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.0";

// ─── Data ─────────────────────────────────────────────────────────────────────
const QUESTIONS = importedQuestions;

const DELPROV_CONFIG = {
  1: { name: "Delprov 1", sub: "Säkerhet & beteende", total: 70, countedQ: 65, passMark: 48, time: 50 },
  2: { name: "Delprov 2", sub: "Lagstiftning",        total: 50, countedQ: 46, passMark: 34, time: 50 },
};

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

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  // Surfaces
  bg:            "#09090b",
  surface:       "#131316",
  surfaceAlt:    "#1c1c21",
  surface3:      "#222228",

  // Borders
  border:        "#26262b",
  borderSoft:    "#1e1e23",
  borderGold:    "rgba(201,168,76,0.22)",
  borderGoldStr: "rgba(201,168,76,0.44)",

  // Text
  text:          "#f1ece3",
  textSoft:      "#a8a090",
  muted:         "#65605a",
  faint:         "#343030",

  // Gold (brand — use sparingly)
  gold:          "#c9a84c",
  goldLight:     "#dbbe6a",
  goldDark:      "#9a7a28",
  goldBg:        "rgba(201,168,76,0.08)",
  goldBgHover:   "rgba(201,168,76,0.14)",

  // Correct
  green:         "#4fa870",
  greenLight:    "#6ec892",
  greenBg:       "rgba(79,168,112,0.10)",
  greenBorder:   "rgba(79,168,112,0.30)",

  // Wrong
  red:           "#b85058",
  redLight:      "#d07078",
  redBg:         "rgba(184,80,88,0.10)",
  redBorder:     "rgba(184,80,88,0.30)",
};

const goldGrad = `linear-gradient(135deg, ${C.goldLight} 0%, ${C.gold} 52%, ${C.goldDark} 100%)`;

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
function optionStyles(i, correctIdx, chosenIdx, revealed) {
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
    badgeBg: "rgba(255,255,255,0.03)", badgeCol: C.muted, badgeBrd: C.border,
    indicator: null,
  };
}

// ─── Image lightbox ───────────────────────────────────────────────────────────

function ImageModal({ src, onClose }) {
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
          borderRadius: "14px",
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
            borderRadius: "14px",
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
          background: "rgba(0,0,0,0.55)", borderRadius: "20px",
          padding: "6px 16px", fontSize: "11px", color: "rgba(255,255,255,0.45)",
          pointerEvents: "none", whiteSpace: "nowrap", letterSpacing: "0.3px",
        }}>
          Dubbeltryck · nyp · scrolla för att zooma
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
      src={import.meta.env.BASE_URL + "icon-180.png"}
      alt="Taxi Teori"
      style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.22),
        display: "block", flexShrink: 0, objectFit: "cover",
      }}
    />
  );
}

/** Small all-caps section label */
function Label({ children, color }) {
  return (
    <div style={{
      fontSize: "10px", fontWeight: "700", letterSpacing: "2px",
      textTransform: "uppercase", color: color || C.muted,
      marginBottom: "10px",
    }}>
      {children}
    </div>
  );
}

/** Filled progress bar */
function ProgressBar({ value, total }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ height: "2px", background: C.border, borderRadius: "2px", marginBottom: "24px", overflow: "hidden" }}>
      <div style={{
        height: "100%", background: goldGrad, borderRadius: "2px",
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
      fontSize: "11px", fontWeight: "800", flexShrink: 0, color,
      transition: "all 0.18s",
    }}>
      {letter}
    </span>
  );
}

/** Explanation block shown after answering */
function ExplanationBox({ text }) {
  if (!text) return null;
  return (
    <div style={{
      padding: "16px 18px",
      background: "rgba(201,168,76,0.05)",
      borderRadius: "13px",
      border: `1px solid rgba(201,168,76,0.16)`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px",
      }}>
        <div style={{
          width: "22px", height: "22px", borderRadius: "7px",
          background: "rgba(201,168,76,0.14)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "11px", flexShrink: 0,
        }}>
          📖
        </div>
        <span style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "2px", color: C.gold, textTransform: "uppercase" }}>
          Förklaring
        </span>
      </div>
      <p style={{ color: C.textSoft, fontSize: "14px", lineHeight: "1.76", margin: 0 }}>
        {text}
      </p>
    </div>
  );
}

/** Bottom-sheet overlay used for both result popup and stats popup */
function Popup({ onClose, children }) {
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
          background: "#131313",
          borderRadius: "22px 22px 0 0",
          border: `1px solid ${C.borderGold}`,
          borderBottom: "none",
          padding: "16px 20px 44px",
          width: "100%", maxWidth: "580px",
          animation: "slideUp 0.26s cubic-bezier(0.34,1.2,0.64,1) both",
          maxHeight: "88dvh", overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div
          style={{ width: "32px", height: "3px", background: C.border, borderRadius: "2px", margin: "0 auto 22px", cursor: "pointer" }}
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
  const isViewOnly = !onSelectOption;
  const showAnswers = revealed || isViewOnly;

  return (
    <>
      <ZoomableImage
        src={q.image}
        style={{ width: "100%", borderRadius: "12px", marginBottom: "16px", border: `1px solid ${C.border}` }}
      />

      <p style={{
        fontSize: "16px", fontWeight: "600", color: C.text,
        lineHeight: "1.68", marginBottom: "18px", textAlign: "left",
      }}>
        {q.question}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
        {q.options.map((opt, i) => {
          const s = optionStyles(i, q.correct, chosen, showAnswers);
          return (
            <button key={i}
              onClick={() => !showAnswers && onSelectOption && onSelectOption(i)}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 14px",
                background: s.bg, border: `1px solid ${s.brd}`, borderRadius: "11px",
                color: s.col, fontSize: "14px", textAlign: "left",
                cursor: showAnswers ? "default" : "pointer",
                transition: "all 0.18s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <OptionBadge letter={["A","B","C","D"][i]} bg={s.badgeBg} border={s.badgeBrd} color={s.badgeCol} />
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
            {isSaved ? "🔖 Sparad" : "🔖"}
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            ...btnGold, flex: 1, padding: "14px", fontSize: "14px",
            boxShadow: "0 4px 20px rgba(201,168,76,0.14)",
          }}
        >
          Stäng
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
  if (!questions.length) return null;

  const counts = { "ej övad": 0, "öva mer": 0, "på väg": 0, "behärskad": 0 };
  questions.forEach(q => counts[getStatus(q)]++);

  const total       = questions.length;
  const masteredPct = Math.round(counts["behärskad"] / total * 100);
  const headlineCol = masteredPct >= 70 ? C.greenLight : masteredPct >= 35 ? C.gold : C.textSoft;

  const segments = [
    { key: "behärskad", color: C.green,   barColor: C.green,   label: "Behärskad" },
    { key: "på väg",    color: C.gold,    barColor: C.gold,    label: "På väg"    },
    { key: "öva mer",   color: C.red,     barColor: C.red,     label: "Öva mer"   },
    { key: "ej övad",   color: C.muted,   barColor: "#2c2c2c", label: "Ej övad"   },
  ];

  return (
    <div>
      {/* ── Headline ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        marginBottom: "18px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "46px", fontWeight: "800", color: headlineCol, lineHeight: 1, letterSpacing: "-1px" }}>
            {masteredPct}%
          </span>
          <span style={{ fontSize: "12px", color: C.muted, fontWeight: "500", paddingBottom: "5px" }}>
            behärskat
          </span>
        </div>
        <div style={{ textAlign: "right", paddingBottom: "4px" }}>
          <div style={{ fontSize: "20px", fontWeight: "800", color: C.text, lineHeight: 1 }}>
            {counts["behärskad"]}
            <span style={{ fontSize: "12px", fontWeight: "500", color: C.muted }}> / {total}</span>
          </div>
          <div style={{ fontSize: "9px", color: C.faint, marginTop: "4px", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: "600" }}>
            Behärskade
          </div>
        </div>
      </div>

      {/* ── Stacked bar ──────────────────────────────────────── */}
      <div style={{
        display: "flex", height: "8px", borderRadius: "6px",
        overflow: "hidden", gap: "2px", background: "#161616",
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
                width: "72px", height: "3px", borderRadius: "2px",
                background: "#1e1e1e", flexShrink: 0, overflow: "hidden",
              }}>
                {active && (
                  <div style={{
                    height: "100%", borderRadius: "2px",
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
              {passMark} rätt
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

// ─── Shared style presets ─────────────────────────────────────────────────────
const card    = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: "16px" };
const btnGold = {
  background: goldGrad, border: "none", borderRadius: "12px",
  fontWeight: "700", color: "#080808", cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  gap: "8px", letterSpacing: "0.2px", WebkitTapHighlightColor: "transparent",
};
const btnGhost = {
  background: "transparent", border: `1px solid ${C.border}`,
  color: C.muted, padding: "8px 16px", borderRadius: "9px",
  cursor: "pointer", fontSize: "13px", fontWeight: "500",
  display: "inline-flex", alignItems: "center", gap: "6px",
  WebkitTapHighlightColor: "transparent",
  transition: "border-color 0.15s, color 0.15s, transform 0.11s, opacity 0.11s",
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
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

  // ── Reset all progress ────────────────────────────────────────────────────
  const resetAllProgress = () => {
    clearLocalStats();
    setStats(Object.fromEntries(QUESTIONS.map(q => [q.id, { c: 0, w: 0 }])));
    setQuizHistory([]);
    try { localStorage.removeItem(`taxi-teori-history-${INSTALL_ID}`); } catch {}
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
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } catch (e) {}
  };

  const playBuzz = () => {
    try {
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
      if (navigator.vibrate) navigator.vibrate([180]);
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
    return QUESTIONS.filter(q => q.delprov === m);
  };

  const startQuiz = (m) => {
    clearTimeout(timer.current);
    if (QUESTIONS.length === 0) return;
    const baseMode = (m === 10 || m === 20 || m === 30) ? "all" : m;
    let qs = [...getQs(baseMode)].sort(() => Math.random() - 0.5);
    if (qs.length === 0) return;
    if (m === "quick" || m === "focus") qs = qs.slice(0, 15);
    if (m === 1)       qs = qs.slice(0, 70);
    if (m === 2)       qs = qs.slice(0, 50);
    if (m === "rir")   qs = qs.slice(0, 200);
    if (m === 10 || m === 20 || m === 30) qs = qs.slice(0, m);
    const t = (m === 1 || m === 2) ? DELPROV_CONFIG[m].time * 60 : null;
    setMode(m);
    setQuiz({ questions: qs, current: 0, answers: [], answered: null });
    setTimeLeft(t);
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
    if (mode === "rir") {
      const newBest = Math.max(rirBest, score);
      setRirBest(newBest);
      try { localStorage.setItem(`taxi-teori-rir-${INSTALL_ID}`, String(newBest)); } catch {}
    }
    setResult({ score, total, answers, mode, expired: timeLeft === 0 });
    setView("result");
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const tot      = Object.values(stats).reduce((a, b) => a + b.c + b.w, 0);
  const corr     = Object.values(stats).reduce((a, b) => a + b.c, 0);
  const acc      = tot > 0 ? Math.round(corr / tot * 100) : 0;
  const mastered = Object.values(stats).filter(s => s.c >= 2 && s.c > s.w).length;

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
  const overallStatus = masterPct >= 80 ? "Redo för prov" : masterPct >= 50 ? "Nästan redo" : masterPct >= 20 ? "På väg" : "Kom igång";
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
        <Logo size={68} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: "800", color: C.text, letterSpacing: "1px", marginBottom: "4px" }}>
            TAXI TEORI
          </div>
          <div style={{ fontSize: "10px", fontWeight: "600", color: C.muted, letterSpacing: "3px", textTransform: "uppercase" }}>
            Studieapp
          </div>
        </div>
        <div style={{ width: "48px", height: "2px", background: C.border, borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ height: "100%", background: goldGrad, borderRadius: "2px", animation: "loadBar 1.5s ease-in-out infinite" }} />
        </div>
      </div>
    );
  }

  const showBottomNav = view !== "quiz";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header style={{
        height: "56px",
        background: "rgba(9,9,11,0.97)",
        backdropFilter: "blur(32px) saturate(180%)",
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
        borderBottom: `1px solid ${C.border}`,
        padding: "0 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        {/* Centered gold fade rule at very top */}
        <div style={{
          position: "absolute", top: 0, left: "15%", right: "15%", height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5) 35%, rgba(201,168,76,0.5) 65%, transparent)",
          pointerEvents: "none",
        }} />

        {/* Brand mark — logo · rule · wordmark */}
        <button
          onClick={() => setView("home")}
          style={{
            display: "flex", alignItems: "center",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <Logo size={30} />
          <div style={{
            width: "1px", height: "20px",
            background: "rgba(201,168,76,0.38)",
            margin: "0 13px", flexShrink: 0,
          }} />
          <span style={{
            fontSize: "15px", fontWeight: "900",
            color: C.text, letterSpacing: "3px",
            textTransform: "uppercase", lineHeight: 1,
          }}>
            Taxi Teori
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="header-nav">
          {[["home","Hem"],["prov","Prov"],["utmaningar","Utmaningar"],["fragor","Frågor"],["mer","Mer"]].map(([v, label]) => (
            <button key={v}
              id={v !== "home" ? `ob-nav-${v}-desktop` : undefined}
              onClick={() => setView(v)}
              style={{
                padding: "7px 13px",
                border: "none", borderRadius: "8px",
                cursor: "pointer", fontSize: "12px", fontWeight: "600",
                background: "transparent",
                color: view === v ? C.text : C.muted,
                position: "relative",
                transition: "color 0.14s", WebkitTapHighlightColor: "transparent",
              }}
            >
              {label}
              {view === v && (
                <div style={{
                  position: "absolute", bottom: "2px", left: "50%",
                  transform: "translateX(-50%)",
                  width: "16px", height: "1.5px",
                  background: C.gold, borderRadius: "1px",
                }} />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <main className={`main-content${showBottomNav ? " has-bottom-nav" : ""}`}>

        {/* ══════════════════════════════════════════════════════════════
            HEM
        ══════════════════════════════════════════════════════════════ */}
        {view === "home" && (
          <div style={{ animation: "screenIn 0.28s ease both" }}>

            {/* ══ 1. WELCOME / INTRO ══════════════════════════════════════ */}
            <div className="home-card-1" style={{ position: "relative", padding: "8px 0 30px" }}>
              <div style={{
                position: "absolute", top: "-24px", right: "-18px",
                width: "240px", height: "200px",
                background: "radial-gradient(ellipse at top right, rgba(201,168,76,0.07) 0%, transparent 68%)",
                pointerEvents: "none",
              }} />
              {tot === 0 ? (
                <>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px", opacity: 0.85 }}>
                    Välkommen
                  </div>
                  <h1 style={{ fontSize: "33px", fontWeight: "800", color: C.text, letterSpacing: "-1.3px", lineHeight: 1.1, margin: "0 0 18px", padding: 0 }}>
                    Dags att börja plugga.
                  </h1>
                  <p style={{ fontSize: "13px", color: C.muted, lineHeight: 1.72, margin: 0, maxWidth: "280px" }}>
                    Öva inför taxiförarlegitimationen med riktiga teorifrågor.
                  </p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px", opacity: 0.85 }}>
                    Välkommen tillbaka
                  </div>
                  <h1 style={{ fontSize: "33px", fontWeight: "800", color: C.text, letterSpacing: "-1.3px", lineHeight: 1.1, margin: "0 0 22px", padding: 0 }}>
                    {wrongCount > 0 ? "Fortsätt träna." : masterPct >= 80 ? "Du är nästan redo." : "Bra jobbat — framåt."}
                  </h1>
                  {/* Mastery progress track */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "9px" }}>
                      <span style={{ fontSize: "12px", color: C.muted }}>
                        {mastered} av {QUESTIONS.length} frågor behärskade
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: "800", color: masterPct >= 80 ? C.greenLight : C.text, letterSpacing: "-0.3px" }}>
                        {masterPct}%
                      </span>
                    </div>
                    <div style={{ position: "relative", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                      <div className="mastery-bar-fill" style={{
                        position: "absolute", top: 0, left: 0, bottom: 0,
                        width: `${masterPct}%`, borderRadius: "3px",
                        background: masterPct >= 80
                          ? `linear-gradient(90deg, ${C.green}, ${C.greenLight})`
                          : `linear-gradient(90deg, #7a5c18, ${C.gold})`,
                      }} />
                    </div>
                    <div style={{ position: "relative", height: "16px" }}>
                      <div style={{ position: "absolute", left: "70%", top: 0, width: "1px", height: "5px", background: C.gold, opacity: 0.4 }} />
                      <div style={{ position: "absolute", left: "70%", top: "7px", transform: "translateX(-50%)", fontSize: "8px", color: C.gold, opacity: 0.5, whiteSpace: "nowrap" }}>provgräns</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ══ 1b. DAGENS FRÅGA — free-standing circular daily ritual ══ */}
            <button
              onClick={() => setView("utmaningar")}
              className="home-card-1b pressable"
              style={{
                width: "100%",
                marginBottom: "10px",
                padding: "10px 16px 14px",
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                WebkitTapHighlightColor: "transparent",
                fontFamily: "inherit",
              }}
            >
              {/* Circle — the entire visual identity of this feature */}
              <div style={{
                width: "88px",
                height: "88px",
                borderRadius: "50%",
                border: dailyData.streak > 0
                  ? `2px solid rgba(201,168,76,0.60)`
                  : dailyData.answered
                  ? `2px solid rgba(79,168,112,0.45)`
                  : `2px solid rgba(201,168,76,0.25)`,
                background: dailyData.streak > 0
                  ? "radial-gradient(circle at 38% 36%, rgba(201,168,76,0.18) 0%, rgba(201,168,76,0.07) 100%)"
                  : dailyData.answered
                  ? "radial-gradient(circle at 38% 36%, rgba(79,168,112,0.13) 0%, rgba(79,168,112,0.04) 100%)"
                  : "radial-gradient(circle at 38% 36%, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.02) 100%)",
                boxShadow: dailyData.streak > 0
                  ? "0 0 0 7px rgba(201,168,76,0.07), 0 0 0 14px rgba(201,168,76,0.03)"
                  : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
                marginBottom: "12px",
                flexShrink: 0,
              }}>
                <div style={{
                  fontSize: "30px",
                  fontWeight: "800",
                  lineHeight: 1,
                  letterSpacing: "-1px",
                  color: dailyData.streak > 0
                    ? C.gold
                    : dailyData.answered
                    ? C.green
                    : C.muted,
                }}>
                  {dailyData.answered && dailyData.streak === 0 ? "✓" : dailyData.streak}
                </div>
                <div style={{
                  fontSize: "8px",
                  fontWeight: "700",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: dailyData.streak > 0
                    ? C.goldDark
                    : dailyData.answered
                    ? C.green
                    : C.faint,
                }}>
                  {dailyData.answered && dailyData.streak === 0 ? "klar" : "streak"}
                </div>
              </div>

              {/* Text below the circle */}
              <div style={{ fontSize: "13px", fontWeight: "800", color: C.text, letterSpacing: "-0.2px", marginBottom: "3px" }}>
                Dagens fråga
              </div>
              <div style={{ fontSize: "11px", color: C.muted, letterSpacing: "0.1px", lineHeight: 1.4 }}>
                {dailyData.answered ? "Kom tillbaka imorgon" : "Ny fråga idag · håll din streak vid liv"}
              </div>
            </button>

            {/* ══ 2. SNABBPROV — always the primary CTA ══════════════════ */}
            <button
              id="ob-snabbprov"
              className="home-card-2 pressable"
              onClick={() => startQuiz("quick")}
              style={{
                width: "100%", marginBottom: "10px",
                padding: "0",
                borderRadius: "18px", overflow: "hidden",
                border: `1px solid rgba(201,168,76,0.38)`,
                background: "linear-gradient(135deg, rgba(201,168,76,0.09) 0%, rgba(201,168,76,0.03) 100%)",
                display: "block", cursor: "pointer", textAlign: "left",
                boxShadow: "0 2px 28px rgba(201,168,76,0.07)",
                WebkitTapHighlightColor: "transparent",
                position: "relative",
                fontFamily: "inherit",
              }}
            >
              {/* Shimmer accent at top */}
              <div style={{
                position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
                background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)",
                pointerEvents: "none",
              }} />
              <div style={{ padding: "20px 20px 18px", display: "flex", alignItems: "center", gap: "16px" }}>
                {/* Icon */}
                <div style={{
                  width: "50px", height: "50px", borderRadius: "14px", flexShrink: 0,
                  background: "rgba(201,168,76,0.1)", border: `1px solid rgba(201,168,76,0.2)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "24px",
                }}>⚡</div>
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "8px", fontWeight: "700", color: C.gold, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "5px", opacity: 0.85 }}>
                    {tot === 0 ? "Kom igång" : "Daglig träning"}
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: C.text, letterSpacing: "-0.7px", lineHeight: 1, marginBottom: "6px" }}>
                    Snabbprov
                  </div>
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                    {["15 frågor", "~5 min", "Slumpvis urval"].map(lbl => (
                      <div key={lbl} style={{
                        fontSize: "9px", fontWeight: "600", color: C.textSoft,
                        background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                        padding: "3px 8px", borderRadius: "5px",
                      }}>{lbl}</div>
                    ))}
                  </div>
                </div>
                {/* Arrow */}
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                  background: "rgba(201,168,76,0.1)", border: `1px solid rgba(201,168,76,0.25)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.gold, fontSize: "17px",
                }}>›</div>
              </div>
            </button>

            {/* ══ 3. FOKUSTRÄNING — always present, three states ══════════ */}
            {wrongCount > 0 ? (
              /* Active — has wrong questions to train */
              <button
                id="ob-fokustranin"
                className="home-card-3 pressable"
                onClick={() => startQuiz("focus")}
                style={{
                  width: "100%", marginBottom: "10px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "1px solid rgba(208,112,120,0.22)",
                  background: "rgba(208,112,120,0.04)",
                  display: "flex", alignItems: "center", gap: "11px",
                  cursor: "pointer", textAlign: "left",
                  WebkitTapHighlightColor: "transparent",
                  fontFamily: "inherit",
                }}
              >
                <div style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: C.red, flexShrink: 0,
                  boxShadow: "0 0 5px rgba(184,80,88,0.55)",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: C.text }}>Fokusträning</span>
                  <span style={{ fontSize: "12px", color: C.muted, marginLeft: "8px" }}>{wrongCount} frågor kvar</span>
                </div>
                <div style={{
                  fontSize: "10px", fontWeight: "700", color: C.redLight,
                  background: "rgba(184,80,88,0.1)", border: "1px solid rgba(184,80,88,0.22)",
                  padding: "4px 10px", borderRadius: "20px", flexShrink: 0, whiteSpace: "nowrap",
                }}>
                  Träna →
                </div>
              </button>
            ) : (
              /* Ready / empty state — no wrong questions */
              <div
                id="ob-fokustranin"
                className="home-card-3"
                style={{
                  width: "100%", marginBottom: "10px",
                  padding: "11px 14px",
                  borderRadius: "12px",
                  border: `1px solid ${C.borderSoft}`,
                  display: "flex", alignItems: "center", gap: "11px",
                  opacity: tot === 0 ? 0.38 : 1,
                }}
              >
                <div style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: tot === 0 ? C.faint : C.green, flexShrink: 0,
                }} />
                <div style={{ flex: 1, fontSize: "12px", color: C.muted }}>
                  {tot === 0 ? "Fokusträning aktiveras efter ditt första prov" : "Inga missade frågor just nu"}
                </div>
                {tot > 0 && (
                  <span style={{ fontSize: "11px", fontWeight: "700", color: C.greenLight, flexShrink: 0 }}>✓</span>
                )}
              </div>
            )}

            {/* ══ 3b. DELPROV QUICK TILES — only when has data ════════════ */}
            {tot > 0 && (
              <div className="home-card-3b" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                {dpProgress.map(({ dp, cfg: dpCfg, pct, tried }) => {
                  const barCol = pct >= 70 ? C.greenLight : pct >= 40 ? C.gold : tried ? C.redLight : C.faint;
                  return (
                    <button key={dp} className="pressable-sm" onClick={() => startQuiz(dp)}
                      style={{
                        padding: "14px 14px 12px",
                        borderRadius: "13px",
                        border: `1px solid ${C.border}`,
                        background: "rgba(255,255,255,0.02)",
                        cursor: "pointer", textAlign: "left",
                        fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <div style={{ fontSize: "8px", fontWeight: "700", color: C.muted, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px" }}>
                        {dpCfg.name}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "9px" }}>
                        <span style={{ fontSize: "22px", fontWeight: "800", color: tried ? C.text : C.faint, letterSpacing: "-0.6px", lineHeight: 1 }}>
                          {pct}
                        </span>
                        <span style={{ fontSize: "11px", color: barCol, fontWeight: "700" }}>%</span>
                      </div>
                      <div style={{ height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "1px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: barCol, borderRadius: "1px" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ══ 4. PROGRESS OVERVIEW — inline stats, no card border ══════ */}
            {tot > 0 && (
              <div className="home-card-4" style={{ marginTop: "8px", marginBottom: "8px" }}>
                {/* Thin divider */}
                <div style={{ height: "1px", background: C.borderSoft, marginBottom: "18px" }} />
                {/* Stat row */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  {[
                    [mastered,  "Behärskade",   C.greenLight],
                    [`${acc}%`, "Träffsäkerhet", C.text],
                    [tot,       "Övade totalt",  C.muted],
                  ].map(([val, label, color], i) => (
                    <div key={label} style={{
                      flex: 1, textAlign: "center",
                      borderLeft: i > 0 ? `1px solid ${C.borderSoft}` : "none",
                    }}>
                      <div style={{ fontSize: "18px", fontWeight: "800", color, letterSpacing: "-0.4px", lineHeight: 1, marginBottom: "5px" }}>
                        {val}
                      </div>
                      <div style={{ fontSize: "9px", fontWeight: "600", color: C.faint, letterSpacing: "0.4px", textTransform: "uppercase" }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Footer link */}
                <button
                  onClick={() => setView("prov")}
                  style={{
                    marginTop: "14px", paddingTop: "12px",
                    borderTop: `1px solid ${C.borderSoft}`,
                    background: "none", border: "none",
                    width: "100%", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span style={{ fontSize: "11px", color: C.faint }}>
                    {masterPct >= 80 ? "Nästan redo för prov" : masterPct >= 50 ? `${QUESTIONS.length - mastered} frågor kvar att behärska` : "Fortsätt öva för att nå provnivån"}
                  </span>
                  <span style={{ fontSize: "11px", color: C.gold, fontWeight: "600" }}>Se Prov →</span>
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
            m === "quick" ? "Snabbprov" : m === "focus" ? "Fokus" :
            m === 1 ? "DP1" : m === 2 ? "DP2" :
            m === 10 ? "10fr" : m === 20 ? "20fr" : m === 30 ? "30fr" : "Alla";
          const TEST_MODES = new Set(["quick", 10, 20, 30, 1, 2]);
          const chartEntries = [...quizHistory]
            .filter(e => TEST_MODES.has(e.mode))
            .slice(0, 8)   // 8 most recent (history[0] = newest)
            .reverse();    // oldest on left in chart
          const insightLine = masterPct >= 80
            ? "Du är redo — dags att boka ditt prov"
            : masterPct >= 50
            ? `${QUESTIONS.length - mastered} frågor kvar att behärska för provnivån`
            : "Fortsätt öva — varje session tar dig närmre målet";

          return (
            <div style={{ animation: "screenIn 0.28s ease both" }}>

              {/* ── PAGE HEADER ────────────────────────────────────────── */}
              <div style={{ paddingBottom: "20px", marginBottom: "24px", borderBottom: `1px solid ${C.borderSoft}` }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: C.gold, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px", opacity: 0.85 }}>
                  Provförberedelse
                </div>
                <div style={{ fontSize: "26px", fontWeight: "800", color: C.text, letterSpacing: "-0.7px", lineHeight: 1 }}>
                  Prov
                </div>
              </div>

              {/* ── 1. SENASTE TESTER ──────────────────────────────────── */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: C.text, letterSpacing: "-0.3px", marginBottom: "4px" }}>
                    Senaste provresultat
                  </div>
                  <div style={{ fontSize: "11px", color: C.muted }}>
                    Dina avklarade test i procent · godkänt vid 70%
                  </div>
                </div>

                {chartEntries.length === 0 ? (
                  /* Empty state */
                  <div style={{
                    ...card, padding: "28px 20px",
                    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
                  }}>
                    <div style={{ fontSize: "30px", marginBottom: "12px", opacity: 0.5 }}>📊</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: C.muted, marginBottom: "6px" }}>
                      Inga genomförda tester än
                    </div>
                    <div style={{ fontSize: "12px", color: C.faint, lineHeight: 1.65, maxWidth: "240px" }}>
                      Genomför ett snabbprov eller delprov så visas dina resultat som ett diagram här
                    </div>
                  </div>
                ) : (
                  /* Bar chart */
                  <div style={{ ...card, padding: "16px 14px 12px", position: "relative", overflow: "visible" }}>
                    {/* Chart bars area */}
                    <div style={{ position: "relative", height: "96px", display: "flex", alignItems: "flex-end", gap: "5px" }}>
                      {/* Pass threshold line */}
                      <div style={{
                        position: "absolute", left: 0, right: 0,
                        bottom: `${PASS * 0.96}px`,
                        height: "1px",
                        background: "rgba(201,168,76,0.45)",
                        borderTop: "1px dashed rgba(201,168,76,0.45)",
                        pointerEvents: "none",
                        zIndex: 1,
                      }} />
                      {/* Pass line label */}
                      <div style={{
                        position: "absolute",
                        left: 0, bottom: `${PASS * 0.96 + 4}px`,
                        fontSize: "8px", color: C.gold, fontWeight: "600",
                        letterSpacing: "0.2px", lineHeight: 1,
                        zIndex: 10,
                        background: C.surface,
                        paddingRight: "4px",
                      }}>Godkänt 70%</div>

                      {/* Bars */}
                      {chartEntries.map((entry, i) => {
                        const barH = Math.max(4, Math.round(entry.pct * 0.96));
                        const color = entry.pct >= 70 ? C.green : entry.pct >= 50 ? "#b8860b" : C.red;
                        const isLast = i === chartEntries.length - 1;
                        return (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 3 }}>
                            {/* Score label */}
                            <div style={{
                              fontSize: "8px", fontWeight: "700", lineHeight: 1, marginBottom: "3px",
                              color: entry.pct >= 70 ? C.greenLight : entry.pct >= 50 ? C.gold : C.redLight,
                            }}>
                              {entry.pct}%
                            </div>
                            {/* Bar body */}
                            <div style={{
                              width: "100%", height: `${barH}px`,
                              background: color, borderRadius: "3px 3px 2px 2px",
                              opacity: isLast ? 1 : 0.55 + (i / chartEntries.length) * 0.35,
                              transition: "opacity 0.15s",
                            }} />
                          </div>
                        );
                      })}
                    </div>

                    {/* X-axis labels */}
                    <div style={{ display: "flex", gap: "5px", marginTop: "6px" }}>
                      {chartEntries.map((entry, i) => (
                        <div key={i} style={{
                          flex: 1, textAlign: "center",
                          fontSize: "8px", color: C.faint, lineHeight: 1,
                        }}>
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
                        <div style={{
                          display: "flex", gap: "0", marginTop: "12px",
                          borderTop: `1px solid ${C.borderSoft}`, paddingTop: "10px",
                        }}>
                          {[
                            [`${avg}%`, "Snitt"],
                            [`${best}%`, "Bäst"],
                            [`${passed}/${chartEntries.length}`, "Godkänt"],
                          ].map(([val, lbl], i) => (
                            <div key={lbl} style={{
                              flex: 1, textAlign: "center",
                              borderLeft: i > 0 ? `1px solid ${C.borderSoft}` : "none",
                            }}>
                              <div style={{ fontSize: "14px", fontWeight: "800", color: C.text, letterSpacing: "-0.3px", lineHeight: 1, marginBottom: "3px" }}>{val}</div>
                              <div style={{ fontSize: "9px", color: C.faint, textTransform: "uppercase", letterSpacing: "0.4px" }}>{lbl}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* ── 2. PROVBEREDSKAP ───────────────────────────────────── */}
              {tot > 0 && (
                <div style={{
                  borderRadius: "16px",
                  border: `1px solid ${C.borderGold}`,
                  background: C.surface,
                  marginBottom: "20px",
                  overflow: "hidden",
                  position: "relative",
                }}>
                  <div style={{ height: "2px", background: goldGrad }} />
                  <div style={{ padding: "18px 20px 0", position: "relative" }}>
                    <div style={{
                      position: "absolute", top: 0, right: 0, width: "180px", height: "140px",
                      background: "radial-gradient(ellipse at top right, rgba(201,168,76,0.06) 0%, transparent 70%)",
                      pointerEvents: "none",
                    }} />
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                      <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "2px", textTransform: "uppercase" }}>
                        Provberedskap
                      </div>
                      <div style={{
                        fontSize: "10px", fontWeight: "700",
                        color: overallColor, background: `${overallColor}14`,
                        border: `1px solid ${overallColor}35`, padding: "3px 10px", borderRadius: "20px",
                      }}>
                        {overallStatus}
                      </div>
                    </div>
                    {/* Main stat row */}
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "16px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "2px", lineHeight: 1 }}>
                          <span style={{ fontSize: "48px", fontWeight: "800", color: C.text, letterSpacing: "-3px" }}>{masterPct}</span>
                          <span style={{ fontSize: "22px", fontWeight: "700", color: C.gold, letterSpacing: "-1px" }}>%</span>
                        </div>
                        <div style={{ fontSize: "11px", color: C.muted, marginTop: "6px" }}>
                          {mastered} av {QUESTIONS.length} behärskade
                        </div>
                      </div>
                      <div style={{ textAlign: "right", paddingBottom: "2px" }}>
                        <div style={{ fontSize: "9px", color: C.faint, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>Träffsäkerhet</div>
                        <div style={{ fontSize: "22px", fontWeight: "700", color: C.textSoft, letterSpacing: "-0.5px", lineHeight: 1 }}>
                          {acc}<span style={{ fontSize: "12px", fontWeight: "600" }}>%</span>
                        </div>
                      </div>
                    </div>
                    {/* Mastery progress bar */}
                    <div style={{ marginBottom: "4px" }}>
                      <div style={{ position: "relative", height: "6px" }}>
                        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.05)", borderRadius: "3px" }} />
                        <div style={{ position: "absolute", inset: 0, borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: "3px", width: `${masterPct}%`,
                            background: masterPct >= 80
                              ? `linear-gradient(90deg, ${C.green}, ${C.greenLight})`
                              : masterPct >= 50
                              ? `linear-gradient(90deg, #7a5c18, ${C.gold})`
                              : `linear-gradient(90deg, rgba(184,80,88,0.7), ${C.redLight})`,
                            transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                          }} />
                        </div>
                        <div style={{
                          position: "absolute", left: `${PASS}%`,
                          top: "-3px", height: "12px", width: "2px",
                          background: C.gold, borderRadius: "1px", opacity: 0.55,
                        }} />
                      </div>
                      <div style={{ position: "relative", height: "16px" }}>
                        <div style={{
                          position: "absolute", left: `${PASS}%`, top: "3px",
                          transform: "translateX(-50%)",
                          fontSize: "8px", color: C.gold, opacity: 0.65,
                          whiteSpace: "nowrap",
                        }}>provgräns</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", color: C.muted, fontStyle: "italic", paddingBottom: "16px" }}>
                      {insightLine}
                    </div>
                  </div>
                  {/* Delprov breakdown */}
                  <div style={{ height: "1px", background: C.border }} />
                  <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {dpProgress.map(({ dp, cfg: dpCfg, total, mastered: dpM, acc: dpA, pct, tried }) => {
                      const toPass   = Math.max(0, Math.ceil(total * 70 / 100) - dpM);
                      const barCol   = pct >= 70 ? C.greenLight : pct >= 40 ? C.gold : tried ? C.redLight : C.faint;
                      const dpStatus = pct >= 70 ? "Redo" : pct >= 40 ? "På väg" : tried ? "Öva mer" : "Ej övad";
                      const detail   = !tried
                        ? "Ingen träning ännu"
                        : pct >= 70
                        ? `${dpM} av ${total} behärskade · ${dpA}% rätt`
                        : `${toPass} fler för att nå provgränsen · ${dpA}% rätt`;
                      return (
                        <div key={dp}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
                            <div>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: C.text }}>{dpCfg.name}</span>
                              <span style={{ fontSize: "10px", color: C.faint, marginLeft: "6px" }}>{dpCfg.sub}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "7px", flexShrink: 0, marginLeft: "8px" }}>
                              <span style={{ fontSize: "15px", fontWeight: "800", color: C.text, letterSpacing: "-0.5px" }}>
                                {pct}<span style={{ fontSize: "10px", color: barCol, fontWeight: "700" }}>%</span>
                              </span>
                              <span style={{
                                fontSize: "9px", fontWeight: "700", color: barCol,
                                background: `${barCol}15`, border: `1px solid ${barCol}35`,
                                padding: "2px 7px", borderRadius: "20px",
                              }}>{dpStatus}</span>
                            </div>
                          </div>
                          <div style={{ position: "relative", height: "4px", marginBottom: "5px" }}>
                            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.04)", borderRadius: "2px" }} />
                            <div style={{ position: "absolute", inset: 0, borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: "2px", width: `${pct}%`,
                                background: barCol, transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                              }} />
                            </div>
                            <div style={{
                              position: "absolute", left: "70%",
                              top: "-2px", height: "8px", width: "1.5px",
                              background: C.gold, borderRadius: "1px", opacity: 0.5,
                            }} />
                          </div>
                          <div style={{ fontSize: "10px", color: C.faint }}>{detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 3A. SNABBA TEST ────────────────────────────────────── */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", color: C.muted }}>
                    Snabba test
                  </div>
                  <div style={{ fontSize: "9px", color: C.faint }}>slumpvist urval</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { m: "quick", label: "Snabbprov",  sub: "15 frågor · ~5 min",       icon: "⚡", primary: true },
                    { m: 10,      label: "10 frågor",  sub: "Snabb koll · ~3 min",       icon: "10", primary: false },
                    { m: 20,      label: "20 frågor",  sub: "Djupare test · ~7 min",     icon: "20", primary: false },
                    { m: 30,      label: "30 frågor",  sub: "Längre session · ~10 min",  icon: "30", primary: false },
                  ].map(({ m, label, sub, icon, primary }) => (
                    <button
                      key={String(m)}
                      className="pressable-sm"
                      onClick={() => startQuiz(m)}
                      style={{
                        ...card, width: "100%", padding: "14px 16px",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "14px",
                        textAlign: "left", WebkitTapHighlightColor: "transparent",
                        borderColor: primary ? C.borderGoldStr : C.border,
                        transition: "border-color 0.15s, background 0.15s",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderGoldStr; e.currentTarget.style.background = C.surfaceAlt; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = primary ? C.borderGoldStr : C.border; e.currentTarget.style.background = C.surface; }}
                    >
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                        background: primary ? C.goldBg : "rgba(255,255,255,0.03)",
                        border: `1px solid ${primary ? C.borderGold : C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: primary ? "18px" : "12px",
                        fontWeight: "800",
                        color: primary ? C.gold : C.muted,
                        letterSpacing: "-0.5px",
                      }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: primary ? "700" : "600", color: C.text, marginBottom: "2px" }}>
                          {label}
                        </div>
                        <div style={{ fontSize: "10px", color: C.muted }}>{sub}</div>
                      </div>
                      <span style={{ color: C.faint, fontSize: "16px", lineHeight: 1 }}>›</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 3B. OFFICIELLA DELPROV ─────────────────────────────── */}
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", color: C.muted }}>
                    Officiella delprov
                  </div>
                  <div style={{ fontSize: "9px", color: C.faint }}>med tidsgräns</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[1, 2].map(dp => {
                    const dpCfg = DELPROV_CONFIG[dp];
                    const prog  = dpProgress.find(p => p.dp === dp);
                    const barCol    = prog.pct >= 70 ? C.greenLight : prog.pct >= 40 ? C.gold : prog.tried ? C.redLight : C.faint;
                    const statusLbl = prog.pct >= 70 ? "Redo" : prog.pct >= 40 ? "På väg" : prog.tried ? "Öva mer" : "Ej övad";
                    return (
                      <button key={dp} id={`ob-delprov${dp}`} className="pressable-sm" onClick={() => startQuiz(dp)}
                        style={{
                          ...card, padding: "0", cursor: "pointer",
                          textAlign: "left", display: "block", overflow: "hidden",
                          transition: "border-color 0.18s, background 0.18s",
                          WebkitTapHighlightColor: "transparent",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderGoldStr; e.currentTarget.style.background = C.surfaceAlt; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}
                      >
                        <div style={{ padding: "14px 14px 0" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                            <div>
                              <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: "3px" }}>
                                {dpCfg.name}
                              </div>
                              <div style={{ fontSize: "12px", fontWeight: "700", color: C.text, lineHeight: 1.3 }}>
                                {dpCfg.sub}
                              </div>
                            </div>
                            <div style={{
                              fontSize: "8px", fontWeight: "700", color: barCol,
                              background: `${barCol}15`, border: `1px solid ${barCol}30`,
                              padding: "2px 6px", borderRadius: "20px",
                              flexShrink: 0, marginLeft: "4px",
                            }}>{statusLbl}</div>
                          </div>
                          <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden", marginBottom: "14px" }}>
                            <div style={{
                              height: "100%", borderRadius: "2px", width: `${prog.pct}%`,
                              background: barCol, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                            }} />
                          </div>
                        </div>
                        <div style={{
                          padding: "9px 14px", borderTop: `1px solid ${C.border}`,
                          background: "rgba(0,0,0,0.15)",
                          fontSize: "9px", color: C.faint, lineHeight: "1.8",
                        }}>
                          {dpCfg.total} frågor · {dpCfg.time} min<br />
                          Godkänt {dpCfg.passMark}/{dpCfg.countedQ}
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
            ? new Date(dailyData.date + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })
            : "";

          return (
            <div style={{ animation: "screenIn 0.28s ease both" }}>

              {/* ── PAGE HEADER ────────────────────────────────────────── */}
              <div style={{ paddingBottom: "20px", marginBottom: "24px", borderBottom: `1px solid ${C.borderSoft}` }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: C.gold, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px", opacity: 0.85 }}>
                  Dagliga utmaningar
                </div>
                <div style={{ fontSize: "26px", fontWeight: "800", color: C.text, letterSpacing: "-0.7px", lineHeight: 1 }}>
                  Utmaningar
                </div>
              </div>

              {/* ══ MODE 1: Dagens fråga ════════════════════════════════════ */}
              <div style={{
                background: C.surface,
                border: `1px solid ${
                  dailyData.answered && dailyData.correct  ? C.greenBorder :
                  dailyData.answered && !dailyData.correct ? C.redBorder   :
                  C.borderGold
                }`,
                borderRadius: "16px",
                overflow: "hidden",
                marginBottom: "32px",
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
                      Dagens fråga
                    </div>
                    <div style={{ fontSize: "12px", color: C.muted, textTransform: "capitalize" }}>
                      {dailyDateLabel}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      background: dailyData.streak > 0 ? C.goldBg : "rgba(255,255,255,0.03)",
                      border: `1px solid ${dailyData.streak > 0 ? C.borderGold : C.border}`,
                      borderRadius: "20px", padding: "5px 11px",
                      fontSize: "13px", fontWeight: "700",
                      color: dailyData.streak > 0 ? C.gold : C.muted,
                    }}>
                      🔥 {dailyData.streak} {dailyData.streak === 1 ? "dag" : "dagar"}
                    </div>
                    {dailyData.bestStreak > 1 && (
                      <div style={{ fontSize: "10px", color: C.faint, paddingRight: "2px" }}>
                        Bästa: {dailyData.bestStreak}
                      </div>
                    )}
                  </div>
                </div>

                {/* Question body */}
                {dailyQ ? (
                  <div style={{ padding: "16px 18px 18px" }}>
                    {dailyQ.image && (
                      <ZoomableImage src={dailyQ.image} style={{
                        width: "100%", borderRadius: "10px", marginBottom: "14px",
                        border: `1px solid ${C.border}`,
                      }} />
                    )}
                    <p style={{
                      fontSize: "15px", lineHeight: "1.68", color: C.text,
                      fontWeight: "600", marginBottom: "14px",
                    }}>
                      {dailyQ.question}
                    </p>

                    {/* Options */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      {dailyQ.options.map((opt, i) => {
                        const s     = optionStyles(i, dailyQ.correct, dailyData.chosenIdx, dailyData.answered);
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
                              borderRadius: "10px",
                              cursor: dailyData.answered ? "default" : "pointer",
                              WebkitTapHighlightColor: "transparent",
                              transition: "background 0.18s, border-color 0.18s",
                              animation: dailyData.answered && i === dailyQ.correct
                                ? "correctReveal 0.4s ease" : undefined,
                            }}
                          >
                            <span style={{
                              width: "26px", height: "26px", borderRadius: "7px", flexShrink: 0,
                              background: s.badgeBg, border: `1px solid ${s.badgeBrd}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: s.indicator ? "12px" : "11px", fontWeight: "700", color: s.badgeCol,
                            }}>
                              {s.indicator || ["A","B","C","D"][i]}
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
                          padding: "10px 13px", borderRadius: "10px",
                          background: dailyData.correct ? C.greenBg : C.redBg,
                          border: `1px solid ${dailyData.correct ? C.greenBorder : C.redBorder}`,
                          marginBottom: dailyQ.explanation ? "9px" : "0",
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
                                  ? "Rätt! Streaken börjar nu."
                                  : `Rätt! ${dailyData.streak} dagar i rad.`)
                              : "Fel svar. Streaken bröts."}
                          </span>
                        </div>
                        {dailyQ.explanation && (
                          <div style={{
                            padding: "10px 13px",
                            background: "rgba(201,168,76,0.04)",
                            borderRadius: "9px",
                            border: `1px solid rgba(201,168,76,0.12)`,
                          }}>
                            <p style={{ color: C.textSoft, fontSize: "13px", lineHeight: "1.65", margin: 0 }}>
                              {dailyQ.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "24px 18px", textAlign: "center", color: C.faint, fontSize: "13px" }}>
                    Ingen fråga tillgänglig
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
                    Kom tillbaka imorgon för en ny fråga
                  </div>
                )}
              </div>

              {/* ══ MODE 2: Rätt i rad ══════════════════════════════════════ */}
              <button
                onClick={() => startQuiz("rir")}
                className="pressable"
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                  padding: "0", marginBottom: "10px",
                  borderRadius: "16px", overflow: "hidden",
                  border: `1px solid rgba(201,168,76,0.22)`,
                  background: "linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0.02) 60%, rgba(9,9,11,0) 100%)",
                  position: "relative",
                }}
              >
                {/* Top shimmer line */}
                <div style={{
                  position: "absolute", top: 0, left: "8%", right: "8%", height: "1px",
                  background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)",
                  pointerEvents: "none",
                }} />

                <div style={{ padding: "20px 20px 18px", display: "flex", alignItems: "center", gap: "16px" }}>
                  {/* Icon badge */}
                  <div style={{
                    width: "50px", height: "50px", borderRadius: "14px", flexShrink: 0,
                    background: "rgba(201,168,76,0.1)", border: `1px solid rgba(201,168,76,0.2)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "24px",
                  }}>
                    🎯
                  </div>

                  {/* Text block */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "8px", color: C.gold, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px", opacity: 0.9 }}>
                      Utmaning
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: C.text, letterSpacing: "-0.5px", lineHeight: 1, marginBottom: "6px" }}>
                      Rätt i rad
                    </div>
                    <div style={{ fontSize: "12px", color: C.muted, lineHeight: 1.5 }}>
                      Svara rätt utan avbrott — slutar vid första felet
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
                      rekord
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
          const q         = quiz.questions[quiz.current];
          const cfg       = (mode === 1 || mode === 2) ? DELPROV_CONFIG[mode] : null;
          const danger    = timeLeft !== null && timeLeft < 300;
          const modeLabel = mode === "quick" ? "Snabbprov" : mode === "focus" ? "Fokusträning" : mode === "rir" ? "Rätt i rad" : mode === "all" ? "Alla frågor" : mode === 10 ? "10 frågor" : mode === 20 ? "20 frågor" : mode === 30 ? "30 frågor" : cfg?.name ?? "";

          return (
            <div>
              {/* Top bar */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "20px",
              }}>
                <button
                  onClick={() => { clearTimeout(timer.current); setView(mode === "rir" ? "utmaningar" : "home"); }}
                  style={btnGhost}
                >
                  ← Avbryt
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {timeLeft !== null && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      background: danger ? "rgba(184,80,88,0.1)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${danger ? C.redBorder : C.border}`,
                      borderRadius: "8px", padding: "5px 11px",
                      fontSize: "14px", fontWeight: "700",
                      color: danger ? C.redLight : C.text,
                      fontVariantNumeric: "tabular-nums",
                      transition: "all 0.4s",
                    }}>
                      ⏱ {fmt(timeLeft)}
                    </div>
                  )}
                  <div style={{
                    background: C.goldBg, border: `1px solid ${C.borderGold}`,
                    borderRadius: "8px", padding: "5px 12px",
                    fontSize: "13px", fontWeight: "700", color: C.gold,
                  }}>
                    {quiz.current + 1}
                    <span style={{ color: C.muted, fontWeight: "500" }}> / {quiz.questions.length}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <ProgressBar value={quiz.current} total={quiz.questions.length} />

              {/* Mode label */}
              <Label color={C.gold}>{modeLabel}</Label>

              {/* Question image */}
              <ZoomableImage
                src={q.image}
                style={{
                  width: "100%", borderRadius: "13px", marginBottom: "20px",
                  border: `1px solid ${C.border}`,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                }}
              />

              {/* Question text */}
              <p style={{
                fontSize: "17px", lineHeight: "1.74", color: C.text,
                fontWeight: "600", marginBottom: "24px",
              }}>
                {q.question}
              </p>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                {q.options.map((opt, i) => {
                  const s = optionStyles(i, q.correct, quiz.answered, quiz.answered !== null);
                  return (
                    <button key={i}
                      className={quiz.answered === null ? "quiz-opt" : ""}
                      onClick={() => answer(i)}
                      style={{
                        background: s.bg, border: `1px solid ${s.brd}`, borderRadius: "12px",
                        padding: "14px 15px", color: s.col,
                        fontSize: "14px", fontWeight: "500", textAlign: "left",
                        cursor: quiz.answered !== null ? "default" : "pointer",
                        transition: "background 0.18s cubic-bezier(0.4,0,0.2,1), border-color 0.18s, color 0.18s",
                        display: "flex", alignItems: "center", gap: "12px",
                        animation: shakeBtn === i
                          ? "shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97) both"
                          : (quiz.answered !== null && i === q.correct
                            ? "correctReveal 0.38s cubic-bezier(0.34,1.2,0.64,1) both"
                            : "none"),
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <OptionBadge letter={["A","B","C","D"][i]} bg={s.badgeBg} border={s.badgeBrd} color={s.badgeCol} />
                      <span style={{ flex: 1 }}>{opt}</span>
                      {quiz.answered !== null && s.indicator && (
                        <span style={{
                          fontSize: "13px", fontWeight: "700", flexShrink: 0,
                          color: i === q.correct ? C.greenLight : C.redLight,
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
                <div ref={explainRef} style={{ animation: "popIn 0.5s cubic-bezier(0.34,1.4,0.64,1) both" }}>
                  {q.explanation && (
                    <div style={{ marginTop: "20px" }}>
                      <ExplanationBox text={q.explanation} />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                    <button
                      onClick={() => toggleSave(q.id)}
                      style={{
                        ...btnGhost,
                        padding: "16px",
                        flexShrink: 0,
                        borderColor: savedIds.includes(q.id) ? C.borderGoldStr : C.border,
                        color: savedIds.includes(q.id) ? C.gold : C.muted,
                        fontWeight: savedIds.includes(q.id) ? "700" : "500",
                        fontSize: "13px",
                        transition: "all 0.18s",
                      }}
                    >
                      {savedIds.includes(q.id) ? "🔖 Sparad" : "🔖"}
                    </button>
                    <button onClick={next}
                      className="pressable"
                      style={{
                        ...btnGold, flex: 1, padding: "16px",
                        fontSize: "15px", boxShadow: "0 4px 24px rgba(201,168,76,0.18)",
                      }}
                    >
                      {quiz.current + 1 >= quiz.questions.length ? "Se resultat →" : "Nästa fråga →"}
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
                  <div style={{ fontSize: "44px", marginBottom: "12px" }}>
                    {result.score >= 20 ? "🔥" : result.score >= 10 ? "💪" : result.score >= 5 ? "📖" : "🎯"}
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: C.gold, marginBottom: "16px" }}>
                    Rätt i rad
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "4px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "58px", fontWeight: "800", color: C.text, lineHeight: 1, letterSpacing: "-2px" }}>
                      {result.score}
                    </span>
                    <span style={{ fontSize: "18px", fontWeight: "500", color: C.muted }}>
                      &nbsp;rätt
                    </span>
                  </div>
                  {rirBest > 0 && (
                    <div style={{ fontSize: "12px", color: result.score >= rirBest && result.score > 0 ? C.gold : C.muted, marginTop: "4px" }}>
                      {result.score >= rirBest && result.score > 0 ? "✦ Nytt rekord!" : `Rekord: ${rirBest}`}
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
                  <div style={{ fontSize: "44px", marginBottom: "12px" }}>
                    {passed ? "🏆" : result.expired ? "⏰" : "📖"}
                  </div>

                  <div style={{
                    fontSize: "15px", fontWeight: "700", letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: passed ? C.greenLight : C.redLight,
                    marginBottom: "16px",
                  }}>
                    {passed ? "Godkänt" : "Underkänt"}
                    {result.expired && (
                      <span style={{ display: "block", fontSize: "11px", textTransform: "none", letterSpacing: "0", fontWeight: "500", marginTop: "4px", color: C.redLight }}>
                        Tiden tog slut
                      </span>
                    )}
                  </div>

                  {/* Score number */}
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "4px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "58px", fontWeight: "800", color: C.text, lineHeight: 1, letterSpacing: "-2px" }}>
                      {result.score}
                    </span>
                    <span style={{ fontSize: "24px", fontWeight: "500", color: C.muted }}>
                      / {result.total}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: C.muted, marginBottom: "4px" }}>
                    {pct}% rätt
                  </div>

                  {/* Score bar */}
                  <ScoreBar score={result.score} total={result.total} passMark={cfg?.passMark} />

                  {cfg && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                      borderRadius: "8px", padding: "6px 14px",
                      fontSize: "11px", color: C.muted,
                      marginTop: "6px",
                    }}>
                      Godkändgräns:{" "}
                      <span style={{ color: C.gold, fontWeight: "700" }}>{cfg.passMark} av {cfg.countedQ}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Answer review */}
              <Label>Genomgång</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
                {result.answers.map((a, i) => (
                  <button key={i}
                    className="review-item"
                    onClick={() => setPopupQ({ ...a.q, chosen: a.chosen })}
                    style={{
                      display: "flex", alignItems: "center", gap: "11px",
                      padding: "11px 14px",
                      background: a.correct ? C.greenBg : C.redBg,
                      border: `1px solid ${a.correct ? C.greenBorder : C.redBorder}`,
                      borderRadius: "11px", cursor: "pointer",
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
                  {result.mode === "rir" ? "Ny omgång" : "Försök igen"}
                </button>
                <button onClick={() => setView(result.mode === "rir" ? "utmaningar" : "home")}
                  className="pressable-sm"
                  style={{ ...btnGhost, flex: 1, padding: "15px", fontSize: "14px", justifyContent: "center" }}>
                  {result.mode === "rir" ? "← Utmaningar" : "Hem"}
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
              <p style={{ color: C.muted, marginBottom: "18px", fontSize: "14px" }}>Inga kort att visa</p>
              <button onClick={() => setView("mer")} style={btnGhost}>← Mer</button>
            </div>
          );

          const q       = qs[flashIdx];
          const dpLabel = DELPROV_CONFIG[q.delprov];

          return (
            <div>
              {/* Top bar */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "20px",
              }}>
                <button onClick={() => setView("mer")} style={btnGhost}>← Mer</button>
                <div style={{
                  background: C.goldBg, border: `1px solid ${C.borderGold}`,
                  borderRadius: "8px", padding: "5px 13px",
                  fontSize: "13px", fontWeight: "700", color: C.gold,
                }}>
                  {flashIdx + 1}
                  <span style={{ color: C.muted, fontWeight: "500" }}> / {qs.length}</span>
                </div>
              </div>

              <ProgressBar value={flashIdx + 1} total={qs.length} />

              {/* Category */}
              <Label color={C.gold}>{dpLabel.name} — {dpLabel.sub}</Label>

              {/* 3-D flip card */}
              <div className="flash-scene" style={{ marginBottom: "18px" }}>
                <div className={`flash-card${flipped ? " is-flipped" : ""}`} onClick={() => setFlipped(f => !f)}>

                  {/* Front */}
                  <div className="flash-face flash-front" style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}>
                    <div style={{
                      fontSize: "9px", fontWeight: "700", letterSpacing: "2.5px",
                      color: C.faint, marginBottom: "18px", textTransform: "uppercase",
                    }}>
                      FRÅGA · Tryck för att vända
                    </div>
                    <ZoomableImage
                      src={q.image}
                      style={{ width: "100%", borderRadius: "10px", marginBottom: "14px", border: `1px solid ${C.border}` }}
                    />
                    <p style={{ fontSize: "16px", lineHeight: "1.72", color: C.text, margin: 0 }}>
                      {q.question}
                    </p>
                  </div>

                  {/* Back */}
                  <div className="flash-face flash-back" style={{
                    background: "rgba(79,168,112,0.05)",
                    border: `1px solid ${C.greenBorder}`,
                    boxShadow: "0 8px 32px rgba(79,168,112,0.08)",
                  }}>
                    <div style={{
                      fontSize: "9px", fontWeight: "700", letterSpacing: "2.5px",
                      color: C.greenLight, marginBottom: "18px", textTransform: "uppercase",
                    }}>
                      SVAR
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
                    borderRadius: "9px", color: C.gold, cursor: "pointer",
                    fontSize: "13px", fontWeight: "700", padding: "13px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: "6px", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  Vänd 🔄
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
                  {flashIdx === qs.length - 1 ? "Klar" : "→"}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════
            FRÅGOR
        ══════════════════════════════════════════════════════════════ */}
        {view === "fragor" && (() => {
          // ── Derived data for hub ─────────────────────────────────────────
          const statusCounts = {
            "ej övad":  QUESTIONS.filter(q => getQuestionStatus(q) === "ej övad").length,
            "öva mer":  QUESTIONS.filter(q => getQuestionStatus(q) === "öva mer").length,
            "på väg":   QUESTIONS.filter(q => getQuestionStatus(q) === "på väg").length,
            "behärskad": mastered,
          };

          const categories = [
            { key: "fordon",       label: "Fordon & säkerhet", icon: "🔧", qs: QUESTIONS.filter(q => q.delprov === 1) },
            { key: "trafikregler", label: "Trafikregler",       icon: "🚦", qs: QUESTIONS.filter(q => q.delprov === 2 && !isTaxiregelQuestion(q) && !isVilotidQuestion(q)) },
            { key: "taxiregler",   label: "Taxiregler",         icon: "📋", qs: QUESTIONS.filter(isTaxiregelQuestion) },
            { key: "vilotid",      label: "Vilotid & tidbok",   icon: "⏱️", qs: QUESTIONS.filter(isVilotidQuestion) },
            { key: "bilder",       label: "Bildfrågor",         icon: "🖼️", qs: QUESTIONS.filter(q => q.image) },
          ].map(cat => {
            const masteredCount = cat.qs.filter(q => getQuestionStatus(q) === "behärskad").length;
            return { ...cat, masteredCount, pct: cat.qs.length > 0 ? Math.round(masteredCount / cat.qs.length * 100) : 0 };
          });

          // ── Browse pool ──────────────────────────────────────────────────
          const browseQs = (() => {
            if (!fragorFilter) return [];
            if (fragorFilter === "felaktiga") return QUESTIONS.filter(q => { const s = stats[q.id] || { c: 0, w: 0 }; return s.w > 0 && s.c === 0; });
            if (fragorFilter === "sparade")   return QUESTIONS.filter(q => savedIds.includes(q.id));
            if (fragorFilter === "fordon")       return QUESTIONS.filter(q => q.delprov === 1);
            if (fragorFilter === "trafikregler") return QUESTIONS.filter(q => q.delprov === 2 && !isTaxiregelQuestion(q) && !isVilotidQuestion(q));
            if (fragorFilter === "taxiregler")   return QUESTIONS.filter(isTaxiregelQuestion);
            if (fragorFilter === "vilotid")      return QUESTIONS.filter(isVilotidQuestion);
            if (fragorFilter === "bilder")    return QUESTIONS.filter(q => q.image);
            return QUESTIONS.filter(q => getQuestionStatus(q) === fragorFilter);
          })();

          const browseTitle = {
            "felaktiga":  "Felaktigt besvarade",
            "sparade":    "Sparade frågor",
            "ej övad":    "Ej övad",
            "öva mer":    "Öva mer",
            "på väg":     "På väg",
            "behärskad":  "Behärskad",
            "fordon":       "Fordon & säkerhet",
            "trafikregler": "Trafikregler",
            "taxiregler":   "Taxiregler",
            "vilotid":      "Vilotid & tidbok",
            "bilder":     "Bildfrågor",
          }[fragorFilter] || "";

          const statusColor = (status) => ({ "behärskad": C.greenLight, "på väg": C.gold, "öva mer": C.redLight, "ej övad": C.faint }[status]);

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
                      ← Tillbaka
                    </button>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: C.text }}>{browseTitle}</div>
                    <div style={{ marginLeft: "auto", fontSize: "11px", color: C.faint }}>{browseQs.length} st</div>
                  </div>

                  {browseQs.length === 0 ? (
                    <div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: "28px", marginBottom: "12px", opacity: 0.4 }}>
                        {fragorFilter === "sparade" ? "🔖" : "✓"}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: C.muted, marginBottom: "6px" }}>Inga frågor här</div>
                      <div style={{ fontSize: "12px", color: C.faint, lineHeight: 1.65 }}>
                        {fragorFilter === "felaktiga"
                          ? "Du har inga felaktigt besvarade frågor just nu"
                          : fragorFilter === "sparade"
                          ? "Öppna en fråga och tryck 🔖 för att spara den"
                          : "Inga frågor matchar detta filter"}
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
                              padding: "11px 14px", ...card, borderRadius: "10px",
                              width: "100%", cursor: "pointer", textAlign: "left",
                              WebkitTapHighlightColor: "transparent",
                            }}
                          >
                            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: sc, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: "12px", color: C.textSoft, lineHeight: 1.45 }}>
                              {q.question.substring(0, 62)}…
                            </span>
                            {saved && <span style={{ fontSize: "10px", color: C.gold, flexShrink: 0 }}>🔖</span>}
                            <span style={{ fontSize: "10px", color: sc, whiteSpace: "nowrap", fontWeight: "600" }}>{st}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* ══ HUB MODE ═════════════════════════════════════════════ */
                <>

                  {/* ── PAGE HEADER ──────────────────────────────────────── */}
                  <div style={{ paddingBottom: "20px", marginBottom: "24px", borderBottom: `1px solid ${C.borderSoft}` }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: C.gold, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px", opacity: 0.85 }}>
                      Frågebank
                    </div>
                    <div style={{ fontSize: "26px", fontWeight: "800", color: C.text, letterSpacing: "-0.7px", lineHeight: 1 }}>
                      Frågor
                    </div>
                  </div>

                  {/* ── 1. MINA FRÅGOR ───────────────────────────────────── */}
                  <div style={{ marginBottom: "22px" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "12px", opacity: 0.75 }}>
                      Mina frågor
                    </div>

                    {/* Felaktigt besvarade — primary personal pool */}
                    <div style={{
                      ...card, padding: "18px 18px 16px",
                      marginBottom: "8px",
                      borderColor: wrongCount > 0 ? "rgba(208,112,120,0.28)" : C.border,
                      background: wrongCount > 0 ? "rgba(208,112,120,0.04)" : C.surface,
                      position: "relative", overflow: "hidden",
                    }}>
                      {wrongCount > 0 && (
                        <div style={{
                          position: "absolute", top: 0, left: 0, right: 0, height: "44px",
                          background: "linear-gradient(180deg, rgba(208,112,120,0.06) 0%, transparent 100%)",
                          pointerEvents: "none",
                        }} />
                      )}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                        <div>
                          <div style={{ fontSize: "8px", fontWeight: "700", color: wrongCount > 0 ? C.redLight : C.faint, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px", opacity: 0.85 }}>
                            Felaktigt besvarade
                          </div>
                          {wrongCount > 0 ? (
                            <div style={{ fontSize: "30px", fontWeight: "800", color: C.redLight, letterSpacing: "-1px", lineHeight: 1 }}>
                              {wrongCount}
                              <span style={{ fontSize: "13px", fontWeight: "600", color: C.muted, marginLeft: "6px", letterSpacing: 0 }}>frågor kvar</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: "14px", fontWeight: "700", color: C.muted, lineHeight: 1.3 }}>
                              Inga att rätta till ✓
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", color: C.faint, lineHeight: 1.55, marginBottom: wrongCount > 0 ? "14px" : "0" }}>
                        {wrongCount > 0
                          ? "Frågor du svarat fel på och ännu inte löst"
                          : "Alla dina svar är rätt just nu — fortsätt öva"}
                      </div>
                      {wrongCount > 0 && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="pressable-sm"
                            onClick={() => setFragorFilter("felaktiga")}
                            style={{
                              flex: 1, padding: "9px 14px", borderRadius: "9px",
                              border: `1px solid ${C.border}`, background: "transparent",
                              color: C.muted, cursor: "pointer", fontSize: "12px", fontWeight: "600",
                              fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                            }}
                          >
                            Bläddra →
                          </button>
                          <button
                            className="pressable-sm"
                            onClick={() => startQuiz("focus")}
                            style={{
                              flex: 1, padding: "9px 14px", borderRadius: "9px",
                              border: "1px solid rgba(208,112,120,0.35)",
                              background: "rgba(208,112,120,0.1)",
                              color: C.redLight, cursor: "pointer", fontSize: "12px", fontWeight: "700",
                              fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                            }}
                          >
                            Träna nu →
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sparade frågor — active when bookmarks exist */}
                    {savedIds.length > 0 ? (
                      <button
                        className="pressable-sm"
                        onClick={() => setFragorFilter("sparade")}
                        style={{
                          ...card, padding: "13px 16px", width: "100%",
                          display: "flex", alignItems: "center", gap: "12px",
                          cursor: "pointer", textAlign: "left",
                          fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                          borderColor: C.borderGoldStr,
                          background: C.goldBg,
                        }}
                      >
                        <div style={{
                          width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0,
                          background: C.goldBg, border: `1px solid ${C.borderGold}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px",
                        }}>🔖</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>Sparade frågor</div>
                          <div style={{ fontSize: "10px", color: C.muted }}>{savedIds.length} sparade</div>
                        </div>
                        <span style={{ color: C.gold, fontSize: "14px" }}>›</span>
                      </button>
                    ) : (
                      <div style={{
                        ...card, padding: "13px 16px",
                        display: "flex", alignItems: "center", gap: "12px",
                        opacity: 0.45,
                      }}>
                        <div style={{
                          width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0,
                          background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px",
                        }}>🔖</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: C.muted, marginBottom: "2px" }}>Sparade frågor</div>
                          <div style={{ fontSize: "10px", color: C.faint }}>Bokmärk frågor med 🔖 för att samla dem här</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── 2. KUNSKAPSNIVÅ ──────────────────────────────────── */}
                  <div style={{ marginBottom: "22px" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "12px", opacity: 0.75 }}>
                      Kunskapsnivå
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[
                        { key: "ej övad",   label: "Ej övad",   color: "rgba(255,255,255,0.28)", barBg: "rgba(255,255,255,0.06)" },
                        { key: "öva mer",   label: "Öva mer",   color: C.redLight,               barBg: "rgba(208,112,120,0.12)" },
                        { key: "på väg",    label: "På väg",    color: C.gold,                   barBg: "rgba(201,168,76,0.12)" },
                        { key: "behärskad", label: "Behärskad", color: C.greenLight,             barBg: "rgba(79,168,112,0.12)" },
                      ].map(({ key, label, color, barBg }) => {
                        const count = statusCounts[key];
                        const total = QUESTIONS.length;
                        const pct   = total > 0 ? Math.round(count / total * 100) : 0;
                        const clickable = count > 0;
                        return (
                          <button key={key}
                            className={clickable ? "pressable-sm" : ""}
                            onClick={() => clickable && setFragorFilter(key)}
                            style={{
                              ...card, padding: "0",
                              overflow: "hidden",
                              cursor: clickable ? "pointer" : "default",
                              textAlign: "left", fontFamily: "inherit",
                              WebkitTapHighlightColor: "transparent",
                              opacity: count === 0 ? 0.38 : 1,
                            }}
                          >
                            <div style={{ padding: "14px 14px 12px" }}>
                              <div style={{ fontSize: "9px", fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>
                                {label}
                              </div>
                              <div style={{ fontSize: "28px", fontWeight: "800", color, letterSpacing: "-0.8px", lineHeight: 1, marginBottom: "4px" }}>
                                {count}
                              </div>
                              <div style={{ fontSize: "9px", color: C.faint, marginBottom: "10px" }}>{pct}% av alla</div>
                            </div>
                            {/* Mini fill bar flush to bottom */}
                            <div style={{ height: "2px", background: "rgba(255,255,255,0.04)" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: color, opacity: 0.7 }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── 3. FRÅGOR EFTER KATEGORI ─────────────────────────── */}
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "12px", opacity: 0.75 }}>
                      Frågor efter kategori
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {categories.map(({ key, label, icon, qs, masteredCount, pct }) => {
                        const barCol = pct >= 80 ? C.greenLight : pct >= 50 ? C.gold : pct > 0 ? C.redLight : C.faint;
                        return (
                          <button key={key}
                            className="pressable-sm"
                            onClick={() => setFragorFilter(key)}
                            style={{
                              ...card, width: "100%", padding: "0",
                              cursor: "pointer", textAlign: "left", overflow: "hidden",
                              fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                            }}
                          >
                            <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                              <div style={{
                                width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
                                background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "15px",
                              }}>{icon}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>{label}</div>
                                <div style={{ fontSize: "10px", color: C.muted }}>{masteredCount} av {qs.length} behärskade</div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: "14px", fontWeight: "800", color: pct > 0 ? barCol : C.faint, letterSpacing: "-0.3px", lineHeight: 1 }}>
                                  {pct}<span style={{ fontSize: "10px", fontWeight: "600" }}>%</span>
                                </div>
                                <div style={{ fontSize: "12px", color: C.faint, marginTop: "2px" }}>›</div>
                              </div>
                            </div>
                            {/* Progress bar flush to bottom */}
                            <div style={{ height: "2px", background: "rgba(255,255,255,0.04)" }}>
                              <div style={{
                                height: "100%", width: `${pct}%`,
                                background: barCol,
                                transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                              }} />
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
                    q={statsQuestion}
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
              <button onClick={() => setView("mer")} style={btnGhost}>← Mer</button>
              <div style={{
                fontSize: "12px", fontWeight: "600", color: C.muted,
                background: checklistDone.size === CHECKLIST_STEPS.length && CHECKLIST_STEPS.length > 0
                  ? C.greenBg : C.goldBg,
                border: `1px solid ${checklistDone.size === CHECKLIST_STEPS.length && CHECKLIST_STEPS.length > 0
                  ? C.greenBorder : C.borderGold}`,
                borderRadius: "8px", padding: "5px 12px",
                color: checklistDone.size === CHECKLIST_STEPS.length && CHECKLIST_STEPS.length > 0
                  ? C.greenLight : C.gold,
              }}>
                {checklistDone.size} / {CHECKLIST_STEPS.length}
              </div>
            </div>

            <Label color={C.gold}>Checklista</Label>
            <p style={{ fontSize: "13px", color: C.muted, lineHeight: "1.6", margin: "0 0 20px" }}>
              Taxiförarlegitimation — markera varje steg när du är klar med det.
            </p>

            {/* Step list */}
            <div style={{ ...card, overflow: "hidden" }}>
              {CHECKLIST_STEPS.map(({ title, desc, app }, i, arr) => {
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
                      borderBottom: last ? "none" : `1px solid ${C.borderSoft}`,
                      background: done
                        ? "rgba(79,168,112,0.05)"
                        : app ? "rgba(201,168,76,0.02)" : "transparent",
                      border: "none",
                      WebkitTapHighlightColor: "transparent",
                      transition: "background 0.18s",
                    }}
                  >
                    {/* Check indicator */}
                    <div style={{
                      width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                      marginTop: "1px",
                      background: done ? C.greenBg : "transparent",
                      border: `1.5px solid ${done ? C.green : app ? C.borderGoldStr : C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: "800",
                      color: done ? C.greenLight : C.faint,
                      transition: "all 0.18s",
                    }}>
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
                          color: done ? C.muted : app ? C.gold : C.text,
                          textDecoration: done ? "line-through" : "none",
                          textDecorationColor: C.faint,
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
                        color: done ? C.faint : C.textSoft,
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
            {checklistDone.size === CHECKLIST_STEPS.length && CHECKLIST_STEPS.length > 0 && (
              <div style={{
                marginTop: "20px", padding: "18px 20px",
                background: C.greenBg, border: `1px solid ${C.greenBorder}`,
                borderRadius: "14px", textAlign: "center",
                animation: "popIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both",
              }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: C.greenLight, marginBottom: "3px" }}>
                  Alla steg klara
                </div>
                <div style={{ fontSize: "12px", color: C.green, opacity: 0.8 }}>
                  Lycka till med din taxiförarlegitimation!
                </div>
              </div>
            )}

          </div>
        )}

        {view === "mer" && (
          <div style={{ animation: "screenIn 0.28s ease both" }}>

            {/* ══ PAGE HEADER ═════════════════════════════════════════════ */}
            <div style={{ paddingBottom: "20px", marginBottom: "24px", borderBottom: `1px solid ${C.borderSoft}` }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: C.gold, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px", opacity: 0.85 }}>
                Statistik & verktyg
              </div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: C.text, letterSpacing: "-0.7px", lineHeight: 1 }}>
                Mer
              </div>
            </div>

            {/* ══ STATISTIK ═══════════════════════════════════════════════ */}
            <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "12px", opacity: 0.75 }}>Statistik</div>

            {/* Unified stats block — accuracy hero row + 3-column secondary */}
            <div style={{ ...card, overflow: "hidden", marginBottom: "10px" }}>
              {/* Hero: Accuracy */}
              <div className="stat-card-1" style={{
                padding: "20px 22px 18px",
                borderBottom: `1px solid ${C.borderSoft}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "linear-gradient(135deg, rgba(201,168,76,0.05) 0%, transparent 100%)",
              }}>
                <div>
                  <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px", opacity: 0.8 }}>
                    Träffsäkerhet
                  </div>
                  <div style={{ fontSize: "42px", fontWeight: "800", color: C.gold, lineHeight: 1, letterSpacing: "-2px" }}>
                    {acc}<span style={{ fontSize: "22px", fontWeight: "700", letterSpacing: "-0.5px" }}>%</span>
                  </div>
                </div>
                {tot > 0 && (
                  <div style={{
                    width: "56px", height: "56px", borderRadius: "50%",
                    background: `conic-gradient(${C.gold} ${acc * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: "44px", height: "44px", borderRadius: "50%",
                      background: C.surface,
                    }} />
                  </div>
                )}
              </div>
              {/* Secondary: 3 stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                {[
                  [tot,        "Försök",     C.text,       "stat-card-2"],
                  [corr,       "Rätt",       C.greenLight, "stat-card-3"],
                  [`${mastered}/${QUESTIONS.length}`, "Behärskade", "#b8a0d0", "stat-card-4"],
                ].map(([v, l, color, cn], i) => (
                  <div key={l} className={cn} style={{
                    padding: "14px 16px",
                    borderRight: i < 2 ? `1px solid ${C.borderSoft}` : "none",
                  }}>
                    <div style={{ fontSize: "20px", fontWeight: "800", color, lineHeight: 1, letterSpacing: "-0.5px" }}>{v}</div>
                    <div style={{ fontSize: "9px", color: C.muted, marginTop: "5px", fontWeight: "600", letterSpacing: "0.3px" }}>
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mastery distribution */}
            <div style={{ ...card, padding: "16px 20px 14px", marginBottom: "32px" }}>
              <div style={{ fontSize: "9px", fontWeight: "700", color: C.muted, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "14px" }}>
                Kunskapsfördelning
              </div>
              <MasteryBar questions={QUESTIONS} getStatus={getQuestionStatus} />
            </div>

            {/* ══ CHECKLISTA ══════════════════════════════════════════════ */}
            <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "12px", opacity: 0.75 }}>Checklista</div>
            {(() => {
              const done  = checklistDone.size;
              const total = CHECKLIST_STEPS.length;
              const pct   = Math.round(done / total * 100);
              return (
                <button
                  className="pressable-sm"
                  onClick={() => setView("checklista")}
                  style={{
                    ...card, width: "100%", cursor: "pointer", textAlign: "left",
                    padding: "0", marginBottom: "36px", overflow: "hidden",
                    display: "block", border: `1px solid ${done === total && total > 0 ? C.greenBorder : C.border}`,
                    background: done === total && total > 0 ? "linear-gradient(135deg, rgba(79,168,112,0.05) 0%, transparent 100%)" : C.surface,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <div style={{ padding: "15px 18px 14px", display: "flex", alignItems: "center", gap: "14px" }}>
                    <span style={{
                      width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                      background: done === total && total > 0 ? C.greenBg : "rgba(255,255,255,0.04)",
                      border: `1px solid ${done === total && total > 0 ? C.greenBorder : C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "18px",
                    }}>
                      {done === total && total > 0 ? "✓" : "☑"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>
                        Taxiförarlegitimation
                      </div>
                      <div style={{ fontSize: "11px", color: C.muted }}>
                        {done === 0
                          ? "12 steg på vägen till din yrkeslegitimation"
                          : done === total
                          ? "Alla steg klara"
                          : `${done} av ${total} steg klara`}
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
            <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "12px", opacity: 0.75 }}>Verktyg</div>
            <div style={{ ...card, overflow: "hidden", marginBottom: "36px" }}>
              <button
                id="ob-flashcards"
                className="pressable-sm"
                onClick={openFlashcards}
                style={{
                  width: "100%", cursor: "pointer", textAlign: "left",
                  padding: "15px 18px",
                  display: "flex", alignItems: "center", gap: "14px",
                  background: "none", border: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{
                  width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px",
                }}>🃏</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "1px" }}>
                    Flashcards
                  </div>
                  <div style={{ fontSize: "11px", color: C.muted }}>Öva med fråge- och svarskort</div>
                </div>
                <span style={{ color: C.muted, fontSize: "16px", lineHeight: 1 }}>›</span>
              </button>
            </div>

            {/* ══ INSTÄLLNINGAR ══════════════════════════════════════════ */}
            <div style={{ fontSize: "10px", fontWeight: "700", color: C.gold, letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "12px", opacity: 0.75 }}>Inställningar</div>
            <div style={{ ...card, overflow: "hidden", marginBottom: "8px" }}>
              {/* Reset data row */}
              <button
                onClick={() => setShowResetConfirm(true)}
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  padding: "15px 18px",
                  display: "flex", alignItems: "center", gap: "14px",
                  background: "none", border: "none",
                  WebkitTapHighlightColor: "transparent",
                  borderBottom: `1px solid ${C.borderSoft}`,
                }}
              >
                <span style={{
                  width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                  background: "rgba(184,80,88,0.08)", border: "1px solid rgba(184,80,88,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px",
                }}>🗑</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: C.redLight, marginBottom: "1px" }}>
                    Nollställ all data
                  </div>
                  <div style={{ fontSize: "11px", color: C.muted }}>Tar bort all statistik och sparade frågor</div>
                </div>
                <span style={{ color: C.muted, fontSize: "16px", lineHeight: 1 }}>›</span>
              </button>

              {/* Version row */}
              <div style={{
                padding: "12px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ fontSize: "13px", color: C.muted }}>Version</div>
                <div style={{ fontSize: "12px", color: C.faint, fontWeight: "600" }}>v{APP_VERSION}</div>
              </div>
            </div>

            {/* Reset confirmation dialog */}
            {showResetConfirm && createPortal(
              <div
                onClick={() => setShowResetConfirm(false)}
                style={{
                  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                  background: "rgba(0,0,0,0.88)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 200, padding: "24px",
                  animation: "fadeIn 0.16s ease both",
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: "#141414",
                    border: `1px solid #2e2020`,
                    borderRadius: "20px",
                    padding: "28px 24px 24px",
                    width: "100%", maxWidth: "360px",
                    animation: "popIn 0.22s cubic-bezier(0.34,1.3,0.64,1) both",
                  }}
                >
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "14px",
                    background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: "18px", fontSize: "22px",
                  }}>
                    ⚠️
                  </div>
                  <div style={{ fontSize: "17px", fontWeight: "800", color: C.text, marginBottom: "10px", letterSpacing: "-0.2px" }}>
                    Nollställ all statistik?
                  </div>
                  <div style={{ fontSize: "13px", color: C.textSoft, lineHeight: 1.6, marginBottom: "26px" }}>
                    Det här tar bort all din sparade träningsstatistik — rätta svar, felaktiga svar och din kunskapsnivå per fråga. Ditt framsteg nollställs helt och du börjar om från noll.
                    <br /><br />
                    <span style={{ color: C.muted, fontWeight: "600" }}>Det går inte att ångra.</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      style={{
                        flex: 1, padding: "13px", borderRadius: "12px",
                        border: `1px solid ${C.border}`, background: "transparent",
                        color: C.muted, cursor: "pointer", fontSize: "13px", fontWeight: "600",
                        fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={resetAllProgress}
                      style={{
                        flex: 1, padding: "13px", borderRadius: "12px",
                        border: "1px solid rgba(200,60,60,0.5)",
                        background: "rgba(200,60,60,0.14)",
                        color: "#e05050",
                        cursor: "pointer",
                        fontSize: "13px", fontWeight: "700",
                        fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      Nollställ
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
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
            {[["prov","prov","Prov"],["fragor","fragor","Frågor"],["home","home","Hem"],["utmaningar","utmaningar","Utmaningar"],["mer","mer","Mer"]].map(([v, ico, label]) => (
              <button key={v}
                id={v !== "home" ? `ob-nav-${v}` : undefined}
                className={`bottom-nav-btn${view === v ? " active" : ""}`}
                onClick={() => setView(v)}
                style={{ color: view === v ? C.gold : C.muted }}
              >
                <span className="bottom-nav-icon"><NavIcon name={ico} active={view === v} /></span>
                <span className="bottom-nav-label">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </nav>
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
          checklistSteps={CHECKLIST_STEPS}
          saveAllStats={saveAllStats}
        />
      )}

    </div>
  );
}
