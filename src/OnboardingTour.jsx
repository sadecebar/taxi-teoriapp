import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── Design tokens (mirrors App.jsx) ─────────────────────────────────────────
const C = {
  text:     "#f1ece3",
  textSoft: "#a8a090",
  muted:    "#65605a",
  border:   "#26262b",
  gold:     "#c9a84c",
  goldLight:"#dbbe6a",
  goldDark: "#9a7a28",
};

const goldGrad = `linear-gradient(135deg, ${C.goldLight} 0%, ${C.gold} 52%, ${C.goldDark} 100%)`;

// ─── Step definitions ─────────────────────────────────────────────────────────
//
// targetId rules:
//   null  → centered bubble, full-screen dim (welcome / done steps)
//   string or string[] → spotlight that element; arrays let us resolve
//   whichever is visible (e.g. mobile bottom-nav vs desktop header-nav)
//
// All targets must exist in the DOM while view === "home":
//   • ob-snabbprov        → Snabbprov button on Home page
//   • ob-fokustranin      → Fokusträning row on Home page
//   • ob-nav-prov         → "Prov" tab in mobile bottom nav
//   • ob-nav-prov-desktop → "Prov" button in desktop header nav
//   • ob-nav-utmaningar / ob-nav-utmaningar-desktop
//   • ob-nav-fragor / ob-nav-fragor-desktop
//   • ob-nav-mer / ob-nav-mer-desktop
//
const STEPS = [
  {
    id: "welcome",
    targetId: null,
    title: "Välkommen till Taxi Teori",
    message:
      "Din kompletta studieapp för taxiförarprovet i Sverige. Låt oss ta en snabb titt på hur den är uppbyggd — det tar bara en minut.",
  },
  {
    id: "snabbprov",
    targetId: "ob-snabbprov",
    title: "Börja här — Snabbprov",
    message:
      "Väljer 15 slumpmässiga frågor från hela banken och tar ungefär fem minuter. Det här är din dagliga träning — starta gärna här varje gång.",
  },
  {
    id: "fokustranin",
    targetId: "ob-fokustranin",
    title: "Fokusträning",
    message:
      "Här samlas frågor du svarat fel på. När du har övat ett tag aktiveras det automatiskt — ett effektivt sätt att rätta till dina svagheter.",
  },
  {
    id: "prov",
    targetId: ["ob-nav-prov", "ob-nav-prov-desktop"],
    title: "Prov",
    message:
      "Fullständiga delprov med tidsgräns — precis som det riktiga testet. Delprov 1 har 70 frågor, Delprov 2 har 50. Klara båda för att certifieras.",
  },
  {
    id: "utmaningar",
    targetId: ["ob-nav-utmaningar", "ob-nav-utmaningar-desktop"],
    title: "Utmaningar",
    message:
      "Dagens fråga håller din streak vid liv — en ny fråga varje dag. Rätt i rad utmanar dig att svara korrekt så länge du kan utan ett enda fel.",
  },
  {
    id: "fragor",
    targetId: ["ob-nav-fragor", "ob-nav-fragor-desktop"],
    title: "Frågor",
    message:
      "Bläddra i hela frågebanken per kategori eller kunskapsnivå. Bokmärk frågor du vill komma tillbaka till — de samlas på ett ställe.",
  },
  {
    id: "mer",
    targetId: ["ob-nav-mer", "ob-nav-mer-desktop"],
    title: "Statistik & mer",
    message:
      "Följ din träffsäkerhet och se hur din kunskapsfördelning ser ut. Här finns även flashcards och checklistan för legitimationsansökan.",
  },
  {
    id: "done",
    targetId: null,
    title: "Du är redo att börja!",
    message:
      "Starta med ett snabbprov och bygg upp din kunskap steg för steg. Vi håller koll på framstegen hela vägen till taxikortet.",
    isFinal: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PAD = 8; // padding around spotlight

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
function useTypewriter(text, speed = 14) {
  const [shown, setShown] = useState("");
  const [done,  setDone]  = useState(false);
  const timerRef          = useRef(null);

  useEffect(() => {
    setShown("");
    setDone(false);
    if (!text) { setDone(true); return; }
    let i = 0;
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
  const DIM  = "rgba(4,4,4,0.88)";
  const BLUR = "blur(5px)";
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
      {/* Top */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: t, ...common }} />
      {/* Left */}
      <div style={{ position: "fixed", top: t, left: 0, width: l, height: b - t, ...common }} />
      {/* Right */}
      <div style={{ position: "fixed", top: t, left: r, right: 0, height: b - t, ...common }} />
      {/* Bottom */}
      <div style={{ position: "fixed", top: b, left: 0, right: 0, bottom: 0, ...common }} />
      {/* Highlight ring */}
      <div style={{
        position: "fixed",
        top: rect.top, left: rect.left,
        width: rect.width, height: rect.height,
        borderRadius: "16px",
        border: "2px solid rgba(201,168,76,0.6)",
        boxShadow: "0 0 0 1px rgba(201,168,76,0.14), inset 0 0 24px rgba(201,168,76,0.05)",
        pointerEvents: "none",
        animation: "ob-ring-in 0.26s ease both",
      }} />
    </>
  );
}

// ─── Guide bubble ─────────────────────────────────────────────────────────────
function GuideBubble({ step, rect, shown, typingDone, onAdvance, onBack, onSkip, stepKey }) {
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const W   = Math.min(340, vw - 32);
  const GAP = 12;

  // Use `position: "absolute"` inside the inset:0 fixed parent — avoids the
  // mobile-Safari bug where fixed-inside-fixed resolves % against the parent
  // compositing layer. Pixel values are identical to fixed.
  let pos = {};

  if (!rect) {
    // Centered in the usable area (below header ~60px, above bottom-nav ~78px on mobile)
    const bottomNavH      = vw <= 640 ? 78 : 0;
    const effectiveCenterY = Math.round((vh - 60 - bottomNavH) / 2) + 60;
    pos = {
      position: "absolute",
      left: Math.max(16, Math.floor((vw - W) / 2)),
      top: effectiveCenterY,
      transform: "translateY(-50%)",
      width: W,
    };
  } else {
    const cx    = rect.left + rect.width / 2;
    const bLeft = Math.max(16, Math.min(vw - W - 16, Math.round(cx - W / 2)));
    const below = vh - rect.bottom;
    const above = rect.top;

    if (below >= 180) {
      pos = { position: "absolute", left: bLeft, top: Math.round(rect.bottom + GAP), width: W };
    } else if (above >= 180) {
      pos = { position: "absolute", left: bLeft, bottom: Math.round(vh - rect.top + GAP), width: W };
    } else {
      // Nav-tab steps: not much vertical room — place above the target
      const aboveTop = Math.max(16, Math.round(rect.top - GAP - 220));
      pos = { position: "absolute", left: bLeft, top: aboveTop, width: W };
    }
  }

  return (
    <div
      key={stepKey}
      style={{
        ...pos,
        zIndex: 9002,
        background: "linear-gradient(145deg, #18181a 0%, #111113 60%, #0e0e10 100%)",
        border: "1px solid rgba(201,168,76,0.30)",
        borderRadius: "18px",
        padding: "20px 20px 16px",
        boxShadow: "0 28px 72px rgba(0,0,0,0.76), 0 0 0 1px rgba(201,168,76,0.06)",
        animation: "ob-bubble-in 0.3s cubic-bezier(0.34,1.18,0.64,1) both",
        cursor: "default",
      }}
    >
      {/* Top gold shimmer */}
      <div style={{
        position: "absolute", top: 0, left: "18%", right: "18%", height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)",
        borderRadius: "1px",
      }} />

      {/* Progress indicators + skip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: "4px",
              width: i === step ? "18px" : "4px",
              borderRadius: "3px",
              background: i === step
                ? C.gold
                : i < step
                ? "rgba(201,168,76,0.36)"
                : "rgba(255,255,255,0.08)",
              transition: "width 0.26s ease, background 0.26s ease",
            }} />
          ))}
        </div>
        <button
          onClick={onSkip}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "10px", color: C.muted, fontWeight: "600",
            letterSpacing: "0.4px", padding: "4px 8px", borderRadius: "6px",
            fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
            transition: "color 0.14s",
          }}
        >
          Hoppa över
        </button>
      </div>

      {/* Title */}
      <div style={{
        fontSize: "15px", fontWeight: "800", color: C.text,
        letterSpacing: "-0.3px", lineHeight: 1.3, marginBottom: "8px",
      }}>
        {current.title}
      </div>

      {/* Typewriter message */}
      <div style={{
        fontSize: "13px", color: C.textSoft, lineHeight: "1.68",
        marginBottom: "16px", minHeight: "52px",
      }}>
        {shown}
        {!typingDone && (
          <span style={{
            display: "inline-block",
            width: "1.5px", height: "12px",
            background: C.gold,
            marginLeft: "2px", verticalAlign: "middle",
            animation: "ob-cursor-blink 0.6s step-end infinite",
          }} />
        )}
      </div>

      {/* Action row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
        {!isFirst && !isLast ? (
          <button
            onClick={onBack}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "9px", padding: "9px 14px",
              color: C.muted, fontSize: "12px", fontWeight: "600",
              cursor: "pointer", fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
              transition: "border-color 0.14s, color 0.14s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.28)"; e.currentTarget.style.color = C.textSoft; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = C.muted; }}
          >
            ← Tillbaka
          </button>
        ) : <div />}

        <button
          onClick={(e) => { e.stopPropagation(); onAdvance(); }}
          style={{
            flex: (isFirst || isLast) ? 1 : undefined,
            padding: "10px 22px",
            borderRadius: "9px", border: "none",
            background: goldGrad,
            color: "#000", fontSize: "13px", fontWeight: "700",
            cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.1px",
            WebkitTapHighlightColor: "transparent",
            boxShadow: "0 4px 18px rgba(201,168,76,0.24)",
            transition: "opacity 0.14s, transform 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "scale(1.02)"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1";   e.currentTarget.style.transform = "scale(1)"; }}
        >
          {isLast ? "Sätt igång!" : !typingDone ? "Hoppa till nästa →" : "Nästa →"}
        </button>
      </div>

      {/* Tap hint — first step only */}
      {isFirst && (
        <div style={{
          textAlign: "center", marginTop: "11px",
          fontSize: "10px", color: C.muted, opacity: 0.55,
          letterSpacing: "0.15px",
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

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Fade out, then call parent callback.
  // Using `pointerEvents: none` during fade-out prevents double-taps on mobile
  // from re-triggering the action after the overlay has been dismissed.
  const dismiss = useCallback((cb) => {
    setClosing(true);
    // 340ms > 0.32s CSS transition — ensures GPU layer is fully composited out
    const t = setTimeout(cb, 340);
    return () => clearTimeout(t);
  }, []);

  // Measure target rect whenever step changes.
  // Bottom-nav / header-nav buttons are fixed-position so scrollIntoView is
  // a no-op for them, but we still call it for any in-page targets.
  useEffect(() => {
    const tid = STEPS[step]?.targetId;
    if (!tid) { setRect(null); return; }

    const ids = Array.isArray(tid) ? tid : [tid];
    let el = null;
    for (const id of ids) {
      const found = document.getElementById(id);
      if (found) { el = found; break; }
    }

    if (!el) { setRect(null); return; }

    // Only scroll for in-page (non-fixed) elements
    const style = window.getComputedStyle(el);
    if (style.position !== "fixed") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    let active = true;
    // Wait for scroll to settle before measuring
    const t = setTimeout(() => {
      if (active) setRect(findRect(tid));
    }, 380);

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
    e.stopPropagation();
    if (step > 0) { setStep(s => s - 1); setStepKey(k => k + 1); }
  }, [step]);

  const handleSkip = useCallback((e) => {
    e.stopPropagation();
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
        // Prevent any interaction during fade-out to avoid the "black screen"
        // issue on mobile where a tap during the dismissal animation would
        // re-fire onAdvance while the component was already unmounting.
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
