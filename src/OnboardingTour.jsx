import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── Design tokens — kept in sync with App.jsx ────────────────────────────────
const C = {
  text:      "#F2ECE4",
  textSoft:  "#A8A9C0",
  muted:     "#666880",
  faint:     "#252538",
  surface:   "#141421",
  border:    "rgba(255,255,255,0.08)",
  gold:      "#F0A500",
  goldLight: "#FFBE2E",
  goldDark:  "#B07800",
};

const goldGrad = `linear-gradient(135deg, ${C.goldLight} 0%, ${C.gold} 52%, ${C.goldDark} 100%)`;

// ─── Step definitions ──────────────────────────────────────────────────────────
//
// targetId rules:
//   null       → centered bubble, full-screen dim (welcome / done steps)
//   string     → spotlight that element
//   string[]   → try each id in order, spotlight the first visible one
//
// Spotlight targets available in the DOM while view === "home":
//   ob-snabbprov       → Snabbprov CTA on Home (always visible)
//   ob-dagensfraga     → Dagens fråga card on Home (always visible)
//   ob-nav-prov        → "Prov" bottom-nav tab (mobile)
//   ob-nav-prov-desktop→ "Prov" header-nav button (desktop)
//   ob-nav-fragor / ob-nav-fragor-desktop
//   ob-nav-utmaningar / ob-nav-utmaningar-desktop
//   ob-nav-mer / ob-nav-mer-desktop
//
const STEPS = [
  {
    id: "welcome",
    targetId: null,
    title: "Välkommen till Taxi Teori",
    message:
      "Din strukturerade studieapp för taxiförarprovet. Vi visar dig de viktigaste delarna snabbt — det tar bara en minut.",
  },
  {
    id: "snabbprov",
    targetId: "ob-snabbprov",
    title: "Börja här — Snabbprov",
    message:
      "15 slumpade frågor, runt fem minuter. Det här är din dagliga träning. Starta ett par gånger om dagen så byggs kunskapen upp stadigt.",
  },
  {
    id: "dagensfraga",
    targetId: "ob-dagensfraga",
    title: "Dagens fråga",
    message:
      "En ny fråga varje dag. Svara rätt varje dag och bygg upp din streak — ett enkelt sätt att skapa ett konsekvent studievanor.",
  },
  {
    id: "prov",
    targetId: ["ob-nav-prov", "ob-nav-prov-desktop"],
    title: "Prov — testa din beredskap",
    message:
      "Öva med fullständiga delprov i exakt samma format som det riktiga taxiprovet — tidsgräns, frågeantal, allt. Bra att köra när du känner dig redo.",
  },
  {
    id: "fragor",
    targetId: ["ob-nav-fragor", "ob-nav-fragor-desktop"],
    title: "Frågor — studiehuben",
    message:
      "Bläddra per ämne, fokusera på felaktiga svar, eller träna på det du behärskar minst. Spara frågor du vill återkomma till med bokmärket.",
  },
  {
    id: "utmaningar",
    targetId: ["ob-nav-utmaningar", "ob-nav-utmaningar-desktop"],
    title: "Utmaningar",
    message:
      "Tre kortare träningsformat: Dagens fråga, Rätt i rad (svara rätt utan ett enda fel), och Bildutmaning. Perfekt för snabb träning.",
  },
  {
    id: "mer",
    targetId: ["ob-nav-mer", "ob-nav-mer-desktop"],
    title: "Mer — översikt och verktyg",
    message:
      "Din statistik och kunskapsfördelning, flashcards, och checklistan för legitimationsansökan. Allt samlat på ett ställe.",
  },
  {
    id: "done",
    targetId: null,
    title: "Du är redo att börja",
    message:
      "Starta med ett Snabbprov — det tar fem minuter och visar direkt var du landar. Lycka till med studierna.",
    isFinal: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PAD = 8; // padding around spotlight ring

function findRect(targetId) {
  const ids = Array.isArray(targetId) ? targetId : targetId ? [targetId] : [];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return {
        top:    r.top    - PAD,
        left:   r.left   - PAD,
        right:  r.right  + PAD,
        bottom: r.bottom + PAD,
        width:  r.width  + PAD * 2,
        height: r.height + PAD * 2,
      };
    }
  }
  return null;
}

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(text, speed = 13) {
  const [shown, setShown] = useState("");
  const [done,  setDone]  = useState(false);
  const timerRef          = useRef(null);

  useEffect(() => {
    setShown("");
    setDone(false);
    if (!text) { setDone(true); return; }
    let i      = 0;
    let active = true;
    const tick = () => {
      if (!active) return;
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) { setDone(true); return; }
      timerRef.current = setTimeout(tick, speed);
    };
    timerRef.current = setTimeout(tick, speed);
    return () => { active = false; clearTimeout(timerRef.current); };
  }, [text, speed]);

  const complete = useCallback(() => {
    clearTimeout(timerRef.current);
    setShown(text);
    setDone(true);
  }, [text]);

  return { shown, done, complete };
}

