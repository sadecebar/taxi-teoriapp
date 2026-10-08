import { useState } from 'react';
import { ArrowRight, BookmarkSimple, CaretRight, Check, Compass, Flame, Images, Lightning, MagnifyingGlass, Moon, Path, RoadHorizon, ShieldCheck, SteeringWheel, Sun, Target, Timer, Trophy, Stack, X } from '@phosphor-icons/react';
import { QUESTIONS, isNavigeringQuestion, isTaxiregelQuestion, isVilotidQuestion } from '../study-data.js';
import { useStudy } from './context.jsx';
import { Button, Empty, IconButton, ProgressBar, Ring, RouteArt, Row, ScreenTitle, SectionTitle } from './components.jsx';

// Shared static topic definitions also support the progress screen.
// eslint-disable-next-line react-refresh/only-export-components
export const topics = [
  { id:'fordon', sv:'Fordon & säkerhet', en:'Vehicle & safety', icon:SteeringWheel, test:q=>q.delprov===1&&!isNavigeringQuestion(q) },
  { id:'trafik', sv:'Trafikregler', en:'Traffic rules', icon:RoadHorizon, test:q=>q.delprov===2&&!isTaxiregelQuestion(q)&&!isVilotidQuestion(q) },
  { id:'taxi', sv:'Taxiregler', en:'Taxi regulations', icon:ShieldCheck, test:isTaxiregelQuestion },
  { id:'vila', sv:'Vilotider', en:'Rest periods', icon:Timer, test:isVilotidQuestion },
  { id:'navigation', sv:'Navigering', en:'Navigation', icon:Compass, test:isNavigeringQuestion },
  { id:'bilder', sv:'Bildfrågor', en:'Image questions', icon:Images, test:q=>!!q.image },
];

