import { memo, useEffect, useRef, useState } from 'react';
import { motion as Motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CaretRight, Check, X, MagnifyingGlassPlus, Minus, Plus, MapPin, SteeringWheel } from '@phosphor-icons/react';
import { useStudy } from './context.jsx';

export function IconButton({ icon: Icon, label, onClick, active, ...props }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`grid size-11 shrink-0 place-items-center rounded-full border ${active ? 'border-accent bg-tint text-accent' : 'border-line bg-paper text-ink'}`} {...props}><Icon size={22} weight="regular" /></button>;
}
export function Button({ children, onClick, secondary, className = '', ...props }) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const reduced = useReducedMotion();
  return <Motion.button type="button" style={{ x, y }} onPointerMove={e => {
    if (reduced || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * .025); y.set((e.clientY - r.top - r.height / 2) * .045);
  }} onPointerLeave={() => {x.set(0);y.set(0);}} onClick={onClick} whileTap={reduced ? undefined : { scale: .98 }} transition={{type:'spring', stiffness:100, damping:20}}
    className={`inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[calc(0.9375rem*var(--text-scale))] font-medium disabled:opacity-40 ${secondary ? 'border border-line bg-paper text-ink' : 'bg-[var(--action)] text-[var(--on-action)]'} ${className}`} {...props}>{children}</Motion.button>;
}
export function ScreenTitle({ eyebrow, title, back, action }) {
  return <header className="mb-7 flex items-start justify-between gap-3"><div className="flex items-center gap-3">{back && <IconButton icon={ArrowLeft} label={back.label} onClick={back.action} />}<div>{eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-[.16em] text-muted">{eyebrow}</p>}<h1 className="text-[calc(2rem*var(--text-scale))] leading-[1.12] font-medium tracking-[-.035em]">{title}</h1></div></div>{action}</header>;
}
export function SectionTitle({ children, action, onClick }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xl font-medium tracking-tight">{children}</h2>{action && <button type="button" className="min-h-11 flex items-center gap-1 text-sm font-medium text-accent" onClick={onClick}>{action}<CaretRight size={15}/></button>}</div>;
}
export function ProgressBar({ value, label }) {
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-1.5 overflow-hidden rounded-full bg-soft"><div className="h-full origin-left rounded-full bg-accent" style={{transform:`scaleX(${Math.min(100, Math.max(0,value))/100})`}} /></div>;
}
export function Ring({ value, size = 96, children }) {
  const r = 42, c = 2*Math.PI*r;
  return <div className="progress-ring relative shrink-0" style={{width:size,height:size}}><svg aria-hidden="true" viewBox="0 0 100 100" className="size-full -rotate-90"><circle cx="50" cy="50" r={r} fill="none" stroke="var(--soft)" strokeWidth="5"/><circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * value / 100} ${c}`}/></svg><div className="absolute inset-0 grid place-content-center text-center">{children ?? <span className="text-xl font-medium">{value}%</span>}</div></div>;
}
export function Row({ icon: Icon, title, subtitle, onClick, end, danger = false }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-4 py-4 text-left ${danger?'text-danger':''}`}><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-soft"><Icon size={23} /></span><span className="min-w-0 flex-1"><span className="block font-medium leading-snug">{title}</span>{subtitle && <span className="mt-1 block text-sm leading-snug text-muted">{subtitle}</span>}</span>{end ?? <CaretRight size={18} className="shrink-0 text-muted"/>}</button>;
}
export function Empty({ icon: Icon = SteeringWheel, title, body, action, onClick }) {
  return <div className="py-12 text-center"><span className="mx-auto mb-5 grid size-20 place-items-center rounded-[28px] bg-tint text-accent"><Icon size={36}/></span><h2 className="text-xl font-medium">{title}</h2><p className="mx-auto mt-2 max-w-70 text-sm leading-relaxed text-muted">{body}</p>{action && <Button className="mt-6" onClick={onClick}>{action}<ArrowRight size={18}/></Button>}</div>;
}
export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null), latestClose = useRef(onClose);
  useEffect(() => { latestClose.current = onClose; }, [onClose]);
  const { l } = useStudy();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector('h2')?.focus({preventScroll:true});
    const onBack = e => {
      const dialogs = document.querySelectorAll('dialog[open]');
      if (dialogs[dialogs.length - 1] !== dialog) return;
      e.preventDefault(); latestClose.current();
    };
    document.addEventListener('taxi-native-back', onBack);
    return () => {
      document.removeEventListener('taxi-native-back',onBack);
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({preventScroll:true});
    };
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={e => {e.preventDefault();onClose();}} onClick={e => { if (e.target === e.currentTarget) onClose(); }} className={`w-[calc(100%-32px)] overflow-y-auto rounded-[28px] border border-line bg-paper p-0 text-ink shadow-xl ${wide?'max-w-2xl':'max-w-lg'}`}><div className="p-5 sm:p-7"><div className="mb-5 flex items-center justify-between gap-4"><h2 tabIndex={-1} autoFocus className="text-xl font-medium">{title}</h2><IconButton icon={X} label={l('Stäng','Close')} onClick={onClose}/></div>{children}</div></dialog>;
}
export function QuestionImage({ src }) {
  const [open, setOpen] = useState(false), [zoom, setZoom] = useState(1), [error, setError] = useState(false);
  const { l } = useStudy();
  if (!src) return null;
  if (error) return <div role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">{l('Bilden kunde inte visas.','The image could not be loaded.')}<button className="ml-3 min-h-11 underline" onClick={()=>setError(false)}>{l('Försök igen','Try again')}</button></div>;
  return <><button type="button" onClick={() => {setZoom(1);setOpen(true);}} className="relative block w-full overflow-hidden rounded-[22px] border border-line bg-white p-2" aria-label={l('Förstora frågebild','Enlarge question image')}><img src={src} alt={l('Bild till frågan','Question illustration')} onError={()=>setError(true)} className="quiz-picture"/><span className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-paper text-ink shadow-sm"><MagnifyingGlassPlus size={20}/></span></button>
    {open && <Modal wide title={l('Frågebild','Question image')} onClose={()=>setOpen(false)}><div tabIndex={0} role="region" aria-label={l("Förstorad bild, rulla för att se hela bilden","Enlarged image, scroll to see the whole image")} className="max-h-[60dvh] overflow-auto rounded-xl bg-white"><img src={src} alt={l('Förstorad frågebild','Enlarged question image')} style={{width:`${zoom*100}%`,maxWidth:'none'}} onDoubleClick={()=>setZoom(zoom===1?2:1)}/></div><div className="mt-4 flex items-center justify-center gap-5"><IconButton icon={Minus} label={l('Förminska','Zoom out')} disabled={zoom===1} onClick={()=>setZoom(Math.max(1,zoom-.5))}/><span role="status" aria-label={l("Förstoring","Zoom")} className="font-mono text-sm">{Math.round(zoom*100)}%</span><IconButton icon={Plus} label={l('Förstora','Zoom in')} disabled={zoom===4} onClick={()=>setZoom(Math.min(4,zoom+.5))}/></div></Modal>}
  </>;
}
export const RouteArt = memo(function RouteArt({ compact = false }) {
  const reduced = useReducedMotion();
  return <div aria-hidden="true" className={`relative ${compact?'h-35 w-35':'h-48 w-44'} pointer-events-none shrink-0`}>
    <svg viewBox="0 0 220 240" className="hero-map size-full"><g fill="var(--map-block)" stroke="var(--map-edge)" strokeWidth="1"><rect x="5" y="12" width="63" height="53" rx="12"/><rect x="91" y="8" width="116" height="60" rx="12"/><rect x="152" y="96" width="65" height="112" rx="14"/><rect x="3" y="148" width="85" height="77" rx="12"/></g><path d="M-8 111H92Q119 111 119 138V250" fill="none" stroke="var(--map-road)" strokeWidth="36"/><path d="M-8 111H92Q119 111 119 138V250" fill="none" stroke="var(--map-mark)" strokeWidth="2" strokeDasharray="7 8"/><path d="M34 211V182Q34 164 55 164H90Q118 164 118 137V58" fill="none" stroke="var(--hero-action)" strokeWidth="5" strokeLinecap="round"/><circle cx="118" cy="57" r="10" fill="var(--hero-action)"/><circle cx="118" cy="57" r="4" fill="var(--hero-bg)"/><g transform="translate(13 189) rotate(-10 20 15)"><rect width="39" height="25" rx="8" fill="var(--map-car)"/><rect x="10" y="4" width="17" height="17" rx="4" fill="var(--map-window)"/><rect x="15" y="8" width="7" height="9" rx="2" fill="var(--hero-action)"/></g></svg>
    <Motion.span className="absolute top-4 right-9 grid size-10 place-items-center rounded-2xl bg-[var(--hero-action)] text-[var(--hero-bg)] shadow-lg" animate={reduced?{}:{y:[0,-4,0]}} transition={{duration:4,repeat:Infinity,ease:'easeInOut'}}><MapPin size={23}/></Motion.span>
  </div>;
});
export function Toggle({ label, checked, onChange, icon: Icon }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={()=>onChange(!checked)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">{Icon && <Icon size={23} className="text-muted"/>}<span className="flex-1">{label}</span><span className={`flex h-7 w-12 items-center rounded-full p-1 ${checked?'bg-accent':'bg-soft border border-line'}`}><span className={`size-5 rounded-full ${checked?'translate-x-5 bg-canvas':'bg-muted'}`}/></span></button>;
}
export function AnswerOptions({ q, selected, reveal, onSelect, disabled }) {
  const { l } = useStudy();
  return <div className="space-y-2.5">{q.options.map((option,i) => {
    const correct = reveal && i===q.correct, wrong = reveal && i===selected && i!==q.correct;
    return <button type="button" key={i} aria-pressed={selected===i} disabled={disabled} onClick={()=>onSelect(i)} className={`flex min-h-16 w-full items-center gap-3 rounded-[18px] border px-4 py-3.5 text-left text-[calc(0.9375rem*var(--text-scale))] leading-relaxed ${correct?'border-[var(--success)] bg-[var(--success-soft)]':wrong?'border-danger bg-danger-soft':selected===i?'border-accent bg-tint':'border-line bg-paper'}`}><span className={`grid size-8 shrink-0 place-items-center rounded-xl text-xs font-medium ${correct?'bg-[var(--success)] text-[var(--on-success)]':wrong?'bg-danger text-canvas':'bg-soft text-muted'}`}>{correct?<Check size={18}/>:wrong?<X size={18}/>:String.fromCharCode(65+i)}</span><span className="flex-1">{option}</span>{correct && <span className="sr-only">{l('Rätt svar','Correct answer')}</span>}{wrong && <span className="sr-only">{l('Ditt felaktiga svar','Your incorrect answer')}</span>}</button>;
  })}</div>;
}
