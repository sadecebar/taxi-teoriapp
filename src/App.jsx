import { useState, useEffect, useRef } from "react";
import "./App.css";
import { supabase } from "./supabase.js";
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
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
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
    </div>
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
 * Mastery distribution bar — shows breakdown of all questions by status.
 * A premium visual element that no basic quiz app has.
 */
function MasteryBar({ questions, getStatus }) {
  if (!questions.length) return null;

  const counts  = { "ej övad": 0, "öva mer": 0, "på väg": 0, "behärskad": 0 };
  questions.forEach(q => counts[getStatus(q)]++);

  const segments = [
    { key: "ej övad",   color: "#303030", label: "Ej övad" },
    { key: "öva mer",   color: C.red,     label: "Öva mer" },
    { key: "på väg",    color: C.gold,    label: "På väg" },
    { key: "behärskad", color: C.green,   label: "Behärskad" },
  ];

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Bar */}
      <div style={{
        display: "flex", height: "5px", borderRadius: "5px",
        overflow: "hidden", gap: "2px", background: C.border,
      }}>
        {segments.map(seg =>
          counts[seg.key] > 0 && (
            <div key={seg.key} style={{
              flex: counts[seg.key],
              background: seg.color,
              minWidth: "4px",
            }} />
          )
        )}
      </div>

      {/* Legend row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)",
        marginTop: "12px", gap: "4px",
      }}>
        {segments.map(seg => {
          const n     = counts[seg.key];
          const color = n > 0 ? (seg.key === "ej övad" ? C.muted : seg.color) : C.faint;
          return (
            <div key={seg.key} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "16px", fontWeight: "700", color, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: "9px", color: C.muted, marginTop: "4px", letterSpacing: "0.2px" }}>
                {seg.label}
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
  WebkitTapHighlightColor: "transparent", transition: "border-color 0.15s",
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
  const [statsLoaded,   setStatsLoaded]   = useState(false);
  const [statusFilter,  setStatusFilter]  = useState("alla");
  const [stats,         setStats]         = useState(() =>
    Object.fromEntries(QUESTIONS.map(q => [q.id, { c: 0, w: 0 }]))
  );
  const [shakeBtn,      setShakeBtn]      = useState(null);
  const [popupQ,        setPopupQ]        = useState(null);
  const [statsQuestion, setStatsQuestion] = useState(null);
  const [statsSelected, setStatsSelected] = useState(null);
  const [statsAnswered, setStatsAnswered] = useState(false);

  const timer      = useRef(null);
  const explainRef = useRef(null);
  const audioCtx   = useRef(null);

  // ── Load stats from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    async function loadStats() {
      try {
        const { data, error } = await supabase.from("stats").select("*");
        if (error) throw error;
        if (data && data.length > 0) {
          const merged = Object.fromEntries(QUESTIONS.map(q => [q.id, { c: 0, w: 0 }]));
          data.forEach(row => {
            if (merged[row.question_id] !== undefined)
              merged[row.question_id] = { c: row.correct, w: row.wrong };
          });
          setStats(merged);
        }
      } catch (e) {
        console.error("Could not load stats:", e);
      } finally {
        setStatsLoaded(true);
      }
    }
    loadStats();
  }, []);

  // ── Persist a single question stat ───────────────────────────────────────
  const saveStat = async (questionId, correct, wrong) => {
    try {
      await supabase.from("stats").upsert(
        { question_id: questionId, correct, wrong, updated_at: new Date().toISOString() },
        { onConflict: "question_id" }
      );
    } catch (e) {
      console.error("Could not save stat:", e);
    }
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
  const getQs = (m) => (m === "all" || m === "quick") ? QUESTIONS : QUESTIONS.filter(q => q.delprov === m);

  const startQuiz = (m) => {
    clearTimeout(timer.current);
    if (QUESTIONS.length === 0) return;
    let qs = [...getQs(m)].sort(() => Math.random() - 0.5);
    if (m === "quick") qs = qs.slice(0, 15);
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
    setStats(s => ({ ...s, [q.id]: { c: newC, w: newW } }));
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
  const mastered = Object.values(stats).filter(s => s.c >= 2 && s.w === 0).length;

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
        height: "54px",
        background: "rgba(9,9,9,0.94)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "0 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <button
          onClick={() => setView("home")}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <Logo size={32} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "13px", fontWeight: "800", color: C.text, letterSpacing: "1.5px", textTransform: "uppercase", lineHeight: 1.2 }}>
              Taxi Teori
            </div>
            <div style={{ fontSize: "8px", fontWeight: "600", color: C.gold, letterSpacing: "2.5px", textTransform: "uppercase" }}>
              Studieapp
            </div>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="header-nav">
          {[["home","🏠","Hem"],["flashcard","🃏","Flashcards"],["stats","📊","Statistik"]].map(([v, ico, label]) => (
            <button key={v}
              onClick={() => { if (v === "flashcard") openFlashcards(); setView(v); }}
              style={{
                padding: "6px 12px", borderRadius: "8px",
                border: `1px solid ${view === v ? C.borderGold : "transparent"}`,
                cursor: "pointer", fontSize: "12px", fontWeight: "600",
                background: view === v ? C.goldBg : "transparent",
                color: view === v ? C.gold : C.muted,
                display: "flex", alignItems: "center", gap: "6px",
                transition: "all 0.14s", WebkitTapHighlightColor: "transparent",
              }}
            >
              <span>{ico}</span>
              <span>{label}</span>
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
              <div style={{
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
            ) : (
              /* Returning user — readiness dashboard */
              <div style={{
                ...card,
                borderColor: C.borderGold,
                padding: "24px",
                marginBottom: "20px",
                background: "linear-gradient(135deg, rgba(201,168,76,0.05) 0%, transparent 100%)",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, right: 0, width: "160px", height: "160px",
                  background: "radial-gradient(circle at top right, rgba(201,168,76,0.1) 0%, transparent 65%)",
                  pointerEvents: "none",
                }} />

                <Label color={C.gold}>Provberedskap</Label>

                {/* Big accuracy number */}
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "18px" }}>
                  <span style={{ fontSize: "60px", fontWeight: "800", color: C.text, lineHeight: 1, letterSpacing: "-2px" }}>
                    {acc}
                  </span>
                  <span style={{ fontSize: "28px", fontWeight: "700", color: C.gold }}>%</span>
                  <span style={{ fontSize: "12px", color: C.muted, marginLeft: "6px" }}>träffsäkerhet</span>
                </div>

                {/* Compact stats row */}
                <div style={{
                  display: "flex", gap: "0",
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: "16px",
                }}>
                  {[
                    [`${mastered}/${QUESTIONS.length}`, "Behärskade"],
                    [tot,                               "Försök"],
                    [QUESTIONS.length,                  "Frågor"],
                  ].map(([v, l], idx) => (
                    <div key={l} style={{
                      flex: 1, textAlign: "center",
                      borderRight: idx < 2 ? `1px solid ${C.border}` : "none",
                    }}>
                      <div style={{ fontSize: "18px", fontWeight: "700", color: C.text, lineHeight: 1 }}>{v}</div>
                      <div style={{ fontSize: "10px", color: C.muted, marginTop: "4px" }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─ Primary CTA ──────────────────────────────────────────── */}
            <button
              onClick={() => startQuiz("quick")}
              style={{
                ...btnGold, width: "100%", padding: "20px 22px",
                marginBottom: "20px", justifyContent: "flex-start", gap: "16px",
                boxShadow: "0 6px 32px rgba(201,168,76,0.18)",
              }}
            >
              <div style={{
                width: "42px", height: "42px", borderRadius: "12px",
                background: "rgba(0,0,0,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px", flexShrink: 0,
              }}>
                ⚡
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#080808", lineHeight: 1.1 }}>
                  Snabbprov
                </div>
                <div style={{ fontSize: "11px", color: "rgba(0,0,0,0.45)", marginTop: "3px", fontWeight: "500" }}>
                  15 slumpmässiga frågor · ingen tidsgräns
                </div>
              </div>
              <span style={{ color: "rgba(0,0,0,0.35)", fontSize: "18px", lineHeight: 1 }}>→</span>
            </button>

            {/* ─ Exam simulations ─────────────────────────────────────── */}
            <Label>Provsimulering</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              {[1, 2].map(dp => {
                const cfg = DELPROV_CONFIG[dp];
                return (
                  <button key={dp} onClick={() => startQuiz(dp)}
                    style={{
                      ...card, padding: "18px 16px", cursor: "pointer",
                      textAlign: "left", transition: "border-color 0.18s, background 0.18s",
                      display: "block", WebkitTapHighlightColor: "transparent",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = C.surfaceAlt; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}
                  >
                    <div style={{ fontSize: "18px", marginBottom: "10px" }}>🎯</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: C.gold, marginBottom: "3px" }}>
                      {cfg.name}
                    </div>
                    <div style={{ fontSize: "11px", color: C.muted, marginBottom: "10px" }}>
                      {cfg.sub}
                    </div>
                    <div style={{
                      fontSize: "10px", color: C.faint, lineHeight: "1.9",
                      paddingTop: "10px", borderTop: `1px solid ${C.borderSoft}`,
                    }}>
                      {cfg.total} frågor · {cfg.time} min<br />
                      Godkänt: {cfg.passMark} av {cfg.countedQ}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => startQuiz("all")}
              style={{
                ...card, width: "100%", padding: "14px 18px", cursor: "pointer",
                color: C.muted, fontSize: "13px", fontWeight: "500",
                marginBottom: "24px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "border-color 0.18s", WebkitTapHighlightColor: "transparent",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.borderGold}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              <span style={{ fontSize: "14px", lineHeight: 1 }}>∞</span>
              <span>Alla frågor – utan tidsgräns</span>
            </button>

            {/* ─ Flashcards ───────────────────────────────────────────── */}
            <Label>Lärande</Label>
            <button
              onClick={() => { openFlashcards(); setView("flashcard"); }}
              style={{
                ...card, width: "100%", padding: "16px 18px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "14px",
                transition: "border-color 0.18s, background 0.18s",
                WebkitTapHighlightColor: "transparent",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = C.surfaceAlt; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}
            >
              <div style={{
                width: "40px", height: "40px", borderRadius: "11px",
                background: C.goldBg, border: `1px solid ${C.borderGold}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "18px", flexShrink: 0,
              }}>
                🃏
              </div>
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: "700", color: C.text }}>Flashcards</div>
                <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>
                  {QUESTIONS.length} kort · alla kategorier
                </div>
              </div>
              <span style={{ color: C.muted, fontSize: "16px", lineHeight: 1 }}>›</span>
            </button>

            {/* Version — home screen only */}
            <div style={{
              textAlign: "center", marginTop: "24px",
              fontSize: "11px", color: C.muted, opacity: 0.45, letterSpacing: "0.3px",
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
          const modeLabel = mode === "quick" ? "Snabbprov" : mode === "all" ? "Alla frågor" : cfg.name;

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
                    <button key={i} onClick={() => answer(i)}
                      style={{
                        background: s.bg, border: `1px solid ${s.brd}`, borderRadius: "12px",
                        padding: "14px 15px", color: s.col,
                        fontSize: "14px", fontWeight: "500", textAlign: "left",
                        cursor: quiz.answered !== null ? "default" : "pointer",
                        transition: "all 0.2s",
                        display: "flex", alignItems: "center", gap: "12px",
                        animation: shakeBtn === i ? "shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97) both" : "none",
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
                    onClick={() => setPopupQ({ ...a.q, chosen: a.chosen })}
                    style={{
                      display: "flex", alignItems: "center", gap: "11px",
                      padding: "11px 14px",
                      background: a.correct ? C.greenBg : C.redBg,
                      border: `1px solid ${a.correct ? C.greenBorder : C.redBorder}`,
                      borderRadius: "11px", cursor: "pointer",
                      width: "100%", textAlign: "left",
                      transition: "opacity 0.14s",
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
                  style={{ ...btnGold, flex: 1, padding: "15px", fontSize: "14px" }}>
                  Försök igen
                </button>
                <button onClick={() => setView("home")}
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
                [`${acc}%`,  "Träffsäkerhet", C.gold],
                [tot,        "Totala försök", C.text],
                [corr,       "Rätta svar",    C.greenLight],
                [`${mastered}/${QUESTIONS.length}`, "Behärskade", "#b8a0d0"],
              ].map(([v, l, color]) => (
                <div key={l} style={{
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
            <div style={{ ...card, padding: "18px", marginBottom: "24px" }}>
              <MasteryBar questions={QUESTIONS} getStatus={getQuestionStatus} />
            </div>

            {/* Filter + question list */}
            <Label>Frågor</Label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
              {["alla","ej övad","öva mer","på väg","behärskad"].map(f => {
                const count  = f === "alla"
                  ? QUESTIONS.length
                  : QUESTIONS.filter(q => getQuestionStatus(q) === f).length;
                const active = statusFilter === f;
                return (
                  <button key={f} onClick={() => setStatusFilter(f)}
                    style={{
                      padding: "7px 12px", borderRadius: "8px",
                      border: `1px solid ${active ? C.borderGold : C.border}`,
                      background: active ? C.goldBg : "transparent",
                      color: active ? C.gold : C.muted,
                      cursor: "pointer", fontSize: "12px", fontWeight: active ? "700" : "500",
                      display: "flex", alignItems: "center", gap: "5px",
                      WebkitTapHighlightColor: "transparent",
                      transition: "all 0.14s",
                    }}
                  >
                    <span>{f}</span>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
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
                        transition: "border-color 0.14s",
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
                    setStats(prev => ({ ...prev, [statsQuestion.id]: { c: newC, w: newW } }));
                    saveStat(statsQuestion.id, newC, newW);
                  }}
                  onClose={() => setStatsQuestion(null)}
                />
              </Popup>
            )}
          </div>
        )}
      </main>

      {/* ── BOTTOM NAV (mobile only) ─────────────────────────────────────── */}
      {showBottomNav && (
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            {[["home","🏠","Hem"],["flashcard","🃏","Kort"],["stats","📊","Statistik"]].map(([v, ico, label]) => (
              <button key={v}
                className={`bottom-nav-btn${view === v ? " active" : ""}`}
                onClick={() => { if (v === "flashcard") openFlashcards(); setView(v); }}
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