export function Home() {
  const a = useStudy(), {l} = a;
  const active = a.quiz && !a.quiz.finished;
  return <>
    <div className="mb-7 flex items-center justify-between"><span className="flex items-center gap-2.5 text-sm font-medium"><span className="grid size-9 place-items-center rounded-xl bg-ink text-canvas"><SteeringWheel size={22}/></span>taxi teori<span className="ml-1 rounded-md bg-soft px-1.5 py-1 text-[calc(0.75rem*var(--text-scale))] font-medium tracking-wider">OFFLINE</span></span><span className="flex gap-2"><IconButton icon={a.theme==='dark'?Sun:Moon} label={l(a.theme==='dark'?'Byt till ljust läge':'Byt till mörkt läge',a.theme==='dark'?'Switch to light mode':'Switch to dark mode')} onClick={()=>a.setTheme(a.theme==='dark'?'light':'dark')}/></span></div>
    <div className="mb-6"><p className="mb-2 text-sm text-muted">{l('En liten stund. Ett steg närmare.','A little practice. One step closer.')}</p><h1 className="text-[calc(2.1875rem*var(--text-scale))] leading-[1.1] font-medium tracking-[-.04em]">{l('Nästa stopp:','Next stop:')}<br/><span className="text-accent">{l('taxilegitimation.','your taxi licence.')}</span></h1></div>
    {active && <button onClick={a.resumeQuiz} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-accent bg-tint px-4 py-3 text-left"><span className="grid size-9 place-items-center rounded-full bg-accent text-canvas"><ArrowRight size={20}/></span><span className="flex-1"><span className="block font-medium">{l('Fortsätt där du var','Pick up where you left off')}</span><span className="text-xs text-muted">{a.quiz.answers.length}/{a.quiz.questions.length} {l('besvarade','answered')}{[1,2].includes(a.mode)?l(' · Provtiden fortsätter',' · Exam timer keeps running'):''}</span></span><CaretRight size={18}/></button>}
    <section className="relative mb-5 overflow-hidden rounded-[28px] bg-[var(--hero-bg)] px-6 pt-6 pb-5 text-[var(--hero-text)]">
      <div className="focus-art absolute -right-5 top-5 opacity-90"><RouteArt/></div>
      <div className="focus-copy relative w-[64%]"><p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--hero-line)] px-2.5 py-1 text-[calc(0.75rem*var(--text-scale))] font-medium uppercase tracking-[.12em]"><Target size={13}/>{l('Ditt fokuspass','Your focus session')}</p><h2 className="text-[calc(1.8125rem*var(--text-scale))] leading-[1.08] font-medium tracking-tight">{l('Lite bättre.','A little better.')}<br/>{l('Varje dag.','Every day.')}</h2><p className="mt-3 text-xs text-[var(--hero-muted)]">15 {l('frågor anpassade efter dig','questions picked for you')}</p></div>
      <button onClick={()=>a.startQuiz('focus')} className="relative mt-6 flex min-h-12 w-full items-center justify-between rounded-2xl bg-[var(--hero-action)] px-4 py-3 text-sm font-medium text-[var(--hero-action-ink)]">{l('Börja öva','Start practising')}<ArrowRight size={20}/></button>
    </section>
    <button onClick={()=>a.setView('daily')} className="mb-7 flex w-full items-center gap-3.5 rounded-[22px] border border-line bg-paper p-4 text-left"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-tint text-accent">{a.dailyData.answered?<Check size={25}/>:<Flame size={25}/>}</span><span className="min-w-0 flex-1"><span className="block font-medium">{l('Dagens fråga','Daily question')}</span><span className="mt-1 block text-xs text-muted">{a.dailyData.answered?l('Klar för idag. Snyggt jobbat!','Done for today. Nice work!'):l('En fråga. En ny vana.','One question. A new habit.')}</span></span><span className="text-center"><span className="block text-xl font-medium">{a.dailyData.streak}</span><span className="text-[calc(0.75rem*var(--text-scale))] text-muted">{l('i rad','streak')}</span></span><CaretRight size={16} className="text-muted"/></button>
    <SectionTitle>{l('Välj din väg','Choose your route')}</SectionTitle>
    <div className="mb-7 adaptive-grid grid grid-cols-2 gap-3">
      {[{icon:Lightning,label:l('Snabbtest','Quick test'),sub:l('15 blandade frågor','15 mixed questions'),run:()=>a.startQuiz('quick')},{icon:BookmarkSimple,label:l('Sparade','Bookmarks'),sub:`${a.savedIds.length} ${a.questionWord(a.savedIds.length)}`,run:()=>{a.setFragorFilter('saved');a.setView('fragor');}}].map(({icon:Icon,label,sub,run})=><button key={label} onClick={run} className="rounded-[22px] border border-line bg-paper p-4 text-left"><Icon size={26} className="mb-5 text-accent"/><span className="flex items-center justify-between gap-2 font-medium">{label}<ArrowRight size={16}/></span><span className="mt-1 block text-xs text-muted">{sub}</span></button>)}
    </div>
    <SectionTitle action={l('Min resa','My journey')} onClick={()=>a.setView('mer')}>{l('Du rör dig framåt','Moving forward')}</SectionTitle>
    <button onClick={()=>a.setView('mer')} className="flex w-full items-center gap-4 rounded-[22px] bg-soft p-5 text-left"><Ring value={a.masterPct} size={72}/><span><span className="block text-lg font-medium">{a.mastered} {l('av','of')} {QUESTIONS.length}</span><span className="text-sm text-muted">{l('frågor behärskade','questions mastered')}</span></span><ArrowRight size={20} className="ml-auto"/></button>
  </>;
}

