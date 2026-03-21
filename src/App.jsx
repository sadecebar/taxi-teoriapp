import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./App.css";
import OnboardingTour from "./OnboardingTour.jsx";
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  // Surfaces
  bg:            "#090909",
  surface:       "#111111",
  surfaceAlt:    "#181818",
  surface3:      "#1f1f1f",

  // Borders
  border:        "#222222",
  borderSoft:    "#1a1a1a",
  borderGold:    "rgba(201,168,76,0.22)",
  borderGoldStr: "rgba(201,168,76,0.44)",

  // Text
  text:          "#f2ede4",
  textSoft:      "#a8a090",
  muted:         "#686058",
  faint:         "#353230",

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
function QuestionPopupBody({ q, chosen, revealed, onSelectOption, onClose }) {
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

      <button
        onClick={onClose}
        style={{
          ...btnGold, width: "100%", padding: "14px", fontSize: "14px",
          boxShadow: "0 4px 20px rgba(201,168,76,0.14)",
        }}
      >
        Stäng
      </button>
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
    setShowResetConfirm(false);
    // Re-trigger onboarding for this installation only
    localStorage.removeItem(`taxi-teori-onboarding-done-${INSTALL_ID}`);
    setView("home");
    setShowOnboarding(true);
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
    if (m === "all" || m === "quick") return QUESTIONS;
    if (m === "focus") return QUESTIONS.filter(q => {
      const s = stats[q.id] || { c: 0, w: 0 };
      return s.w > 0 && s.c === 0; // wrong pool: has wrongs AND never answered correctly
    });
    return QUESTIONS.filter(q => q.delprov === m);
  };

  const startQuiz = (m) => {
    clearTimeout(timer.current);
    if (QUESTIONS.length === 0) return;
    let qs = [...getQs(m)].sort(() => Math.random() - 0.5);
    if (qs.length === 0) return;
    if (m === "quick" || m === "focus") qs = qs.slice(0, 15);
    if (m === 1)       qs = qs.slice(0, 70);
    if (m === 2)       qs = qs.slice(0, 50);
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
    if (quiz.current + 1 >= quiz.questions.length) endQuiz(ans);
    else setQuiz(s => ({ ...s, current: s.current + 1, answers: ans, answered: null }));
  };

  const endQuiz = (answers) => {
    clearTimeout(timer.current);
    setResult({ score: answers.filter(a => a.correct).length, total: answers.length, answers, mode, expired: timeLeft === 0 });
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
        height: "60px",
        background: "rgba(8,8,8,0.97)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
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
          {[["home","Hem"],["quiz","Snabbprov"],["stats","Statistik"]].map(([v, label]) => (
            <button key={v}
              id={v === "stats" ? "ob-statistik-desktop" : undefined}
              onClick={() => { if (v === "quiz") startQuiz("quick"); else setView(v); }}
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
            HOME
        ══════════════════════════════════════════════════════════════ */}
        {view === "home" && (
          <div style={{ animation: "screenIn 0.28s ease both" }}>

            {/* ─ Session / readiness card ─────────────────────────────── */}
            {tot === 0 ? (
              /* First-time user welcome */
              <div className="home-card-1" style={{
                ...card,
                borderColor: C.borderGold,
                padding: "28px 24px",
                marginBottom: "20px",
                background: "linear-gradient(135deg, rgba(201,168,76,0.05) 0%, transparent 100%)",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, right: 0, width: "140px", height: "140px",
                  background: "radial-gradient(circle at top right, rgba(201,168,76,0.1) 0%, transparent 65%)",
                  pointerEvents: "none",
                }} />
                <div style={{ fontSize: "36px", marginBottom: "14px" }}>🎓</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: C.text, marginBottom: "6px" }}>
                  Välkommen till Taxi Teori
                </div>
                <p style={{ fontSize: "13px", color: C.muted, lineHeight: "1.65", margin: 0 }}>
                  Starta ett snabbprov för att börja öva och spåra din framgång inför körkortsprovet.
                </p>
              </div>
            ) : (() => {
              const PASS = 70; // mastery % threshold for "exam ready"
              const remaining = QUESTIONS.length - mastered;
              const insightLine = masterPct >= 80
                ? "Utmärkt – du är redo att boka ditt prov"
                : masterPct >= 50
                ? `${remaining} frågor kvar att behärska för att nå provnivån`
                : tot > 0
                ? "Fortsätt öva – varje session tar dig närmre målet"
                : "Starta ett snabbprov för att mäta ditt utgångsläge";

              return (
                /* Returning user — Exam Brief card */
                <div className="home-card-1" style={{
                  borderRadius: "16px",
                  border: `1px solid ${C.borderGold}`,
                  background: C.surface,
                  marginBottom: "20px",
                  overflow: "hidden",
                  position: "relative",
                }}>
                  {/* Gold accent stripe */}
                  <div style={{ height: "2px", background: goldGrad }} />

                  {/* ── HEADER ── */}
                  <div style={{ padding: "18px 20px 0", position: "relative" }}>
                    <div style={{
                      position: "absolute", top: 0, right: 0, width: "200px", height: "160px",
                      background: "radial-gradient(ellipse at top right, rgba(201,168,76,0.07) 0%, transparent 70%)",
                      pointerEvents: "none",
                    }} />

                    {/* Label + status badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                      <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "2px", textTransform: "uppercase" }}>
                        Provberedskap
                      </div>
                      <div style={{
                        fontSize: "10px", fontWeight: "700", letterSpacing: "0.2px",
                        color: overallColor,
                        background: `${overallColor}14`,
                        border: `1px solid ${overallColor}35`,
                        padding: "3px 10px", borderRadius: "20px",
                      }}>
                        {overallStatus}
                      </div>
                    </div>

                    {/* Main number row */}
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "18px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "2px", lineHeight: 1 }}>
                          <span style={{ fontSize: "54px", fontWeight: "800", color: C.text, letterSpacing: "-3px" }}>{masterPct}</span>
                          <span style={{ fontSize: "26px", fontWeight: "700", color: C.gold, letterSpacing: "-1px" }}>%</span>
                        </div>
                        <div style={{ fontSize: "11px", color: C.muted, marginTop: "7px" }}>
                          {mastered} av {QUESTIONS.length} behärskade
                        </div>
                      </div>
                      <div style={{ textAlign: "right", paddingBottom: "4px" }}>
                        <div style={{ fontSize: "9px", color: C.faint, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>Träffsäkerhet</div>
                        <div style={{ fontSize: "24px", fontWeight: "700", color: C.textSoft, letterSpacing: "-0.5px", lineHeight: 1 }}>
                          {acc}<span style={{ fontSize: "13px", fontWeight: "600" }}>%</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar with threshold marker */}
                    <div style={{ marginBottom: "6px" }}>
                      <div style={{ position: "relative", height: "6px" }}>
                        {/* Track */}
                        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.05)", borderRadius: "3px" }} />
                        {/* Fill */}
                        <div style={{ position: "absolute", inset: 0, borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: "3px",
                            width: `${masterPct}%`,
                            background: masterPct >= 80
                              ? `linear-gradient(90deg, ${C.green}, ${C.greenLight})`
                              : masterPct >= 50
                              ? `linear-gradient(90deg, #7a5c18, ${C.gold})`
                              : `linear-gradient(90deg, rgba(184,80,88,0.7), ${C.redLight})`,
                            transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                          }} />
                        </div>
                        {/* Threshold tick — sticks 3px above and below the bar */}
                        <div style={{
                          position: "absolute", left: `${PASS}%`,
                          top: "-3px", height: "12px", width: "2px",
                          background: C.gold, borderRadius: "1px", opacity: 0.55,
                        }} />
                      </div>
                      {/* Threshold label */}
                      <div style={{ position: "relative", height: "16px" }}>
                        <div style={{
                          position: "absolute", left: `${PASS}%`, top: "3px",
                          transform: "translateX(-50%)",
                          fontSize: "8px", color: C.gold, opacity: 0.65,
                          whiteSpace: "nowrap", letterSpacing: "0.2px",
                        }}>
                          provgräns
                        </div>
                      </div>
                    </div>

                    {/* Insight line */}
                    <div style={{ fontSize: "11px", color: C.muted, fontStyle: "italic", paddingBottom: "18px" }}>
                      {insightLine}
                    </div>
                  </div>

                  {/* ── DIVIDER ── */}
                  <div style={{ height: "1px", background: C.border }} />

                  {/* ── PER-DELPROV ── */}
                  <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {dpProgress.map(({ dp, cfg, total, mastered: dpM, acc: dpA, pct, tried }) => {
                      const toPass   = Math.max(0, Math.ceil(total * PASS / 100) - dpM);
                      const barCol   = pct >= PASS ? C.greenLight : pct >= 40 ? C.gold : tried ? C.redLight : C.faint;
                      const dpStatus = pct >= PASS ? "Redo" : pct >= 40 ? "På väg" : tried ? "Öva mer" : "Ej övad";
                      const detail   = !tried
                        ? "Ingen träning ännu"
                        : pct >= PASS
                        ? `${dpM} av ${total} behärskade · ${dpA}% rätt`
                        : `${toPass} fler för att nå provgränsen · ${dpA}% rätt`;
                      return (
                        <div key={dp}>
                          {/* Name + stats row */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
                            <div>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: C.text }}>{cfg.name}</span>
                              <span style={{ fontSize: "10px", color: C.faint, marginLeft: "6px" }}>{cfg.sub}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "7px", flexShrink: 0, marginLeft: "8px" }}>
                              <span style={{ fontSize: "15px", fontWeight: "800", color: C.text, letterSpacing: "-0.5px" }}>
                                {pct}<span style={{ fontSize: "10px", color: barCol, fontWeight: "700" }}>%</span>
                              </span>
                              <span style={{
                                fontSize: "9px", fontWeight: "700",
                                color: barCol,
                                background: `${barCol}15`,
                                border: `1px solid ${barCol}35`,
                                padding: "2px 7px", borderRadius: "20px",
                              }}>
                                {dpStatus}
                              </span>
                            </div>
                          </div>
                          {/* Bar with marker */}
                          <div style={{ position: "relative", height: "4px", marginBottom: "5px" }}>
                            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.04)", borderRadius: "2px" }} />
                            <div style={{ position: "absolute", inset: 0, borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: "2px",
                                width: `${pct}%`,
                                background: barCol,
                                transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                              }} />
                            </div>
                            <div style={{
                              position: "absolute", left: `${PASS}%`,
                              top: "-2px", height: "8px", width: "1.5px",
                              background: C.gold, borderRadius: "1px", opacity: 0.5,
                            }} />
                          </div>
                          {/* Detail text */}
                          <div style={{ fontSize: "10px", color: C.faint }}>{detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ─ Snabbprov ─────────────────────────────────────────── */}
            <button
              id="ob-snabbprov"
              className="home-card-2 pressable"
              onClick={() => startQuiz("quick")}
              style={{
                width: "100%", marginBottom: "28px",
                padding: "20px 20px 18px",
                borderRadius: "16px", overflow: "hidden",
                border: `1px solid ${C.borderGoldStr}`,
                background: C.surfaceAlt,
                display: "block", cursor: "pointer", textAlign: "left",
                boxShadow: "0 4px 24px rgba(201,168,76,0.08)",
                WebkitTapHighlightColor: "transparent",
                position: "relative",
              }}
            >
              {/* Subtle top wash */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "56px",
                background: "linear-gradient(180deg, rgba(201,168,76,0.05) 0%, transparent 100%)",
                pointerEvents: "none",
              }} />
              {/* Watermark */}
              <div style={{
                position: "absolute", right: "-2px", bottom: "-16px",
                fontSize: "96px", fontWeight: "900", lineHeight: 1,
                color: "rgba(255,255,255,0.025)", letterSpacing: "-5px",
                pointerEvents: "none", userSelect: "none",
              }}>15</div>

              {/* Label + icon */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", position: "relative" }}>
                <div style={{ fontSize: "8px", fontWeight: "700", color: C.gold, letterSpacing: "2.5px", textTransform: "uppercase" }}>
                  Daglig träning
                </div>
                <span style={{ fontSize: "16px", lineHeight: 1, opacity: 0.7 }}>⚡</span>
              </div>

              {/* Title */}
              <div style={{ fontSize: "28px", fontWeight: "800", color: C.text, letterSpacing: "-1px", lineHeight: 1, marginBottom: "7px", position: "relative" }}>
                Snabbprov
              </div>

              {/* Subtitle */}
              <div style={{ fontSize: "11px", color: C.muted, lineHeight: 1.5, marginBottom: "18px", position: "relative" }}>
                Testa dig själv och mät ditt kunskapsläge
              </div>

              {/* Chips + arrow */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {["15 frågor", "~5 min", "Slumpvis urval"].map(lbl => (
                    <div key={lbl} style={{
                      fontSize: "9px", fontWeight: "600", color: C.textSoft,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${C.border}`,
                      padding: "3px 8px", borderRadius: "5px",
                    }}>{lbl}</div>
                  ))}
                </div>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                  background: C.goldBg, border: `1px solid ${C.borderGold}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.gold, fontSize: "15px", marginLeft: "10px",
                }}>›</div>
              </div>
            </button>

            {/* ─ Fokusträning ──────────────────────────────────────────── */}
            {(tot > 0 || showOnboarding) && (
              <div
                id="ob-fokustranin"
                className="home-card-3 pressable-sm"
                onClick={wrongCount > 0 ? () => startQuiz("focus") : undefined}
                role={wrongCount > 0 ? "button" : undefined}
                style={{
                  width: "100%", marginBottom: "28px",
                  padding: "20px 20px 18px",
                  borderRadius: "16px", overflow: "hidden",
                  border: wrongCount > 0 ? "1px solid rgba(208,112,120,0.28)" : `1px solid ${C.border}`,
                  background: C.surfaceAlt,
                  display: "block", textAlign: "left",
                  cursor: wrongCount > 0 ? "pointer" : "default",
                  boxShadow: wrongCount > 0 ? "0 4px 24px rgba(208,112,120,0.06)" : "none",
                  WebkitTapHighlightColor: "transparent",
                  position: "relative",
                  opacity: wrongCount > 0 ? 1 : 0.6,
                }}
              >
                {wrongCount > 0 && (
                  <>
                    {/* Subtle top wash */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: "56px",
                      background: "linear-gradient(180deg, rgba(208,112,120,0.05) 0%, transparent 100%)",
                      pointerEvents: "none",
                    }} />
                    {/* Watermark */}
                    <div style={{
                      position: "absolute", right: "-2px", bottom: "-16px",
                      fontSize: "96px", fontWeight: "900", lineHeight: 1,
                      color: "rgba(255,255,255,0.025)", letterSpacing: "-5px",
                      pointerEvents: "none", userSelect: "none",
                    }}>15</div>
                  </>
                )}

                {/* Label + icon */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", position: "relative" }}>
                  <div style={{ fontSize: "8px", fontWeight: "700", color: wrongCount > 0 ? C.redLight : C.faint, letterSpacing: "2.5px", textTransform: "uppercase", opacity: 0.85 }}>
                    Felaktiga svar
                  </div>
                  <span style={{ fontSize: "16px", lineHeight: 1, opacity: 0.5 }}>🎯</span>
                </div>

                {wrongCount > 0 ? (
                  <>
                    {/* Title */}
                    <div style={{ fontSize: "28px", fontWeight: "800", color: C.text, letterSpacing: "-1px", lineHeight: 1, marginBottom: "7px", position: "relative" }}>
                      Fokusträning
                    </div>
                    {/* Subtitle */}
                    <div style={{ fontSize: "11px", color: C.muted, lineHeight: 1.5, marginBottom: "18px", position: "relative" }}>
                      Öva de frågor du svarat fel på
                    </div>
                    {/* Chips + arrow */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                        {["15 frågor", "~5 min", `${wrongCount} att rätta till`].map(lbl => (
                          <div key={lbl} style={{
                            fontSize: "9px", fontWeight: "600", color: C.textSoft,
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${C.border}`,
                            padding: "3px 8px", borderRadius: "5px",
                          }}>{lbl}</div>
                        ))}
                      </div>
                      <div style={{
                        width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                        background: "rgba(208,112,120,0.1)", border: "1px solid rgba(208,112,120,0.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: C.redLight, fontSize: "15px", marginLeft: "10px",
                      }}>›</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: C.muted, letterSpacing: "-0.3px", lineHeight: 1, marginBottom: "6px" }}>
                      Fokusträning
                    </div>
                    <div style={{ fontSize: "11px", color: C.faint, lineHeight: 1.5 }}>
                      Inga felaktiga frågor kvar att öva på
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─ Provsimulering ────────────────────────────────────────── */}
            <div className="home-card-4" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", color: C.muted }}>
                Provsimulering
              </div>
              <div style={{ fontSize: "9px", color: C.faint }}>med tidsgräns</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              {[1, 2].map(dp => {
                const cfg  = DELPROV_CONFIG[dp];
                const prog = dpProgress.find(p => p.dp === dp);
                const barCol    = prog.pct >= 70 ? C.greenLight : prog.pct >= 40 ? C.gold : prog.tried ? C.redLight : C.faint;
                const statusLbl = prog.pct >= 70 ? "Redo" : prog.pct >= 40 ? "På väg" : prog.tried ? "Öva mer" : "Ej övad";
                return (
                  <button key={dp} id={`ob-delprov${dp}`} className="pressable-sm" onClick={() => startQuiz(dp)}
                    style={{
                      ...card, padding: "0", cursor: "pointer",
                      textAlign: "left", display: "block",
                      overflow: "hidden",
                      transition: "border-color 0.18s, background 0.18s",
                      WebkitTapHighlightColor: "transparent",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderGoldStr; e.currentTarget.style.background = C.surfaceAlt; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}
                  >
                    <div style={{ padding: "14px 14px 0" }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                        <div>
                          <div style={{ fontSize: "9px", fontWeight: "700", color: C.gold, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: "3px" }}>
                            {cfg.name}
                          </div>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: C.text, lineHeight: 1.3 }}>
                            {cfg.sub}
                          </div>
                        </div>
                        <div style={{
                          fontSize: "8px", fontWeight: "700",
                          color: barCol,
                          background: `${barCol}15`,
                          border: `1px solid ${barCol}30`,
                          padding: "2px 6px", borderRadius: "20px",
                          flexShrink: 0, marginLeft: "4px",
                        }}>
                          {statusLbl}
                        </div>
                      </div>
                      {/* Mini progress bar */}
                      <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden", marginBottom: "14px" }}>
                        <div style={{
                          height: "100%", borderRadius: "2px",
                          width: `${prog.pct}%`,
                          background: barCol,
                          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                        }} />
                      </div>
                    </div>
                    {/* Specs footer */}
                    <div style={{
                      padding: "9px 14px",
                      borderTop: `1px solid ${C.border}`,
                      background: "rgba(0,0,0,0.15)",
                      fontSize: "9px", color: C.faint, lineHeight: "1.8",
                    }}>
                      {cfg.total} frågor · {cfg.time} min<br />
                      Godkänt {cfg.passMark}/{cfg.countedQ}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ─ Alla frågor ───────────────────────────────────────────── */}
            <button
              className="home-card-5 pressable-sm"
              onClick={() => startQuiz("all")}
              style={{
                ...card, width: "100%", padding: "0",
                marginBottom: "28px", cursor: "pointer",
                display: "block", overflow: "hidden",
                transition: "border-color 0.18s, background 0.18s",
                WebkitTapHighlightColor: "transparent",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderGold; e.currentTarget.style.background = C.surfaceAlt; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}
            >
              <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", flexShrink: 0, color: C.muted,
                }}>∞</div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>Alla frågor</div>
                  <div style={{ fontSize: "10px", color: C.muted }}>
                    {QUESTIONS.length} frågor · båda delprov · ingen tidsgräns
                  </div>
                </div>
                <span style={{ color: C.faint, fontSize: "16px", lineHeight: 1 }}>›</span>
              </div>
            </button>

            {/* ─ Minnesträning / Flashcards ────────────────────────────── */}
            <div className="home-card-6" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", color: C.muted }}>
                Minnesträning
              </div>
              <div style={{ fontSize: "9px", color: C.faint }}>memorera & förstå</div>
            </div>
            <button
              id="ob-flashcards"
              className="pressable-sm"
              onClick={() => { openFlashcards(); setView("flashcard"); }}
              style={{
                ...card, width: "100%", padding: "0",
                display: "block", overflow: "hidden", cursor: "pointer",
                transition: "border-color 0.18s, background 0.18s",
                WebkitTapHighlightColor: "transparent",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderGoldStr; e.currentTarget.style.background = C.surfaceAlt; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}
            >
              <div style={{ padding: "15px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "11px",
                  background: C.goldBg, border: `1px solid ${C.borderGold}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", flexShrink: 0,
                }}>🃏</div>
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: C.text, marginBottom: "2px" }}>Flashcards</div>
                  <div style={{ fontSize: "10px", color: C.muted }}>
                    {QUESTIONS.length} kort · memorera begrepp och regler
                  </div>
                </div>
                <span style={{ color: C.faint, fontSize: "16px", lineHeight: 1 }}>›</span>
              </div>
            </button>

            {/* Version — home screen only */}
            <div style={{
              textAlign: "center", marginTop: "28px",
              fontSize: "11px", color: C.muted, opacity: 0.35, letterSpacing: "0.3px",
            }}>
              v{APP_VERSION}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            QUIZ
        ══════════════════════════════════════════════════════════════ */}
        {view === "quiz" && quiz && (() => {
          const q         = quiz.questions[quiz.current];
          const cfg       = (mode === 1 || mode === 2) ? DELPROV_CONFIG[mode] : null;
          const danger    = timeLeft !== null && timeLeft < 300;
          const modeLabel = mode === "quick" ? "Snabbprov" : mode === "focus" ? "Fokusträning" : mode === "all" ? "Alla frågor" : cfg.name;

          return (
            <div>
              {/* Top bar */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "20px",
              }}>
                <button
                  onClick={() => { clearTimeout(timer.current); setView("home"); }}
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
                  <button onClick={next}
                    className="pressable"
                    style={{
                      ...btnGold, marginTop: "16px", width: "100%", padding: "16px",
                      fontSize: "15px", boxShadow: "0 4px 24px rgba(201,168,76,0.18)",
                    }}
                  >
                    {quiz.current + 1 >= quiz.questions.length ? "Se resultat →" : "Nästa fråga →"}
                  </button>
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
                  Försök igen
                </button>
                <button onClick={() => setView("home")}
                  className="pressable-sm"
                  style={{ ...btnGhost, flex: 1, padding: "15px", fontSize: "14px", justifyContent: "center" }}>
                  Hem
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
              <button onClick={() => setView("home")} style={btnGhost}>← Hem</button>
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
                <button onClick={() => setView("home")} style={btnGhost}>← Hem</button>
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
                    if (flashIdx === qs.length - 1) { setView("home"); }
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
            STATS
        ══════════════════════════════════════════════════════════════ */}
        {view === "stats" && (
          <div style={{ animation: "screenIn 0.28s ease both" }}>

            <Label color={C.gold}>Din statistik</Label>

            {/* Summary grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "24px" }}>
              {[
                [`${acc}%`,  "Träffsäkerhet", C.gold,        "stat-card-1"],
                [tot,        "Totala försök", C.text,         "stat-card-2"],
                [corr,       "Rätta svar",    C.greenLight,   "stat-card-3"],
                [`${mastered}/${QUESTIONS.length}`, "Behärskade", "#b8a0d0", "stat-card-4"],
              ].map(([v, l, color, cn]) => (
                <div key={l} className={cn} style={{
                  ...card, padding: "18px",
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                }}>
                  <div style={{ fontSize: "30px", fontWeight: "800", color, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: "10px", color: C.muted, marginTop: "6px", fontWeight: "600", letterSpacing: "0.3px" }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>

            {/* Mastery distribution */}
            <Label>Kunskapsnivå</Label>
            <div style={{ ...card, padding: "22px 20px 16px", marginBottom: "24px" }}>
              <MasteryBar questions={QUESTIONS} getStatus={getQuestionStatus} />
            </div>

            {/* Filter + question list */}
            <Label>Frågor</Label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
              {["alla","behärskad","på väg","öva mer","ej övad"].map(f => {
                const count  = f === "alla"
                  ? QUESTIONS.length
                  : QUESTIONS.filter(q => getQuestionStatus(q) === f).length;
                const active = statusFilter === f;
                return (
                  <button key={f}
                    className="filter-chip"
                    onClick={() => setStatusFilter(f)}
                    style={{
                      padding: "7px 12px", borderRadius: "8px",
                      border: `1px solid ${active ? C.borderGold : C.border}`,
                      background: active ? C.goldBg : "transparent",
                      color: active ? C.gold : C.muted,
                      cursor: "pointer", fontSize: "12px", fontWeight: active ? "700" : "500",
                      display: "flex", alignItems: "center", gap: "5px",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {f !== "alla" && (() => {
                      const dotColor = { behärskad: C.green, "på väg": C.gold, "öva mer": C.red, "ej övad": C.faint }[f];
                      return <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />;
                    })()}
                    <span style={{ textTransform: f === "alla" ? "none" : "capitalize" }}>{f}</span>
                    <span style={{
                      background: active ? "rgba(201,168,76,0.18)" : "rgba(255,255,255,0.05)",
                      borderRadius: "10px", padding: "1px 6px",
                      fontSize: "10px", fontWeight: "700",
                      color: active ? C.gold : C.faint,
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {QUESTIONS.length === 0 ? (
              <p style={{ color: C.muted, fontSize: "13px" }}>Inga frågor inlagda än.</p>
            ) : (
              <div key={statusFilter} style={{ display: "flex", flexDirection: "column", gap: "5px", animation: "fadeIn 0.18s ease both" }}>
                {filteredQuestions.map(q => {
                  const status = getQuestionStatus(q);
                  const statusColor = {
                    "behärskad": C.greenLight,
                    "på väg":    C.gold,
                    "öva mer":   C.redLight,
                    "ej övad":   C.faint,
                  }[status];
                  return (
                    <button key={q.id} type="button"
                      className="stat-q-item"
                      onClick={() => {
                        setStatsSelected(null);
                        setStatsAnswered(false);
                        setStatsQuestion(q);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "11px 14px", ...card, borderRadius: "10px",
                        width: "100%", cursor: "pointer", textAlign: "left",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <span style={{
                        width: "7px", height: "7px", borderRadius: "50%",
                        background: statusColor, flexShrink: 0,
                      }} />
                      <span style={{ flex: 1, fontSize: "12px", color: C.textSoft, lineHeight: 1.45 }}>
                        {q.question.substring(0, 62)}...
                      </span>
                      <span style={{ fontSize: "10px", color: statusColor, whiteSpace: "nowrap", fontWeight: "600" }}>
                        {status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Reset button */}
            <div style={{ marginTop: "36px", paddingTop: "24px", borderTop: `1px solid ${C.borderSoft}`, display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => setShowResetConfirm(true)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "12px", color: C.faint, fontWeight: "500",
                  letterSpacing: "0.2px", padding: "8px 12px",
                  WebkitTapHighlightColor: "transparent",
                  transition: "color 0.15s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={e => e.currentTarget.style.color = C.red}
                onMouseLeave={e => e.currentTarget.style.color = C.faint}
              >
                Nollställ all statistik
              </button>
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
                  {/* Icon */}
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "14px",
                    background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: "18px", fontSize: "22px",
                  }}>
                    ⚠️
                  </div>

                  {/* Title */}
                  <div style={{ fontSize: "17px", fontWeight: "800", color: C.text, marginBottom: "10px", letterSpacing: "-0.2px" }}>
                    Nollställ all statistik?
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: "13px", color: C.textSoft, lineHeight: 1.6, marginBottom: "26px" }}>
                    Det här tar bort all din sparade träningsstatistik — rätta svar, felaktiga svar och din kunskapsnivå per fråga. Ditt framsteg nollställs helt och du börjar om från noll.
                    <br /><br />
                    <span style={{ color: C.muted, fontWeight: "600" }}>Det går inte att ångra.</span>
                  </div>

                  {/* Actions */}
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

            {/* Stats practice popup */}
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
                    const newC = cur.c + (ok ? 1 : 0);
                    const newW = cur.w + (ok ? 0 : 1);
                    setStatsSelected(i);
                    setStatsAnswered(true);
                    saveStat(statsQuestion.id, newC, newW);
                  }}
                  onClose={() => setStatsQuestion(null)}
                />
              </Popup>
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
            {[["home","🏠","Hem"],["quiz","⚡","Snabbprov"],["stats","📊","Statistik"]].map(([v, ico, label]) => (
              <button key={v}
                id={v === "stats" ? "ob-statistik-mobile" : undefined}
                className={`bottom-nav-btn${view === v ? " active" : ""}`}
                onClick={() => { if (v === "quiz") startQuiz("quick"); else setView(v); }}
              >
                <span className="bottom-nav-icon">{ico}</span>
                <span className="bottom-nav-label" style={{ color: view === v ? C.gold : C.muted }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}

    </div>
  );
}
