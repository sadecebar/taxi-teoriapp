import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";
import { QUESTIONS as importedQuestions } from "./questions.js";

function Logo({ size = 42 }) {
  return (
    <img
      src={import.meta.env.BASE_URL + 'icon-180.png'}
      alt="Taxi Teori"
      style={{width:size,height:size,borderRadius:Math.round(size*0.22),display:"block",flexShrink:0,objectFit:"cover"}}
    />
  );
}


// ─── FRÅGOR ──────────────────────────────────────────────────────────────────
const QUESTIONS = [

];

const DELPROV_CONFIG = {
  1: { name:"Delprov 1", sub:"Säkerhet & beteende", total:70, countedQ:65, passMark:48, time:50 },
  2: { name:"Delprov 2", sub:"Lagstiftning", total:50, countedQ:46, passMark:34, time:50 },
};

// ─── FÄRGER (matchar logon: svart, guld, silver/vit) ─────────────────────────
const C = {
  bg:        "#0c0c0c",
  surface:   "#191919",
  surfaceAlt:"#222",
  border:    "#2c2c2c",
  borderGold:"rgba(180,140,30,0.35)",
  text:      "#ffffff",
  textSoft:  "#d0c8b8",
  muted:     "#888070",
  faint:     "#444",
  gold:      "#c9a84c",
  goldLight: "#e8c96a",
  goldDark:  "#9a7a28",
  silver:    "#c8c8c8",
  silverDim: "#888",
  green:     "#5a9e5a",
  greenBg:   "rgba(90,158,90,0.14)",
  greenBorder:"rgba(90,158,90,0.3)",
  red:       "#b85050",
  redBg:     "rgba(184,80,80,0.14)",
  redBorder: "rgba(184,80,80,0.3)",
};

