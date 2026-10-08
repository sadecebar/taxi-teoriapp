import { Statistics, Readiness, ResultsChart } from './Insights.jsx';
import { useState } from 'react';
import { Bell, BookmarkSimple, ChartBar, Check, Checks, CheckSquare, GearSix, Globe, Info, Moon, Path, SpeakerHigh, Sun, Trash, Vibrate } from '@phosphor-icons/react';
import { QUESTIONS } from '../study-data.js';
import { isExamMode, historyPassed } from '../exam.js';
import { requestPlatformPermission } from '../notif-platform.js';
import { weakestCategory } from '../review.js';
import { topics } from './HomePractice.jsx';
import { useStudy } from './context.jsx';
import { Button, Empty, IconButton, Modal, Ring, Row, ScreenTitle, SectionTitle, Toggle } from './components.jsx';

export function Journey() {
  const a = useStudy(), {l} = a;
  const history = a.quizHistory.filter(h=>!isExamMode(h.mode)||h.scoringVersion===2).slice(0,10);
  const weak = weakestCategory(topics.map(c=>({...c,weakCount:QUESTIONS.filter(q=>c.test(q)&&a.getQuestionStatus(q)==='öva mer').length})));
  return <><ScreenTitle eyebrow={l('Varje pass räknas','Every session counts')} title={l('Min resa','My journey')} action={<IconButton icon={GearSix} label={l('Inställningar','Settings')} onClick={()=>a.setView('installningar')}/>}/>
    <Statistics/><Readiness compact/>
    {weak&&<button className="mb-6 flex w-full items-center gap-4 rounded-[22px] bg-tint p-5 text-left" onClick={()=>{a.setFragorFilter(weak.id);a.setView('fragor');}}><Path size={31} className="shrink-0 text-accent"/><span><span className="block text-xs text-muted">{l('Bra att repetera nu','Worth practising next')}</span><span className="mt-1 block font-medium">{l(weak.sv,weak.en)}</span><span className="text-xs text-muted">{weak.weakCount} {l('frågor att öva mer på','questions to work on')}</span></span></button>}
    <ResultsChart/>
    <SectionTitle>{l('Senaste passen','Recent sessions')}</SectionTitle>
    {history.length?<div className="mb-6 divide-y divide-line">{history.map((h,i)=><div key={`${h.ts}-${i}`} className="flex items-center gap-3 py-4"><span className="grid size-10 place-items-center rounded-xl bg-soft text-accent">{isExamMode(h.mode)&&historyPassed(h)?<Checks size={22}/>:<ChartBar size={22}/>}</span><span className="flex-1"><span className="block text-sm font-medium">{isExamMode(h.mode)?`${l('Delprov','Sub-test')} ${h.mode}`:h.mode==='focus'?l('Fokuspass','Focus session'):h.mode==='rir'?l('Rätt i rad','Answer streak'):l('Övningspass','Practice session')}</span><span className="text-xs text-muted">{new Date(h.ts).toLocaleDateString(a.dateLocale,{day:'numeric',month:'short'})}{isExamMode(h.mode)?' · '+(historyPassed(h)?l('Godkänt','Passed'):l('Ej godkänt','Not passed')):''}</span></span><span className="font-mono text-sm">{h.score}/{h.total}</span></div>)}</div>:<Empty icon={ChartBar} title={l('Din resa börjar här','Your journey starts here')} body={l('När du avslutar ett pass visas resultatet här.','Completed sessions will appear here.')} action={l('Gör ett snabbtest','Take a quick test')} onClick={()=>a.startQuiz('quick')}/>}
    <div className="divide-y divide-line border-t border-line"><Row icon={CheckSquare} title={l('Vägen till legitimation','Your licence checklist')} subtitle={`${a.checklistDone.size}/${a.checklistSteps.length} ${l('steg markerade','steps marked')}`} onClick={()=>a.setView('checklista')}/><Row icon={BookmarkSimple} title={l('Mina sparade frågor','My bookmarks')} subtitle={`${a.savedIds.length} ${a.questionWord(a.savedIds.length)}`} onClick={()=>{a.setFragorFilter('saved');a.setView('fragor');}}/><Row icon={GearSix} title={l('Inställningar','Settings')} subtitle={l('Utseende, språk & påminnelser','Appearance, language & reminders')} onClick={()=>a.setView('installningar')}/></div>
  </>;
}