export function Practice() {
  const a = useStudy(), {l} = a;
  if (a.fragorFilter) return <QuestionLibrary key={a.fragorFilter}/>;
  return <>
    <ScreenTitle eyebrow={l('Din träningsplats','Your practice space')} title={l('Öva på ditt sätt','Your way to learn')} action={<IconButton icon={MagnifyingGlass} label={l('Sök bland alla frågor','Search all questions')} onClick={()=>a.setFragorFilter('all')}/>}/>
    <button onClick={()=>a.startQuiz('focus')} className="mb-7 flex w-full items-center gap-4 rounded-[24px] bg-tint p-5 text-left"><Target size={38} className="shrink-0 text-accent"/><span className="flex-1"><span className="block text-lg font-medium">{l('Fokuspass','Focus session')}</span><span className="mt-1 block text-sm text-muted">{l('15 frågor utifrån dina framsteg','15 questions based on your progress')}</span></span><ArrowRight size={22}/></button>
    <SectionTitle action={l('Alla frågor','All questions')} onClick={()=>a.setFragorFilter('all')}>{l('Ämnen','Topics')}</SectionTitle>
    <div className="mb-7 divide-y divide-line">{topics.map(({id,sv,en,icon:Icon,test})=> {
      const qs = QUESTIONS.filter(test), mastered = qs.filter(q=>a.getQuestionStatus(q)==='behärskad').length;
      return <button key={id} onClick={()=>a.setFragorFilter(id)} className="flex w-full items-center gap-4 py-4 text-left"><span className="grid size-14 shrink-0 place-items-center rounded-[19px] border border-line bg-paper text-accent"><Icon size={28}/></span><span className="min-w-0 flex-1"><span className="mb-1 flex items-center justify-between gap-2"><span className="font-medium">{l(sv,en)}</span><CaretRight size={16} className="text-muted"/></span><span className="mb-2 block text-xs text-muted">{qs.length} {l('frågor','questions')} · {mastered} {l('behärskade','mastered')}</span><ProgressBar value={qs.length?Math.round(mastered/qs.length*100):0} label={l(sv,en)}/></span></button>;
    })}</div>
    <SectionTitle>{l('Träna lite till','Keep practising')}</SectionTitle><div className="divide-y divide-line"><Row icon={BookmarkSimple} title={l('Sparade frågor','Bookmarked questions')} subtitle={`${a.savedIds.length} ${l('att komma tillbaka till','to return to')}`} onClick={()=>a.setFragorFilter('saved')}/><Row icon={Path} title={l('Repetera svaga områden','Practise weak areas')} subtitle={`${a.wrongCount} ${l('frågor att öva mer på','questions to work on')}`} onClick={()=>a.setFragorFilter('weak')}/><Row icon={Trophy} title={l('Utmaningar','Challenges')} subtitle={l('Rätt i rad, bildtest & minneskort','Answer streaks, images & flashcards')} onClick={()=>a.setView('utmaningar')}/></div>
    <SectionTitle>{l('Ett eget pass','Your own session')}</SectionTitle><div className="flex gap-2">{[10,20,30].map(n=><Button secondary key={n} aria-label={`${l("Starta övning med","Start practice with")} ${n} ${a.questionWord(n)}`} className="flex-1" onClick={()=>a.startQuiz(n)}>{n}</Button>)}</div><p className="mt-2 text-xs text-muted">{l('Antal blandade frågor. Ingen tidspress.','Mixed questions. No time limit.')}</p>
  </>;
}

