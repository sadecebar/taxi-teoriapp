import { useState } from 'react';
import { ArrowRight, ChartBar, Target, TrendUp } from '@phosphor-icons/react';
import { QUESTIONS } from '../study-data.js';
import { PRACTICE_GOAL, coveragePercent, knowledgeDistribution, recentTestResults, resultSummary } from '../study-insights.js';
import { useStudy } from './context.jsx';
import { Button, Empty, Ring, SectionTitle } from './components.jsx';

const statusColors = {'behärskad':'var(--success)','på väg':'var(--progress-color)','öva mer':'var(--danger)','ej övad':'var(--unseen)'};
function Percentage({value}) { const {lang}=useStudy();return <>{value.toLocaleString(lang==='sv'?'sv-SE':'en-GB',{maximumFractionDigits:1})}%</>; }
function GoalBar({ value, label }) {
  return <div className="relative h-2 rounded-full bg-soft" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><div className="h-full origin-left rounded-full bg-[var(--success)]" style={{transform:`scaleX(${value/100})`}}/><span className="absolute -top-1 h-4 w-px bg-accent" style={{left:`${PRACTICE_GOAL}%`}}/></div>;
}
export function Statistics() {
  const a=useStudy(),{l}=a;
  const counts=knowledgeDistribution(QUESTIONS,a.stats), percent=coveragePercent(counts['behärskad'],QUESTIONS.length);
  return <section className="mb-7" aria-label={l('Statistik','Statistics')}>
    <SectionTitle>{l('Statistik','Statistics')}</SectionTitle>
    <div className="mb-4 rounded-[24px] border border-line bg-paper p-5">
      <div className="mb-5 flex items-center justify-between"><div><p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted">{l('Träffsäkerhet','Accuracy')}</p><p className="text-[calc(2.5rem*var(--text-scale))] leading-tight font-medium tracking-tight text-accent">{a.tot?a.acc+'%':'–'}</p></div><Ring value={a.acc} size={68}><Target size={23} className="text-accent"/></Ring></div>
      <div className="a11y-summary border-t border-line pt-4">{[[a.tot,l('Försök','Attempts')],[a.corr,l('Rätt','Correct')],[`${a.mastered}/${QUESTIONS.length}`,l('Behärskade','Mastered')]].map(([v,label])=><div key={label} className="min-w-0 flex-1 px-2 first:pl-0"><p className="text-lg font-medium tabular-nums">{v}</p><p className="text-xs text-muted">{label}</p></div>)}</div>
    </div>
    <div className="rounded-[24px] border border-line bg-paper p-5"><h3 className="mb-5 flex items-center gap-2 text-sm font-medium"><ChartBar size={19}/>{l('Kunskapsfördelning','Knowledge distribution')}</h3><div className="adaptive-row mb-4 flex items-end justify-between gap-2"><p className="text-[calc(2.375rem*var(--text-scale))] leading-none font-medium tracking-tight text-[var(--success)]"><Percentage value={percent}/></p><p className="text-right text-sm"><strong className="font-medium">{a.mastered}</strong><span className="text-muted">/{QUESTIONS.length}</span><span className="mt-1 block text-[calc(0.75rem*var(--text-scale))] text-muted">{l('BEHÄRSKADE','MASTERED')}</span></p></div>
      <div className="mb-5 flex h-2 overflow-hidden rounded-full bg-soft" aria-hidden="true">{Object.entries(counts).map(([status,count])=><span key={status} style={{width:`${count/QUESTIONS.length*100}%`,background:statusColors[status]}}/>)}</div>
      <dl className="divide-y divide-line">{Object.entries(counts).map(([status,count])=><div key={status} className="flex items-center gap-2 py-3"><span className="size-2 shrink-0 rounded-full" style={{background:statusColors[status]}}/><dt className="flex-1 text-sm text-muted">{a.tStatus(status)}</dt><span className="h-1 w-14 overflow-hidden rounded-full bg-soft" aria-hidden="true"><span className="block h-full origin-left" style={{background:statusColors[status],transform:`scaleX(${count/QUESTIONS.length})`}}/></span><dd className="min-w-9 text-right font-mono text-sm">{count}</dd></div>)}</dl>
      <p className="mt-3 text-xs leading-relaxed text-muted">{l('Behärskad: minst två rätt och fler rätt än fel.','Mastered: at least two correct answers and more correct than wrong.')}</p>
    </div>
  </section>;
}
export function Readiness({compact=false}) {
  const a=useStudy(),{l}=a, percent=coveragePercent(a.mastered,QUESTIONS.length);
  const label=value=>value>=PRACTICE_GOAL?l('Mål nått','Goal reached'):value>=35?l('På väg','On your way'):l('Bygg grunden','Build a foundation');
  const lowest=[...a.dpProgress].sort((x,y)=>x.pct-y.pct)[0];
  return <section className="mb-7" aria-label={l('Provberedskap','Exam preparation')}>
    <SectionTitle>{l('Provberedskap','Exam preparation')}</SectionTitle><div className="overflow-hidden rounded-[24px] border border-line bg-paper">
      <div className="p-5"><div className="adaptive-row mb-4 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs text-muted"><Target size={18}/>{l('Din kunskapstäckning','Your knowledge coverage')}</span><span className="rounded-full bg-tint px-2.5 py-1 text-[calc(0.75rem*var(--text-scale))] font-medium text-accent">{label(percent)}</span></div><div className="adaptive-row mb-4 flex items-end gap-4"><p className="text-[calc(2.375rem*var(--text-scale))] leading-none font-medium tracking-tight"><Percentage value={percent}/></p><p className="text-xs leading-relaxed text-muted">{a.mastered}/{QUESTIONS.length}<br/>{l('frågor behärskade','questions mastered')}</p></div><GoalBar value={percent} label={l('Kunskapstäckning','Knowledge coverage')}/><p className="mt-2 text-[calc(0.75rem*var(--text-scale))] text-muted">{l('Övningsmål','Practice goal')} {PRACTICE_GOAL}%</p></div>
      <div className="space-y-5 border-t border-line p-5">{a.dpProgress.map(dp=>{const pct=coveragePercent(dp.mastered,dp.total);return <div key={dp.dp}><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{l('Delprov','Sub-test')} {dp.dp}</h3><span className="text-sm font-medium"><Percentage value={pct}/></span></div><GoalBar value={pct} label={`${l('Delprov','Sub-test')} ${dp.dp}`}/><div className="adaptive-row mt-2 flex justify-between gap-2 text-[calc(0.75rem*var(--text-scale))] text-muted"><span>{dp.mastered}/{dp.total} {l('behärskade','mastered')}{dp.tried?` · ${dp.acc}% ${l('rätt','correct')}`:''}</span><span>{label(pct)}</span></div></div>;})}</div>
    </div><p className="mt-3 text-xs leading-relaxed text-muted">{l('Visar hur mycket du har övat in. Övningsmålet är inte en garanti för godkänt på det riktiga provet.','Shows how much you have mastered in practice. The practice goal is not a guarantee of passing the real exam.')}</p>
    {!compact&&<button onClick={()=>a.startQuiz(percent>=PRACTICE_GOAL?lowest.dp:'focus')} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-tint p-4 text-left"><TrendUp size={25} className="shrink-0 text-accent"/><span className="flex-1"><span className="block text-[calc(0.75rem*var(--text-scale))] uppercase tracking-wider text-muted">{l('Rekommenderat nästa steg','Recommended next step')}</span><span className="mt-1 block text-sm font-medium">{percent>=PRACTICE_GOAL?`${l('Testa delprov','Try sub-test')} ${lowest.dp}`:l('Träna med ett fokuspass','Practise with a focus session')}</span></span><ArrowRight size={20}/></button>}
  </section>;
}
export function ResultsChart() {
  const a=useStudy(),{l}=a;
  const [filter,setFilter]=useState('all'),[selected,setSelected]=useState(null);
  const entries=recentTestResults(a.quizHistory,filter), summary=resultSummary(entries);
  const modeName=m=>m===1?'DP1':m===2?'DP2':m==='quick'?l('Snabb','Quick'):String(m);
  const detail=selected===null?entries.at(-1):entries.find(e=>e.ts===selected)??entries.at(-1);
  return <section className="mb-7" aria-label={l('Senaste resultat','Recent results')}><SectionTitle>{l('Senaste resultat','Recent results')}</SectionTitle><div className="rounded-[24px] border border-line bg-paper p-5">
    <p className="mb-3 text-xs text-muted">{l('Dina senaste 10 test · äldst till vänster','Your last 10 tests · oldest on the left')}</p><div className="mb-5 flex gap-2">{[['all',l('Alla test','All tests')],[1,'DP1'],[2,'DP2']].map(([value,label])=><button key={value} aria-pressed={filter===value} className={`min-h-11 flex-1 rounded-xl border px-2 text-xs ${filter===value?'border-accent bg-tint text-accent':'border-line text-muted'}`} onClick={()=>{setFilter(value);setSelected(null);}}>{label}</button>)}</div>
    {entries.length?<><div className="chart-scroll"><div role="group" style={{minWidth:entries.length*48}} className="relative flex h-40 items-end gap-1 border-b border-line" aria-label={l('Resultatdiagram. Tryck på en stapel för detaljer.','Results chart. Select a bar for details.')}>
      {[25,50,75,100].map(n=><span key={n} aria-hidden="true" className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-line" style={{bottom:`${n}%`}}/>)}
      {entries.map((h,i)=><button key={`${h.ts}-${i}`} onClick={()=>setSelected(h.ts)} aria-pressed={detail===h} aria-label={`${modeName(h.mode)}, ${new Date(h.ts).toLocaleDateString(a.dateLocale)}, ${h.pct}%, ${h.score}/${h.total}, ${h.passed?l('godkänt','passed'):l('ej godkänt','not passed')}`} className="relative h-full min-w-11 flex-1" title={`${h.pct}%`}><span className="absolute right-0 bottom-0 left-0 mx-auto w-[80%] max-w-10 rounded-t-md" style={{height:`${Math.max(2,h.pct)}%`,background:h.passed?'var(--success)':'var(--danger)',opacity:detail===h?1:.6}}/><span aria-hidden="true" className="absolute right-0 left-0 border-t-2 border-dotted border-accent" style={{bottom:`${h.threshold}%`}}/><span className="sr-only">{i+1}</span></button>)}
    </div><div style={{minWidth:entries.length*48}} className="mt-2 flex gap-1 text-[calc(0.75rem*var(--text-scale))] text-muted" aria-hidden="true">{entries.map((h,i)=><span key={i} className="min-w-0 flex-1 text-center">{modeName(h.mode)}</span>)}</div></div>
    <div aria-live="polite" className="mt-4 rounded-xl bg-soft px-3 py-3 text-xs leading-relaxed"><span className="font-medium">{detail&&`${modeName(detail.mode)} · ${detail.pct}% · ${detail.score}/${detail.total}`}</span><span className="block text-muted">{detail&&`${new Date(detail.ts).toLocaleString(a.dateLocale,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${detail.passed?l('Godkänt','Passed'):l('Ej godkänt','Not passed')}`}</span></div>
    <div className="a11y-summary mt-4 border-t border-line pt-4">{[[summary.average+'%',l('Snitt','Average')],[summary.best+'%',l('Bäst','Best')],[`${summary.passed}/${entries.length}`,l('Godkända','Passed')]].map(([v,label])=><div key={label} className="flex-1 text-center"><p className="text-lg font-medium">{v}</p><p className="text-[calc(0.75rem*var(--text-scale))] text-muted">{label}</p></div>)}</div>
    <p className="mt-4 text-[calc(0.75rem*var(--text-scale))] leading-relaxed text-muted">{l('Prickad markering: godkändgräns för respektive test. DP1 48/65, DP2 34/46, korta test 70%.','Dotted marker: pass threshold for each test. DP1 48/65, DP2 34/46, short tests 70%.')}</p></>:<Empty icon={ChartBar} title={l('Här växer din resultattrend','Your results will grow here')} body={l('Avsluta ett test för att se din första stapel.','Complete a test to see your first bar.')} action={l('Starta test','Start test')} onClick={()=>a.startQuiz(filter==='all'?'quick':filter)}/>}
  </div></section>;
}