export function Settings() {
  const a=useStudy(),{l}=a;
  const [permissionError,setPermissionError]=useState(''),[requesting,setRequesting]=useState(false),[about,setAbout]=useState(false);
  const update = (key,value)=>a.setNotifSettings({...a.notifSettings,[key]:value});
  const reminders = async enabled=>{
    if(requesting)return;
    setPermissionError('');
    if(!enabled){update('enabled',false);return;}
    setRequesting(true);
    try { const granted=await requestPlatformPermission(); if(granted==='granted')update('enabled',true); else setPermissionError(l('Tillåt notiser i telefonens inställningar för att få påminnelser.','Allow notifications in your phone settings to receive reminders.')); }
    catch {setPermissionError(l('Det gick inte att aktivera påminnelser. Försök igen.','Could not enable reminders. Please try again.'));}
    finally{setRequesting(false);}
  };
  return <><ScreenTitle title={l('Inställningar','Settings')} back={{label:l('Tillbaka','Back'),action:()=>a.setView('mer')}}/>
    <SectionTitle>{l('Gör appen till din','Make it yours')}</SectionTitle><fieldset className="mb-7"><legend className="mb-3 text-sm text-muted">{l('Utseende','Appearance')}</legend><div className="adaptive-grid grid grid-cols-2 gap-3">{[['light',Sun,l('Ljust','Light')],['dark',Moon,l('Mörkt','Dark')]].map(([value,Icon,label])=><button type="button" key={value} aria-pressed={a.theme===value} onClick={()=>a.setTheme(value)} className={`overflow-hidden rounded-[22px] border p-3 text-left ${a.theme===value?'border-accent ring-1 ring-accent':'border-line'}`}><div className={`mb-3 h-25 rounded-xl p-3 ${value==='light'?'bg-[#F5F4EF]':'bg-[#0D0D14]'}`}><div className={`mb-2 h-2 w-1/2 rounded ${value==='light'?'bg-[#CDCAD4]':'bg-[#555161]'}`}/><div className="h-10 rounded-lg" style={{background:'#F0A500'}}/><div className={`mt-2 h-3 rounded ${value==='light'?'bg-white':'bg-[#202030]'}`}/></div><span className="flex items-center gap-2 text-sm"><Icon size={18}/>{label}{a.theme===value&&<Check size={17} className="ml-auto text-accent"/>}</span></button>)}</div></fieldset>
    <label htmlFor="language" className="mb-2 flex items-center gap-2 text-sm text-muted"><Globe size={18}/>{l('Språk','Language')}</label><select id="language" value={a.lang} onChange={e=>a.setLang(e.target.value)} className="mb-7 min-h-13 w-full rounded-2xl border border-line bg-paper px-4"><option value="sv">Svenska</option><option value="en">English</option></select>
    <SectionTitle>{l('Läsbarhet','Readability')}</SectionTitle>
    <label htmlFor="text-size" className="mb-2 block text-sm text-muted">{l('Textstorlek','Text size')}</label>
    <select id="text-size" aria-describedby="text-size-help" value={a.textScale} onChange={e=>a.setTextScale(Number(e.target.value))} className="min-h-13 w-full rounded-2xl border border-line bg-paper px-4">
      {[[1,l('Standard · 100 %','Standard · 100%')],[1.25,l('Stor · 125 %','Large · 125%')],[1.5,l('Större · 150 %','Larger · 150%')],[2,l('Störst · 200 %','Largest · 200%')]].map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
    <p id="text-size-help" className="mt-2 text-sm leading-relaxed text-muted">{l('Gäller hela appen och sparas på den här enheten.','Applies throughout the app and is saved on this device.')}</p>
    <p className="mt-3 mb-7 rounded-2xl bg-soft p-4 leading-relaxed">{l('Så här stor blir texten. Öva i din egen takt.','This is your text size. Practise at your own pace.')}</p>
    <SectionTitle>{l('Ljud & känsla','Sound & feel')}</SectionTitle><div className="mb-7 divide-y divide-line"><Toggle icon={SpeakerHigh} label={l('Svarsljud','Answer sounds')} checked={a.notifSettings.sound} onChange={v=>update('sound',v)}/><Toggle icon={Vibrate} label={l('Vibration vid svar','Answer vibration')} checked={a.notifSettings.vibration} onChange={v=>update('vibration',v)}/></div>
    <SectionTitle>{l('Din studievana','Your study habit')}</SectionTitle><Toggle icon={Bell} label={requesting?l('Väntar på tillåtelse…','Waiting for permission…'):l('Studiepåminnelser','Study reminders')} checked={a.notifSettings.enabled} onChange={reminders}/>{permissionError&&<p role="alert" className="mb-4 text-sm text-danger">{permissionError}</p>}
    {a.notifSettings.enabled&&<><label htmlFor="reminder-time" className="mb-2 block text-sm text-muted">{l('När vill du bli påmind?','When should we remind you?')}</label><select id="reminder-time" value={a.notifSettings.timing} onChange={e=>update('timing',e.target.value)} className="mb-5 min-h-13 w-full rounded-2xl border border-line bg-paper px-4">{[['day',l('Morgon · 08:00','Morning · 08:00')],['lunch',l('Lunch · 12:00','Lunch · 12:00')],['evening',l('Kväll · 18:00','Evening · 18:00')]].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></>}
    <div className="mt-7 divide-y divide-line border-t border-line"><Row icon={Info} title={l('Om Taxi Teori','About Taxi Teori')} subtitle={`Version ${import.meta.env.VITE_APP_VERSION}`} onClick={()=>setAbout(true)}/><Row icon={Trash} danger title={l('Nollställ framsteg','Reset progress')} onClick={()=>a.setShowResetConfirm(true)}/></div>
    {about&&<Modal title="Taxi Teori" onClose={()=>setAbout(false)}><div className="space-y-4 text-sm leading-relaxed text-muted"><p>{l('En studieapp för dig som övar inför taxiförarlegitimation. Dina framsteg sparas på den här enheten.','A study app for the Swedish taxi licence. Your progress is saved on this device.')}</p><p>{l('Ingen inloggning. Ingen reklam. Frågor och bilder fungerar offline.','No login. No ads. Questions and images work offline.')}</p><p>{l('Detta är en utvecklingsversion. Frågor, svar och bildrättigheter behöver granskas före publicering.','This is a development version. Questions, answers and image rights need review before publication.')}</p><p>Version {import.meta.env.VITE_APP_VERSION}</p></div></Modal>}
  </>;
}

export function Checklist() {
  const a=useStudy(),{l}=a;
  const [expanded,setExpanded]=useState(null);
  return <><ScreenTitle eyebrow={l('Hela vägen fram','The road ahead')} title={l('Din checklista','Your checklist')} back={{label:l('Tillbaka','Back'),action:()=>a.setView('mer')}}/><div className="mb-7 flex items-center gap-4 rounded-[24px] bg-tint p-5"><Ring value={Math.round(a.checklistDone.size/a.checklistSteps.length*100)} size={72}><CheckSquare size={29}/></Ring><span><span className="block text-xl font-medium">{a.checklistDone.size}/{a.checklistSteps.length}</span><span className="text-sm text-muted">{l('steg markerade som klara','steps marked as done')}</span></span></div><div className="divide-y divide-line">{a.checklistSteps.map((step,i)=><div key={i} className="py-4"><div className="flex items-start gap-3"><button role="checkbox" aria-checked={a.checklistDone.has(i)} aria-label={`${l('Markera steg','Mark step')} ${i+1}: ${step.title}`} onClick={()=>a.toggleChecklistStep(i)} className="grid min-h-11 min-w-11 shrink-0 place-items-center"><span className={`grid size-8 place-items-center rounded-full border ${a.checklistDone.has(i)?'border-accent bg-accent text-canvas':'border-line bg-paper text-muted'}`}>{a.checklistDone.has(i)?<Check size={17}/>:<span className="text-xs">{i+1}</span>}</span></button><button aria-expanded={expanded===i} onClick={()=>setExpanded(expanded===i?null:i)} className="min-h-11 flex-1 text-left text-sm leading-relaxed font-medium">{step.title}</button></div>{expanded===i&&<p className="mt-2 pl-14 text-sm leading-relaxed text-muted">{step.desc}</p>}</div>)}</div><p className="mt-5 text-xs leading-relaxed text-muted">{l('Kontrollera aktuella krav hos Transportstyrelsen och Trafikverket innan du bokar eller ansöker.','Check current requirements with Transportstyrelsen and Trafikverket before booking or applying.')}</p></>;
}
