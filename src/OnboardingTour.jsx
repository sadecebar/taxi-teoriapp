import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── Design tokens (mirrors App.jsx) ─────────────────────────────────────────
const C = {
  text:          "#f2ede4",
  textSoft:      "#a8a090",
  muted:         "#686058",
  border:        "#222222",
  gold:          "#c9a84c",
  goldLight:     "#dbbe6a",
  goldDark:      "#9a7a28",
};

const goldGrad = `linear-gradient(135deg, ${C.goldLight} 0%, ${C.gold} 52%, ${C.goldDark} 100%)`;

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "welcome",
    targetId: null,
    title: "Välkommen till Taxi Teori",
    message: "Det här är din kompletta studieapp för taxiförarprovet. Låt oss ta en snabb titt på hur appen fungerar.",
  },
  {
    id: "snabbprov",
    targetId: "ob-snabbprov",
    title: "Snabbprov",
    message: "Perfekt för daglig träning. Väljer 15 slumpmässiga frågor och tar ungefär fem minuter – starta gärna här varje dag.",
  },
  {
    id: "fokustranin",
    targetId: "ob-fokustranin",
    title: "Fokusträning",
    message: "När du gjort prov samlas frågor du svarat fel på här. Öva på dem tills du bemästrar varje svag punkt.",
  },
  {
    id: "delprov1",
    targetId: "ob-delprov1",
    title: "Delprov 1 – Säkerhet & beteende",
    message: "Simulerar det riktiga provet med 70 frågor och 50 minuters tidsgräns. Godkänt kräver 48 rätt av 65.",
  },
  {
    id: "delprov2",
    targetId: "ob-delprov2",
    title: "Delprov 2 – Lagstiftning",
    message: "50 frågor om trafiklagstiftning med tidsgräns. Godkänt kräver 34 rätt av 46. Klara båda för att certifieras.",
  },
  {
    id: "statistik",
    targetId: ["ob-statistik-mobile", "ob-statistik-desktop"],
    title: "Statistik",
    message: "Följ din framgång här. Se din träffsäkerhet, din provberedskap och exakt vilka frågor du behöver öva mer.",
  },
  {
    id: "flashcards",
    targetId: "ob-flashcards",
    title: "Flashcards",
    message: "Vill du memorera begrepp snabbt? Bläddra igenom kort, vänd dem och testa din förståelse på vägen.",
  },
  {
    id: "done",
    targetId: null,
    title: "Du är redo att börja!",
    message: "Starta med ett snabbprov och bygg upp din kunskap steg för steg. Vi håller koll på din framgång hela vägen.",
    isFinal: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PAD = 10; // padding around spotlight

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
function useTypewriter(text, speed = 16) {
  const [shown, setShown]   = useState("");
  const [done, setDone]     = useState(false);
  const timerRef            = useRef(null);

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
  const DIM  = "rgba(4,4,4,0.85)";
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
        border: "2px solid rgba(201,168,76,0.55)",
        boxShadow: "0 0 0 1px rgba(201,168,76,0.12), inset 0 0 24px rgba(201,168,76,0.04)",
        pointerEvents: "none",
        animation: "ob-ring-in 0.28s ease both",
      }} />
    </>
  );
}

// ─── Guide bubble ─────────────────────────────────────────────────────────────
function GuideBubble({ step, rect, shown, typingDone, onAdvance, onBack, onSkip, stepKey }) {
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W  = Math.min(340, vw - 32);
  const GAP = 14;

  // Use `position: "absolute"` inside the inset:0 fixed parent — avoids the
  // mobile-Safari bug where fixed-inside-fixed resolves % against the parent
  // compositing layer instead of the viewport. Pixel values are identical.
  let pos = {};
  if (!rect) {
    // Center in usable area (header ~60px, mobile bottom nav ~78px)
    const bottomNavH      = vw <= 640 ? 78 : 0;
    const effectiveCenterY = Math.round((vh - bottomNavH) / 2);
    pos = {
      position: "absolute",
      left: Math.max(16, Math.floor((vw - W) / 2)),
      top: effectiveCenterY,
      transform: "translateY(-50%)",
      width: W,
    };
  } else {
    const cx     = rect.left + rect.width / 2;
    const bLeft  = Math.max(16, Math.min(vw - W - 16, Math.round(cx - W / 2)));
    const below  = vh - rect.bottom;
    const above  = rect.top;

    if (below >= 170) {
      pos = { position: "absolute", left: bLeft, top: Math.round(rect.bottom + GAP), width: W };
    } else if (above >= 170) {
      pos = { position: "absolute", left: bLeft, bottom: Math.round(vh - rect.top + GAP), width: W };
    } else {
      // Not much room — place below anyway, clamped
      pos = { position: "absolute", left: bLeft, top: Math.min(Math.round(rect.bottom + GAP), vh - 210), width: W };
    }
  }

  return (
    <div
      key={stepKey}
      style={{
        ...pos,
        zIndex: 9002,
        background: "linear-gradient(145deg, #181815 0%, #111110 60%, #0e0e0c 100%)",
        border: "1px solid rgba(201,168,76,0.32)",
        borderRadius: "18px",
        padding: "20px 20px 16px",
        boxShadow: "0 28px 72px rgba(0,0,0,0.72), 0 0 0 1px rgba(201,168,76,0.06)",
        animation: "ob-bubble-in 0.3s cubic-bezier(0.34,1.18,0.64,1) both",
        cursor: "default",
      }}
    >
      {/* Top gold accent */}
      <div style={{
        position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.55), transparent)",
      }} />

      {/* Progress dots + skip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: "5px",
              width: i === step ? "20px" : "5px",
              borderRadius: "3px",
              background: i === step
                ? C.gold
                : i < step
                ? "rgba(201,168,76,0.38)"
                : "rgba(255,255,255,0.09)",
              transition: "width 0.28s ease, background 0.28s ease",
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
            transition: "color 0.14s, background 0.14s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = C.textSoft; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.muted;    e.currentTarget.style.background = "none"; }}
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
              background: "none", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "9px", padding: "8px 14px",
              color: C.muted, fontSize: "12px", fontWeight: "600",
              cursor: "pointer", fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
              transition: "border-color 0.14s, color 0.14s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)"; e.currentTarget.style.color = C.textSoft; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = C.muted; }}
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
            boxShadow: "0 4px 18px rgba(201,168,76,0.26)",
            transition: "opacity 0.14s, transform 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "scale(1.02)"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1";   e.currentTarget.style.transform = "scale(1)"; }}
        >
          {isLast ? "Sätt igång!" : !typingDone ? "Hoppa till nästa →" : "Nästa →"}
        </button>
      </div>

      {/* Tap hint – first step only */}
      {isFirst && (
        <div style={{
          textAlign: "center", marginTop: "11px",
          fontSize: "10px", color: C.muted, opacity: 0.6,
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

  // Fade out then call parent — prevents backdrop-filter GPU layer from
  // persisting on mobile Safari/Chrome after the portal is removed from DOM.
  const dismiss = useCallback((cb) => {
    setClosing(true);
    const t = setTimeout(cb, 340); // slightly longer than the 0.32s CSS transition
    return () => clearTimeout(t);
  }, []);

  // Scroll target into view + measure its rect
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

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    let active = true;
    const t = setTimeout(() => {
      if (active) setRect(findRect(tid));
    }, 360);

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

  // Advance / complete typing
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