function QuestionLibrary() {
  const a = useStudy(), {l} = a;
  const [search,setSearch] = useState(''), [status,setStatus] = useState('all');
  const category = topics.find(t=>t.id===a.fragorFilter);
  const title = category?l(category.sv,category.en):a.fragorFilter==='saved'?l('Sparade frågor','Bookmarks'):a.fragorFilter==='weak'?l('Öva mer','Practise more'):l('Alla frågor','All questions');
  const pool = QUESTIONS.filter(q=>category?category.test(q):a.fragorFilter==='saved'?a.savedIds.includes(q.id):a.fragorFilter==='weak'?a.getQuestionStatus(q)==='öva mer':true);
  const filtered = pool.filter(q=>(status==='all'||a.getQuestionStatus(q)===status)&&(!search||a.tq(q).question.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  return <>
    <ScreenTitle title={title} back={{label:l('Tillbaka till övning','Back to practice'),action:()=>a.setFragorFilter(null)}}/>
    <label className="mb-2 block text-xs font-medium text-muted" htmlFor="question-search">{l('Sök frågor','Search questions')}</label><div className="search-field mb-4 flex items-center gap-3 rounded-2xl border border-line bg-paper px-4"><MagnifyingGlass size={20} className="shrink-0 text-muted"/><input id="question-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={l('Sök ett ord eller en mening','Search a word or sentence')} className="min-h-12 w-full min-w-0 bg-transparent text-sm outline-none"/></div>
    <label htmlFor="question-status" className="mb-2 block text-xs font-medium text-muted">{l('Visa','Show')}</label><select id="question-status" value={status} onChange={e=>setStatus(e.target.value)} className="mb-5 min-h-12 w-full rounded-2xl border border-line bg-paper px-4 text-sm">{[['all',l('Alla nivåer','All levels')],...['ej övad','öva mer','på väg','behärskad'].map(s=>[s,a.tStatus(s)])].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <p role="status" className="sr-only">{filtered.length} {l("frågor hittades","questions found")}</p>
    {filtered.length>0 ? <><Button className="mb-5 w-full" onClick={()=>a.startQuiz('review',filtered)}>{l('Öva dessa','Practise these')} {filtered.length}<ArrowRight size={18}/></Button><p className="mb-2 text-xs text-muted">{filtered.length} {a.questionWord(filtered.length)} · {l('Tryck för att öva en fråga','Tap to practise one question')}</p><div className="divide-y divide-line">{filtered.map((q,index)=><button key={q.id} onClick={()=>{a.setStatsQuestion(q);a.setStatsSelected(null);a.setStatsAnswered(false);}} className="flex w-full items-start gap-3 py-4 text-left"><span className="mt-1 min-w-7 font-mono text-[calc(0.75rem*var(--text-scale))] text-muted">{String(index+1).padStart(2,'0')}</span><span className="flex-1"><span className="block text-sm leading-relaxed">{a.tq(q).question}</span><span className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">{a.getQuestionStatus(q)==='behärskad'&&<Check size={13}/>} {a.tStatus(a.getQuestionStatus(q))}{q.image&&<Images size={14}/>}</span></span>{a.savedIds.includes(q.id)?<BookmarkSimple size={18} className="mt-1 shrink-0 text-accent"/>:<CaretRight size={17} className="mt-1 shrink-0 text-muted"/>}</button>)}</div></>:<Empty icon={a.fragorFilter==='saved'?BookmarkSimple:MagnifyingGlass} title={l('Inga frågor här ännu','No questions here yet')} body={a.fragorFilter==='saved'?l('Tryck på bokmärket vid en fråga för att spara den här.','Tap the bookmark on a question to save it here.'):l('Prova en annan sökning eller ett annat filter.','Try another search or filter.')} action={l('Till ämnen','Back to topics')} onClick={()=>a.setFragorFilter(null)}/>}
  </>;
}

export function Challenges() {
  const a = useStudy(), {l} = a;
  return <><ScreenTitle eyebrow={l('Ett nytt sätt att öva','A fresh way to practise')} title={l('Utmana dig','Challenge yourself')} back={{label:l('Tillbaka','Back'),action:()=>a.setView('fragor')}}/>
    <div className="mb-5 overflow-hidden rounded-[28px] bg-[var(--hero-bg)] p-6 text-[var(--hero-text)]"><div className="flex justify-between"><Trophy size={52} className="text-[var(--hero-action)]"/><span className="text-right"><span className="block text-3xl font-medium">{a.rirBest}</span><span className="text-xs text-[var(--hero-muted)]">{l('ditt rekord','your best')}</span></span></div><h2 className="mt-7 text-2xl font-medium">{l('Hur långt når du?','How far can you go?')}</h2><p className="mt-2 text-sm text-[var(--hero-muted)]">{l('Svara rätt så länge du kan. Ett fel avslutar passet.','Keep answering correctly. One wrong answer ends the session.')}</p><Button className="mt-5 w-full !bg-[var(--hero-action)] !text-[var(--hero-action-ink)]" onClick={()=>a.startQuiz('rir')}>{l('Spela rätt i rad','Start answer streak')}<ArrowRight size={18}/></Button></div>
    <div className="divide-y divide-line"><Row icon={Images} title={l('Se. Tänk. Svara.','Look. Think. Answer.')} subtitle={l('15 bildfrågor','15 image questions')} onClick={()=>a.startQuiz('bilder')}/><Row icon={Stack} title={l('Minneskort','Flashcards')} subtitle={l('5 kort att vända i din egen takt','5 cards to flip at your own pace')} onClick={a.openFlashcards}/><Row icon={Lightning} title={l('Snabbtest','Quick test')} subtitle={l('15 blandade frågor','15 mixed questions')} onClick={()=>a.startQuiz('quick')}/></div>
  </>;
}