function fmt(s) {
  return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

export default function App() {
  const [view,        setView]       = useState("home");
  const [mode,        setMode]       = useState(null);
  const [quiz,        setQuiz]       = useState(null);
  const [timeLeft,    setTimeLeft]   = useState(null);
  const [flashIdx,    setFlashIdx]   = useState(0);
  const [flipped,     setFlipped]    = useState(false);
  const [result,      setResult]     = useState(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [stats,       setStats]      = useState(() =>
    Object.fromEntries(QUESTIONS.map(q => [q.id, { c:0, w:0 }]))
  );
  const timer      = useRef(null);
  const explainRef = useRef(null);
  const audioCtx   = useRef(null);

  // ── Load stats from Supabase on mount ──────────────────────────────────────
  useEffect(() => {
    async function loadStats() {
      try {
        const { data, error } = await supabase.from('stats').select('*');
        if (error) throw error;
        if (data && data.length > 0) {
          const merged = Object.fromEntries(QUESTIONS.map(q => [q.id, { c:0, w:0 }]));
          data.forEach(row => {
            if (merged[row.question_id] !== undefined) {
              merged[row.question_id] = { c: row.correct, w: row.wrong };
            }
          });
          setStats(merged);
        }
      } catch (e) {
        console.error('Could not load stats:', e);
      } finally {
        setStatsLoaded(true);
      }
    }
    loadStats();
  }, []);

  // ── Save a single question stat to Supabase ─────────────────────────────────
  const saveStat = async (questionId, correct, wrong) => {
    try {
      await supabase.from('stats').upsert(
        { question_id: questionId, correct, wrong, updated_at: new Date().toISOString() },
        { onConflict: 'question_id' }
      );
    } catch (e) {
      console.error('Could not save stat:', e);
    }
  };

  const playPling = () => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      // Short double-tap vibration for correct
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } catch(e) {}
  };

  const playBuzz = () => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
      // Long harsh vibration for wrong
      if (navigator.vibrate) navigator.vibrate([180]);
    } catch(e) {}
  };

  // Scroll to explanation + next button when answer is given
  useEffect(() => {
    if (quiz?.answered !== null && quiz?.answered !== undefined && explainRef.current) {
      setTimeout(() => {
        explainRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 180);
    }
  }, [quiz?.answered]);

  useEffect(() => {
    if (view === "quiz" && timeLeft !== null) {
      if (timeLeft <= 0) { endQuiz(quiz.answers); return; }
      timer.current = setTimeout(() => setTimeLeft(t => t-1), 1000);
    }
    return () => clearTimeout(timer.current);
  }, [view, timeLeft]);

  const getQs = (m) => m==="all"||m==="quick" ? QUESTIONS : QUESTIONS.filter(q=>q.delprov===m);

  const startQuiz = (m) => {
    clearTimeout(timer.current);
    if (QUESTIONS.length === 0) return;
    let qs = [...getQs(m)].sort(() => Math.random()-0.5);
    if (m==="quick") qs = qs.slice(0,15);
    const t = (m===1||m===2) ? DELPROV_CONFIG[m].time*60 : null;
    setMode(m); setQuiz({questions:qs,current:0,answers:[],answered:null});
    setTimeLeft(t); setResult(null); setView("quiz");
  };

  const [shakeBtn,   setShakeBtn]   = useState(null);
  const [popupQ,     setPopupQ]     = useState(null); // question object for result popup

  const answer = (i) => {
    if (quiz.answered !== null) return;
    const correct = quiz.questions[quiz.current].correct;
    if (i === correct) {
      playPling();
    } else {
      playBuzz();
      setShakeBtn(i);
      setTimeout(() => setShakeBtn(null), 500);
    }
    setQuiz(q => ({ ...q, answered: i }));
  };

  const next = () => {
    const q   = quiz.questions[quiz.current];
    const ok  = quiz.answered===q.correct;
    const ans = [...quiz.answers,{id:q.id,correct:ok,chosen:quiz.answered,q}];
    const newC = stats[q.id].c + (ok?1:0);
    const newW = stats[q.id].w + (ok?0:1);
    setStats(s=>({...s,[q.id]:{c:newC,w:newW}}));
    saveStat(q.id, newC, newW);
    if(quiz.current+1>=quiz.questions.length) endQuiz(ans);
    else setQuiz(s=>({...s,current:s.current+1,answers:ans,answered:null}));
  };

  const endQuiz = (answers) => {
    clearTimeout(timer.current);
    setResult({score:answers.filter(a=>a.correct).length,total:answers.length,answers,mode,expired:timeLeft===0});
    setView("result");
  };

  const tot      = Object.values(stats).reduce((a,b)=>a+b.c+b.w,0);
  const corr     = Object.values(stats).reduce((a,b)=>a+b.c,0);
  const acc      = tot>0?Math.round(corr/tot*100):0;
  const mastered = Object.values(stats).filter(s=>s.c>=2&&s.w===0).length;

  const goldGrad = `linear-gradient(135deg,${C.goldLight},${C.goldDark})`;
  const card     = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:"12px" };
  const btnGhost = { background:"transparent", border:`1px solid ${C.border}`, color:C.muted, padding:"7px 13px", borderRadius:"7px", cursor:"pointer", fontSize:"12px" };
  const btnGold  = { background:goldGrad, border:"none", borderRadius:"10px", fontWeight:"700", color:"#111", cursor:"pointer" };

  // ── Loading screen while fetching stats ──────────────────────────────────
  if (!statsLoaded) {
    return (
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
        <Logo size={72}/>
        <div style={{marginTop:"20px",fontSize:"13px",color:C.muted,letterSpacing:"2px",textTransform:"uppercase"}}>Laddar...</div>
        <div style={{marginTop:"12px",width:"48px",height:"3px",background:C.border,borderRadius:"2px",overflow:"hidden"}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${C.gold},${C.goldLight})`,borderRadius:"2px",animation:"loadBar 1.2s ease-in-out infinite"}}/>
        </div>
        <style>{`@keyframes loadBar{0%{width:0%;margin-left:0}50%{width:100%;margin-left:0}100%{width:0%;margin-left:100%}}`}</style>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* Subtle noise texture */}
      <div style={{position:"fixed",inset:0,opacity:0.025,
        backgroundImage:"radial-gradient(circle,#c9a84c 1px,transparent 1px)",
        backgroundSize:"28px 28px",pointerEvents:"none"}}/>

      {/* Gold bottom glow like the logo */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"60%",height:"2px",background:`linear-gradient(90deg,transparent,${C.gold},transparent)`,
        opacity:0.4,pointerEvents:"none"}}/>

      {/* ── HEADER ── */}
      <header style={{
        background:"linear-gradient(180deg,#1a1a1a 0%,#111 100%)",
        borderBottom:`1px solid ${C.borderGold}`,
        padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,zIndex:10,
        boxShadow:"0 2px 20px rgba(0,0,0,0.6)"
      }}>
        <div style={{display:"flex",alignItems:"center",gap:"11px",cursor:"pointer"}} onClick={()=>setView("home")}>
          <Logo size={42}/>
          <div>
            <div style={{fontSize:"17px",fontWeight:"700",color:C.silver,letterSpacing:"2px",textTransform:"uppercase"}}>Taxi Teori</div>
            <div style={{fontSize:"9px",color:C.gold,letterSpacing:"2px",textTransform:"uppercase",marginTop:"1px"}}>Studieapp</div>
          </div>
        </div>
        <nav style={{display:"flex",gap:"5px"}}>
          {[["home","🏠"],["flashcard","🃏"],["stats","📊"]].map(([v,ico])=>(
            <button key={v} onClick={()=>setView(v)} style={{
              padding:"7px 12px",borderRadius:"7px",border:`1px solid ${view===v?C.borderGold:C.border}`,
              cursor:"pointer",fontSize:"15px",transition:"all 0.15s",
              background:view===v?`rgba(201,168,76,0.12)`:"transparent",
              color:view===v?C.gold:C.silverDim
            }}>{ico}</button>
          ))}
        </nav>
      </header>

      <main style={{maxWidth:"660px",margin:"0 auto",padding:"24px 16px"}}>

        {/* ════ HOME ════ */}
        {view==="home"&&(
          <div>
            <div style={{textAlign:"center",marginBottom:"28px",paddingTop:"4px"}}>
              <Logo size={88}/>
              <h1 style={{fontSize:"24px",fontWeight:"700",color:C.silver,margin:"0 0 4px",letterSpacing:"1px"}}>Taxi Teori</h1>
              <p style={{color:C.muted,margin:0,fontSize:"13px"}}>
                {QUESTIONS.length===0?"⚠️ Inga frågor inlagda än":`${QUESTIONS.length} frågor inlagda`}
              </p>
            </div>

            {/* Quick quiz */}
            <button onClick={()=>startQuiz("quick")} style={{
              ...btnGold,width:"100%",padding:"17px 16px",marginBottom:"14px",
              display:"flex",alignItems:"center",gap:"14px",textAlign:"left",fontSize:"14px",
              boxShadow:`0 4px 20px rgba(201,168,76,0.2)`
            }}>
              <span style={{fontSize:"26px"}}>⚡</span>
              <div>
                <div style={{fontSize:"15px",fontWeight:"700",color:"#111"}}>Snabbprov</div>
                <div style={{fontSize:"11px",fontWeight:"500",color:"rgba(0,0,0,0.55)",marginTop:"2px"}}>15 slumpmässiga frågor • ingen tid</div>
              </div>
            </button>

            {/* Exam sims */}
            <Label c={C.muted}>🎯 Provsimulering med tid</Label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"10px"}}>
              {[1,2].map(dp=>{
                const cfg=DELPROV_CONFIG[dp];
                return(
                  <button key={dp} onClick={()=>startQuiz(dp)} style={{
                    ...card,padding:"16px 14px",cursor:"pointer",textAlign:"left",transition:"all 0.18s",display:"block"
                  }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.background=C.surfaceAlt;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surface;}}>
                    <div style={{fontSize:"18px",marginBottom:"8px"}}>🎯</div>
                    <div style={{fontSize:"12px",fontWeight:"700",color:C.gold,marginBottom:"2px"}}>{cfg.name}</div>
                    <div style={{fontSize:"11px",color:C.muted,marginBottom:"6px"}}>{cfg.sub}</div>
                    <div style={{fontSize:"10px",color:C.faint,lineHeight:"1.9"}}>
                      {cfg.total} frågor • {cfg.time} min<br/>
                      Godkänt: {cfg.passMark}/{cfg.countedQ} rätt
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={()=>startQuiz("all")} style={{
              ...card,width:"100%",padding:"12px",cursor:"pointer",color:C.muted,
              fontSize:"13px",marginBottom:"26px",display:"block",textAlign:"center",transition:"all 0.18s"
            }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.borderGold}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
              Alla frågor – utan tidsgräns
            </button>

            {/* Flashcards */}
            <Label c={C.muted}>🃏 Flashcards</Label>
            <button onClick={()=>{setFlashIdx(0);setFlipped(false);setView("flashcard");}} style={{
              ...card,width:"100%",padding:"16px",cursor:"pointer",
              display:"flex",alignItems:"center",gap:"14px",marginBottom:"26px",transition:"all 0.18s"
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.background=C.surfaceAlt;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surface;}}>
              <span style={{fontSize:"24px"}}>🃏</span>
              <div>
                <div style={{fontSize:"14px",fontWeight:"700",color:C.silver}}>Alla flashcards</div>
                <div style={{fontSize:"11px",color:C.muted,marginTop:"2px"}}>{QUESTIONS.length} kort • alla delprov blandade</div>
              </div>
            </button>

            {/* Stats row */}
            <div style={{...card,borderColor:C.borderGold,padding:"16px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",textAlign:"center"}}>
              {[[`${acc}%`,"Träffsäkerhet"],[tot,"Svarade"],[`${mastered}/${QUESTIONS.length}`,"Behärskade"]].map(([v,l])=>(
                <div key={l}>
                  <div style={{fontSize:"20px",fontWeight:"700",color:C.gold}}>{v}</div>
                  <div style={{fontSize:"10px",color:C.muted,marginTop:"2px"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ QUIZ ════ */}
        {view==="quiz"&&quiz&&(()=>{
          const q=quiz.questions[quiz.current];
          const cfg=(mode===1||mode===2)?DELPROV_CONFIG[mode]:null;
          const danger=timeLeft!==null&&timeLeft<300;
          const modeLabel=mode==="quick"?"Snabbprov":mode==="all"?"Alla frågor":cfg.name;
          return(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                <button onClick={()=>{clearTimeout(timer.current);setView("home");}} style={btnGhost}>← Avbryt</button>
                <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
                  {timeLeft!==null&&(
                    <div style={{fontSize:"18px",fontWeight:"700",color:danger?C.red:C.silver,fontVariantNumeric:"tabular-nums",transition:"color 0.4s"}}>
                      ⏱ {fmt(timeLeft)}
                    </div>
                  )}
                  <div style={{fontSize:"12px",color:C.muted}}>
                    <span style={{color:C.gold,fontWeight:"700"}}>{quiz.current+1}</span>/{quiz.questions.length}
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div style={{height:"2px",background:C.border,borderRadius:"2px",marginBottom:"20px"}}>
                <div style={{height:"100%",background:goldGrad,borderRadius:"2px",
                  width:`${(quiz.current/quiz.questions.length)*100}%`,transition:"width 0.3s"}}/>
              </div>

              <div style={{fontSize:"10px",letterSpacing:"1.5px",color:C.gold,marginBottom:"10px",textTransform:"uppercase",fontWeight:"600"}}>{modeLabel}</div>

              {/* Question image if present */}
              {q.image && <img src={q.image} alt="" style={{width:"100%",borderRadius:"10px",marginBottom:"16px",border:`1px solid ${C.border}`}}/>}

              <h2 style={{fontSize:"17px",lineHeight:"1.75",marginBottom:"22px",color:C.text,fontWeight:"600"}}>{q.question}</h2>

              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {q.options.map((opt,i)=>{
                  let bg=C.surface,border=`1px solid ${C.border}`,col=C.textSoft;
                  if(quiz.answered!==null){
                    if(i===q.correct){bg=C.greenBg;border=`1px solid ${C.green}`;col="#8fcc8f";}
                    else if(i===quiz.answered){bg=C.redBg;border=`1px solid ${C.red}`;col="#cc8080";}
                  }
                  return(
                    <button key={i} onClick={()=>answer(i)} style={{
                      background:bg,border,borderRadius:"10px",padding:"13px 15px",
                      color:col,fontSize:"14px",textAlign:"left",
                      cursor:quiz.answered!==null?"default":"pointer",
                      transition:"background 0.18s, border-color 0.18s, color 0.18s",
                      display:"flex",alignItems:"center",gap:"10px",fontFamily:"inherit",
                      animation: shakeBtn===i ? "shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97) both" : "none"
                    }}>
                      <span style={{width:"24px",height:"24px",borderRadius:"50%",
                        background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:"11px",fontWeight:"700",flexShrink:0,color:C.silverDim}}>
                        {["A","B","C","D"][i]}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {quiz.answered!==null&&(
                <div ref={explainRef} style={{
                  animation:"popIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both"
                }}>
                  {q.explanation&&(
                    <div style={{marginTop:"16px",padding:"13px 15px",
                      background:"rgba(201,168,76,0.07)",borderRadius:"10px",
                      borderLeft:`3px solid ${C.gold}`}}>
                      <div style={{fontSize:"9px",letterSpacing:"2px",color:C.gold,marginBottom:"5px",fontWeight:"700"}}>FÖRKLARING</div>
                      <p style={{color:C.textSoft,fontSize:"13px",lineHeight:"1.65",margin:0}}>{q.explanation}</p>
                    </div>
                  )}
                  <button onClick={next} style={{
                    ...btnGold,marginTop:"14px",width:"100%",padding:"14px",fontSize:"14px",
                    boxShadow:`0 4px 16px rgba(201,168,76,0.2)`
                  }}>
                    {quiz.current+1>=quiz.questions.length?"Se resultat →":"Nästa fråga →"}
                  </button>
                </div>
              )}
              <style>{`
                @keyframes popIn {
                  0%   { opacity:0; transform: translateY(22px) scale(0.95); }
                  60%  { opacity:1; transform: translateY(-4px)  scale(1.02); }
                  100% { opacity:1; transform: translateY(0)      scale(1);   }
                }
                @keyframes shake {
                  0%,100% { transform: translateX(0); }
                  15%     { transform: translateX(-7px); }
                  30%     { transform: translateX(7px); }
                  45%     { transform: translateX(-5px); }
                  60%     { transform: translateX(5px); }
                  75%     { transform: translateX(-3px); }
                  90%     { transform: translateX(3px); }
                }
              `}</style>
            </div>
          );
        })()}

        {/* ════ RESULT ════ */}
        {view==="result"&&result&&(()=>{
          const cfg=(result.mode===1||result.mode===2)?DELPROV_CONFIG[result.mode]:null;
          const pct=Math.round(result.score/result.total*100);
          const passed=cfg?result.score>=cfg.passMark:pct>=70;
          return(
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"52px",marginBottom:"10px"}}>{passed?"🏆":result.expired?"⏰":"📖"}</div>
              <h2 style={{fontSize:"22px",fontWeight:"700",color:passed?C.gold:C.red,marginBottom:"4px"}}>{passed?"Godkänt!":"Underkänt"}</h2>
              {result.expired&&<p style={{color:C.red,fontSize:"13px",margin:"0 0 8px"}}>Tiden tog slut</p>}
              <div style={{fontSize:"44px",fontWeight:"700",color:C.silver,marginBottom:"4px"}}>
                {result.score}<span style={{fontSize:"20px",color:C.muted}}>/{result.total}</span>
              </div>
              <div style={{color:C.muted,marginBottom:"6px",fontSize:"14px"}}>{pct}% rätt</div>
              {cfg&&<div style={{fontSize:"12px",color:C.muted,marginBottom:"20px"}}>
                Godkändgräns: <span style={{color:C.gold,fontWeight:"700"}}>{cfg.passMark} rätt av {cfg.countedQ}</span>
              </div>}

              <div style={{display:"flex",flexDirection:"column",gap:"5px",marginBottom:"20px",textAlign:"left"}}>
                {result.answers.map((a,i)=>(
                  <button key={i} onClick={()=>setPopupQ({...a.q, chosen: a.chosen})} style={{
                    display:"flex",alignItems:"center",gap:"9px",padding:"9px 12px",
                    background:a.correct?C.greenBg:C.redBg,
                    border:`1px solid ${a.correct?C.greenBorder:C.redBorder}`,
                    borderRadius:"8px",cursor:"pointer",textAlign:"left",width:"100%",
                    fontFamily:"inherit",transition:"opacity 0.15s"
                  }}>
                    <span style={{flexShrink:0}}>{a.correct?"✅":"❌"}</span>
                    <span style={{fontSize:"11px",color:C.textSoft,flex:1}}>{a.q.question.substring(0,62)}...</span>
                    <span style={{fontSize:"11px",color:C.faint,flexShrink:0}}>👁</span>
                  </button>
                ))}
              </div>

              <div style={{display:"flex",gap:"10px"}}>
                <button onClick={()=>startQuiz(result.mode)} style={{...btnGold,flex:1,padding:"13px",fontSize:"13px"}}>Försök igen</button>
                <button onClick={()=>setView("home")} style={{...btnGhost,flex:1,padding:"13px",fontSize:"13px"}}>Hem</button>
              </div>

              {/* ── QUESTION POPUP ── */}
              {popupQ&&(
                <div onClick={()=>setPopupQ(null)} style={{
                  position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
                  display:"flex",alignItems:"flex-end",justifyContent:"center",
                  zIndex:100,backdropFilter:"blur(4px)",
                  animation:"fadeIn 0.2s ease both"
                }}>
                  <div onClick={e=>e.stopPropagation()} style={{
                    background:"#1a1a1a",borderRadius:"20px 20px 0 0",
                    border:`1px solid ${C.borderGold}`,borderBottom:"none",
                    padding:"24px 20px 40px",width:"100%",maxWidth:"660px",
                    animation:"slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1) both"
                  }}>
                    {/* Handle bar */}
                    <div style={{width:"40px",height:"4px",background:C.border,borderRadius:"2px",margin:"0 auto 20px",cursor:"pointer"}} onClick={()=>setPopupQ(null)}/>
                    
                    {/* Image if available */}
                    {popupQ.image&&<img src={popupQ.image} alt="" style={{width:"100%",borderRadius:"10px",marginBottom:"14px",border:`1px solid ${C.border}`}}/>}
                    
                    {/* Question */}
                    <p style={{fontSize:"16px",fontWeight:"600",color:C.text,lineHeight:"1.65",marginBottom:"16px"}}>{popupQ.question}</p>
                    
                    {/* All options */}
                    <div style={{display:"flex",flexDirection:"column",gap:"7px",marginBottom:"16px"}}>
                      {popupQ.options.map((opt,i)=>{
                        const isCorrect = i===popupQ.correct;
                        const isChosen  = i===popupQ.chosen && !isCorrect;
                        return(
                          <div key={i} style={{
                            display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",
                            background:isCorrect?C.greenBg:isChosen?C.redBg:"transparent",
                            border:`1px solid ${isCorrect?C.green:isChosen?C.red:C.border}`,
                            borderRadius:"8px"
                          }}>
                            <span style={{width:"22px",height:"22px",borderRadius:"50%",
                              background:isCorrect?"rgba(90,158,90,0.3)":isChosen?"rgba(184,80,80,0.3)":"rgba(255,255,255,0.05)",
                              display:"flex",alignItems:"center",justifyContent:"center",
                              fontSize:"10px",fontWeight:"700",flexShrink:0,
                              color:isCorrect?"#8fcc8f":isChosen?"#cc8080":C.silverDim}}>
                              {["A","B","C","D"][i]}
                            </span>
                            <span style={{fontSize:"13px",color:isCorrect?"#8fcc8f":isChosen?"#cc8080":C.muted,flex:1}}>{opt}</span>
                            {isCorrect&&<span style={{fontSize:"13px",color:"#8fcc8f"}}>✓ Rätt</span>}
                            {isChosen &&<span style={{fontSize:"13px",color:"#cc8080"}}>✗ Ditt svar</span>}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Explanation */}
                    {popupQ.explanation&&(
                      <div style={{padding:"12px 14px",background:"rgba(201,168,76,0.07)",borderRadius:"10px",borderLeft:`3px solid ${C.gold}`}}>
                        <div style={{fontSize:"9px",letterSpacing:"2px",color:C.gold,marginBottom:"5px",fontWeight:"700"}}>FÖRKLARING</div>
                        <p style={{color:C.textSoft,fontSize:"13px",lineHeight:"1.65",margin:0}}>{popupQ.explanation}</p>
                      </div>
                    )}
                    
                    <button onClick={()=>setPopupQ(null)} style={{
                      ...btnGold,width:"100%",padding:"13px",fontSize:"14px",marginTop:"16px"
                    }}>Stäng</button>
                  </div>
                </div>
              )}
              <style>{`
                @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
                @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
              `}</style>
            </div>
          );
        })()}

        {/* ════ FLASHCARD ════ */}
        {view==="flashcard"&&(()=>{
          const qs=QUESTIONS;
          if(qs.length===0) return(
            <div style={{textAlign:"center",paddingTop:"60px"}}>
              <div style={{fontSize:"48px",marginBottom:"12px"}}>📭</div>
              <p style={{color:C.muted}}>Inga frågor inlagda än</p>
              <button onClick={()=>setView("home")} style={{...btnGhost,marginTop:"10px"}}>← Hem</button>
            </div>
          );
          const q=qs[flashIdx];
          const dpLabel=DELPROV_CONFIG[q.delprov];
          return(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                <button onClick={()=>setView("home")} style={btnGhost}>← Hem</button>
                <div style={{fontSize:"12px",color:C.muted}}>
                  <span style={{color:C.gold,fontWeight:"700"}}>{flashIdx+1}</span>/{qs.length}
                </div>
              </div>

              <div style={{height:"2px",background:C.border,borderRadius:"2px",marginBottom:"20px"}}>
                <div style={{height:"100%",background:goldGrad,borderRadius:"2px",
                  width:`${((flashIdx+1)/qs.length)*100}%`,transition:"width 0.3s"}}/>
              </div>

              <div style={{fontSize:"10px",letterSpacing:"1.5px",color:C.gold,marginBottom:"10px",textTransform:"uppercase",fontWeight:"600"}}>
                {dpLabel.name} – {dpLabel.sub}
              </div>

              {/* Card */}
              <div onClick={()=>setFlipped(f=>!f)} style={{
                minHeight:"230px",borderRadius:"14px",padding:"26px 22px",cursor:"pointer",
                background:flipped?"rgba(201,168,76,0.07)":C.surface,
                border:`1px solid ${flipped?C.borderGold:C.border}`,
                transition:"all 0.25s",display:"flex",flexDirection:"column",
                justifyContent:"center",textAlign:"center",marginBottom:"14px",
                boxShadow:flipped?`0 0 20px rgba(201,168,76,0.1)`:"none"
              }}>
                <div style={{fontSize:"9px",letterSpacing:"2px",color:flipped?C.gold:C.faint,
                  marginBottom:"14px",textTransform:"uppercase",fontWeight:"600"}}>
                  {flipped?"SVAR":"FRÅGA – tryck för att vända"}
                </div>
                {/* Show image if available */}
                {!flipped&&q.image&&<img src={q.image} alt="" style={{width:"100%",borderRadius:"8px",marginBottom:"12px",border:`1px solid ${C.border}`}}/>}
                {!flipped
                  ?<p style={{fontSize:"16px",lineHeight:"1.7",color:C.text,margin:0}}>{q.question}</p>
                  :<div>
                    <p style={{fontSize:"15px",fontWeight:"700",color:"#8fcc8f",marginBottom:"12px"}}>✓ {q.options[q.correct]}</p>
                    {q.explanation&&<p style={{fontSize:"13px",color:C.textSoft,lineHeight:"1.65",margin:0}}>{q.explanation}</p>}
                  </div>
                }
              </div>

              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={()=>{setFlashIdx(i=>Math.max(0,i-1));setFlipped(false);}}
                  disabled={flashIdx===0} style={{flex:1,padding:"12px",background:"transparent",
                    border:`1px solid ${C.border}`,borderRadius:"10px",
                    color:flashIdx===0?C.faint:C.muted,cursor:flashIdx===0?"default":"pointer",fontSize:"18px"}}>←</button>
                <button onClick={()=>setFlipped(f=>!f)} style={{flex:2,padding:"12px",
                  background:"rgba(201,168,76,0.09)",border:`1px solid ${C.borderGold}`,
                  borderRadius:"10px",color:C.gold,cursor:"pointer",fontSize:"12px",fontWeight:"700"}}>
                  Vänd 🔄
                </button>
                <button onClick={()=>{setFlashIdx(i=>Math.min(qs.length-1,i+1));setFlipped(false);}}
                  disabled={flashIdx===qs.length-1} style={{flex:1,padding:"12px",background:"transparent",
                    border:`1px solid ${C.border}`,borderRadius:"10px",
                    color:flashIdx===qs.length-1?C.faint:C.muted,cursor:flashIdx===qs.length-1?"default":"pointer",fontSize:"18px"}}>→</button>
              </div>
            </div>
          );
        })()}

        {/* ════ STATS ════ */}
        {view==="stats"&&(
          <div>
            <h2 style={{fontSize:"20px",fontWeight:"700",color:C.silver,marginBottom:"18px"}}>📊 Din statistik</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",marginBottom:"20px"}}>
              {[[`${acc}%`,"Träffsäkerhet",C.gold],[tot,"Totala svar",C.silver],[corr,"Rätt svar","#8fcc8f"],[`${mastered}/${QUESTIONS.length}`,"Behärskade","#b8a0d0"]].map(([v,l,c])=>(
                <div key={l} style={{...card,padding:"15px",textAlign:"center"}}>
                  <div style={{fontSize:"26px",fontWeight:"700",color:c}}>{v}</div>
                  <div style={{fontSize:"10px",color:C.muted,marginTop:"3px"}}>{l}</div>
                </div>
              ))}
            </div>
            <Label c={C.muted}>Frågor per status</Label>
            {QUESTIONS.length===0
              ?<p style={{color:C.muted,fontSize:"13px"}}>Inga frågor inlagda än.</p>
              :<div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
                {QUESTIONS.map(q=>{
                  const s=stats[q.id]||{c:0,w:0};
                  const att=s.c+s.w;
                  const status=att===0?"ej övad":s.c>=2&&s.w===0?"behärskad":s.c>s.w?"på väg":"öva mer";
                  const col={behärskad:"#8fcc8f","på väg":C.gold,"öva mer":C.red,"ej övad":C.faint}[status];
                  return(
                    <div key={q.id} style={{display:"flex",alignItems:"center",gap:"8px",
                      padding:"9px 12px",...card,borderRadius:"8px"}}>
                      <span style={{width:"6px",height:"6px",borderRadius:"50%",background:col,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:"11px",color:C.textSoft}}>{q.question.substring(0,56)}...</span>
                      <span style={{fontSize:"10px",color:col,whiteSpace:"nowrap"}}>{status}</span>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        )}
      </main>
    </div>
  );
}

function Label({children,c}){
  return <div style={{fontSize:"9px",letterSpacing:"2px",color:c||"#888",marginBottom:"10px",textTransform:"uppercase",fontWeight:"600"}}>{children}</div>;
}