// ─── Spotlight overlay ────────────────────────────────────────────────────────
function Spotlight({ rect }) {
  const DIM    = "rgba(5,5,8,0.90)";
  const BLUR   = "blur(4px)";
  const common = { backdropFilter: BLUR, WebkitBackdropFilter: BLUR, background: DIM };

  if (!rect) {
    return <div style={{ position: "fixed", inset: 0, ...common }} />;
  }

  const t = Math.max(0, rect.top);
  const l = Math.max(0, rect.left);
  const r = Math.max(0, rect.right);
  const b = Math.max(0, rect.bottom);

  return (
    <>
      <div style={{ position: "fixed", top: 0,    left: 0, right: 0,      height: t,     ...common }} />
      <div style={{ position: "fixed", top: t,    left: 0, width: l,      height: b - t, ...common }} />
      <div style={{ position: "fixed", top: t,    left: r, right: 0,      height: b - t, ...common }} />
      <div style={{ position: "fixed", top: b,    left: 0, right: 0,      bottom: 0,     ...common }} />
      {/* Spotlight ring */}
      <div style={{
        position: "fixed",
        top: rect.top, left: rect.left,
        width: rect.width, height: rect.height,
        borderRadius: "18px",
        border: "1.5px solid rgba(240,165,0,0.55)",
        boxShadow: "0 0 0 1px rgba(240,165,0,0.10), inset 0 0 20px rgba(240,165,0,0.04)",
        pointerEvents: "none",
        animation: "ob-ring-in 0.24s ease both",
      }} />
    </>
  );
}

// ─── Guide bubble ─────────────────────────────────────────────────────────────
function GuideBubble({ step, rect, shown, typingDone, onAdvance, onBack, onSkip, stepKey }) {
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;
  const total   = STEPS.length;

  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const W   = Math.min(330, vw - 32);
  const GAP = 14;

  let pos = {};

  if (!rect) {
    // Centered between header and bottom nav
    const bottomNavH       = vw <= 640 ? 80 : 0;
    const effectiveCenterY = Math.round((vh - 60 - bottomNavH) / 2) + 60;
    pos = {
      position: "absolute",
      left:  Math.max(16, Math.floor((vw - W) / 2)),
      top:   effectiveCenterY,
      transform: "translateY(-50%)",
      width: W,
    };
  } else {
    const cx    = rect.left + rect.width / 2;
    const bLeft = Math.max(16, Math.min(vw - W - 16, Math.round(cx - W / 2)));
    const below = vh - rect.bottom;
    const above = rect.top;

    if (below >= 200) {
      pos = { position: "absolute", left: bLeft, top: Math.round(rect.bottom + GAP), width: W };
    } else if (above >= 200) {
      pos = { position: "absolute", left: bLeft, bottom: Math.round(vh - rect.top + GAP), width: W };
    } else {
      // Nav-tab or tight space: place above the nav bar
      const aboveTop = Math.max(16, Math.round(rect.top - GAP - 240));
      pos = { position: "absolute", left: bLeft, top: aboveTop, width: W };
    }
  }

  return (
    <div
      key={stepKey}
      onClick={e => e.stopPropagation()}
      style={{
        ...pos,
        zIndex: 9002,
        background: "linear-gradient(160deg, #1A1A26 0%, #131320 70%, #0F0F1C 100%)",
        border: "1px solid rgba(240,165,0,0.24)",
        borderRadius: "20px",
        padding: "18px 18px 14px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.80), 0 0 0 1px rgba(240,165,0,0.05)",
        animation: "ob-bubble-in 0.28s cubic-bezier(0.34,1.18,0.64,1) both",
        cursor: "default",
      }}
    >
      {/* Top shimmer line */}
      <div style={{
        position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(240,165,0,0.45), transparent)",
        borderRadius: "1px",
      }} />

      {/* Progress bar + skip row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        {/* Step bars */}
        <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: "3px",
              width:  i === step ? "20px" : "4px",
              borderRadius: "2px",
              background: i === step
                ? C.gold
                : i < step
                  ? "rgba(240,165,0,0.32)"
                  : "rgba(255,255,255,0.07)",
              transition: "width 0.22s ease, background 0.22s ease",
            }} />
          ))}
        </div>

        {/* Step counter + skip */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "9px", color: C.muted, fontFamily: "'DM Mono', monospace", letterSpacing: "0.4px" }}>
            {step + 1}/{total}
          </span>
          <button
            onClick={onSkip}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "10px", color: C.muted, fontWeight: "600",
              letterSpacing: "0.3px", padding: "3px 6px", borderRadius: "5px",
              fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
            }}
          >
            Hoppa över
          </button>
        </div>
      </div>

      {/* Title */}
      <div style={{
        fontSize: "15px", fontWeight: "800", color: C.text,
        letterSpacing: "-0.3px", lineHeight: 1.25, marginBottom: "7px",
      }}>
        {current.title}
      </div>

      {/* Typewriter message */}
      <div style={{
        fontSize: "13px", color: C.textSoft, lineHeight: "1.65",
        marginBottom: "15px", minHeight: "58px",
      }}>
        {shown}
        {!typingDone && (
          <span style={{
            display: "inline-block",
            width: "1.5px", height: "12px",
            background: C.gold,
            marginLeft: "2px", verticalAlign: "middle",
            animation: "ob-cursor-blink 0.55s step-end infinite",
          }} />
        )}
      </div>

      {/* Action row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {(!isFirst && !isLast) ? (
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "10px", padding: "9px 14px",
              color: C.muted, fontSize: "12px", fontWeight: "600",
              cursor: "pointer", fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
              flexShrink: 0,
            }}
          >
            ← Tillbaka
          </button>
        ) : <div />}

        <button
          onClick={(e) => { e.stopPropagation(); onAdvance(); }}
          style={{
            flex: (isFirst || isLast) ? 1 : undefined,
            padding: "10px 20px",
            borderRadius: "10px", border: "none",
            background: goldGrad,
            color: "#09090E", fontSize: "13px", fontWeight: "700",
            cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.1px",
            WebkitTapHighlightColor: "transparent",
            boxShadow: "0 4px 16px rgba(240,165,0,0.26)",
            minWidth: "80px",
          }}
        >
          {isLast
            ? "Sätt igång!"
            : !typingDone
              ? "Hoppa till nästa →"
              : "Nästa →"}
        </button>
      </div>

      {/* Tap hint — first step only */}
      {isFirst && (
        <div style={{
          textAlign: "center", marginTop: "10px",
          fontSize: "10px", color: C.muted, opacity: 0.5,
          letterSpacing: "0.1px",
        }}>
          Tryck var som helst för att gå vidare
        </div>
      )}
    </div>
  );
}

// ─── OnboardingTour ───────────────────────────────────────────────────────────
export default function OnboardingTour({ onComplete, onSkip }) {
  const [step,    setStep]    = useState(0);
  const [rect,    setRect]    = useState(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [stepKey, setStepKey] = useState(0);

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  const { shown, done: typingDone, complete: completeTyping } = useTypewriter(current.message);

  // Fade in on mount (small delay lets the portal paint before animating)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Fade out then hand off to parent.
  // pointerEvents: none during fade prevents a second tap from re-firing.
  const dimissTimer = useRef(null);
  const dismiss = useCallback((cb) => {
    setClosing(true);
    clearTimeout(dimissTimer.current);
    dimissTimer.current = setTimeout(cb, 340); // 340ms > 0.32s CSS transition
  }, []);

  // Clean up dismiss timer on unmount
  useEffect(() => () => clearTimeout(dimissTimer.current), []);

  // Measure target rect whenever step changes.
  useEffect(() => {
    const tid = STEPS[step]?.targetId;
    if (!tid) { setRect(null); return; }

    const ids = Array.isArray(tid) ? tid : [tid];
    let el    = null;
    for (const id of ids) {
      const found = document.getElementById(id);
      if (found) { el = found; break; }
    }

    if (!el) { setRect(null); return; }

    // Scroll into view only for non-fixed elements
    const style = window.getComputedStyle(el);
    if (style.position !== "fixed") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    let active = true;
    const t = setTimeout(() => {
      if (active) setRect(findRect(tid));
    }, 360); // wait for scroll to settle

    return () => { active = false; clearTimeout(t); };
  }, [step]);

  // Re-measure on resize
  useEffect(() => {
    const onResize = () => {
      const tid = STEPS[step]?.targetId;
      if (tid) setRect(findRect(tid));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [step]);

  const advance = useCallback(() => {
    if (!typingDone) { completeTyping(); return; }
    if (isLast) { dismiss(onComplete); return; }
    setStep(s => s + 1);
    setStepKey(k => k + 1);
  }, [typingDone, completeTyping, isLast, onComplete, dismiss]);

  const goBack = useCallback((e) => {
    e?.stopPropagation();
    if (step > 0) { setStep(s => s - 1); setStepKey(k => k + 1); }
  }, [step]);

  const handleSkip = useCallback((e) => {
    e?.stopPropagation();
    dismiss(onSkip);
  }, [onSkip, dismiss]);

  return createPortal(
    <div
      onClick={advance}
      style={{
        position: "fixed", inset: 0,
        zIndex: 9000,
        cursor: closing ? "default" : "pointer",
        opacity: closing ? 0 : visible ? 1 : 0,
        transition: "opacity 0.32s ease",
        // Prevent any interaction during fade-out — this is the key fix for
        // the "black screen / stuck overlay" issue on mobile where a tap
        // during the dismissal animation re-fires while the component is
        // already in the process of unmounting.
        pointerEvents: closing ? "none" : "auto",
      }}
    >
      <Spotlight rect={rect} />

      <GuideBubble
        step={step}
        rect={rect}
        shown={shown}
        typingDone={typingDone}
        onAdvance={advance}
        onBack={goBack}
        onSkip={handleSkip}
        stepKey={stepKey}
      />
    </div>,
    document.body
  );
}
