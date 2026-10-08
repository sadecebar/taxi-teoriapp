import { useEffect } from 'react';
import { motion as Motion, MotionConfig } from 'framer-motion';
import { House, Books, FlagCheckered, Path, SteeringWheel, WifiSlash, ArrowRight } from '@phosphor-icons/react';
import { storage } from '../storage.js';
import { StudyContext } from './context.jsx';
import { Button, Modal, RouteArt } from './components.jsx';
import { Home, Practice, Challenges } from './HomePractice.jsx';
import { Quiz, Exams, Results, StudyQuestion, Daily, Flashcards } from './QuizScreens.jsx';
import { Journey, Settings, Checklist } from './JourneySettings.jsx';

const screens = {home:Home,fragor:Practice,utmaningar:Challenges,quiz:Quiz,prov:Exams,result:Results,mer:Journey,installningar:Settings,checklista:Checklist,daily:Daily,flashcard:Flashcards};
export default function MobileDesign({app}) {
  const { mainRef }=app;
  const a=app,l=(sv,en)=>a.lang==='en'?en:sv;
  const Screen=screens[a.view]||Home;
  const currentTab=['installningar','checklista'].includes(a.view)?'mer':['utmaningar','flashcard'].includes(a.view)?'fragor':a.view==='daily'?'home':a.view;
  const questionIndex = a.quiz?.current;
  const flashQuestionId = a.flashcards[a.flashIdx]?.id;
  useEffect(()=>{document.documentElement.lang=a.lang;},[a.lang]);
  useEffect(()=>{
    if (!a.statsLoaded || document.querySelector('dialog[open]')) return;
    const heading = mainRef.current?.querySelector('[data-screen-focus]') ?? mainRef.current?.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
    mainRef.current?.scrollTo({top:0});
  },[a.view,a.fragorFilter,questionIndex,flashQuestionId,a.statsLoaded,mainRef]);
  return <StudyContext.Provider value={{...a,l,questionWord:n=>l(n===1?"fråga":"frågor",n===1?"question":"questions")}}><MotionConfig reducedMotion="user" transition={{type:'spring',stiffness:100,damping:20}}><div className="mx-auto flex h-dvh max-w-3xl flex-col bg-canvas text-ink md:border-x md:border-line">
    <main ref={mainRef} className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-7 safe-top sm:px-8">
      {a.storageError&&<div role="alert" className="mb-5 rounded-2xl bg-danger-soft p-4 text-sm text-danger"><p>{l('Det gick inte att spara dina senaste ändringar.','Your latest changes could not be saved.')}</p><button onClick={()=>storage.retry().catch(()=>{})} className="mt-2 min-h-11 font-medium underline">{l('Försök spara igen','Try saving again')}</button></div>}
      {!a.statsLoaded?<div aria-busy="true" aria-label={l('Läser dina framsteg','Loading your progress')} className="space-y-5 py-8"><div className="h-10 w-2/3 animate-pulse rounded-xl bg-soft"/><div className="h-60 animate-pulse rounded-[28px] bg-soft"/><div className="h-20 animate-pulse rounded-[22px] bg-soft"/></div>:<Motion.div key={a.view} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{type:'spring',stiffness:100,damping:20}}><Screen/></Motion.div>}
    </main>
    {!['quiz','result','flashcard'].includes(a.view)&&<nav aria-label={l('Huvudmeny','Main navigation')} className="shrink-0 border-t border-line bg-paper px-4 pt-2 safe-bottom"><div className="grid grid-cols-4 gap-1">{[['home',House,l('Hem','Home')],['fragor',Books,l('Öva','Practise')],['prov',FlagCheckered,l('Prov','Exams')],['mer',Path,l('Min resa','My journey')]].map(([view,Icon,label])=><button key={view} type="button" aria-current={currentTab===view?'page':undefined} onClick={()=>{a.setFragorFilter(null);a.setView(view);}} className={`flex min-h-15 flex-col items-center justify-center gap-1 text-[calc(0.75rem*var(--text-scale))] font-medium ${currentTab===view?'text-accent':'text-muted'}`}><span className="relative grid h-8 w-15 place-items-center">{currentTab===view&&<Motion.span layoutId="active-navigation" className="absolute inset-0 rounded-full bg-tint"/>}<Icon className="relative" size={23}/></span>{label}</button>)}</div></nav>}
    {a.confirmation&&<Modal title={l('Vill du fortsätta?','Continue?')} onClose={()=>a.setConfirmation(null)}><p className="mb-6 text-sm leading-relaxed text-muted">{a.confirmation.message}</p><div className="flex gap-3"><Button secondary className="flex-1" onClick={()=>a.setConfirmation(null)}>{l('Avbryt','Cancel')}</Button><Button className="flex-1" onClick={()=>{const action=a.confirmation.action;a.setConfirmation(null);action();}}>{l('Fortsätt','Continue')}</Button></div></Modal>}
    {a.statsQuestion&&<StudyQuestion key={a.statsQuestion.id}/>}
    {a.showResetConfirm&&<Modal title={l('Nollställ dina framsteg?','Reset your progress?')} onClose={()=>a.setShowResetConfirm(false)}><p className="mb-6 text-sm leading-relaxed text-muted">{l('Statistik, sparade frågor, historik och pågående pass raderas från den här enheten. Detta går inte att ångra.','Stats, bookmarks, history and your current session will be removed from this device. This cannot be undone.')}</p><div className="flex gap-3"><Button secondary className="flex-1" onClick={()=>a.setShowResetConfirm(false)}>{l('Avbryt','Cancel')}</Button><Button className="flex-1 !bg-danger !text-canvas" onClick={a.resetAllProgress}>{l('Nollställ','Reset')}</Button></div></Modal>}
    {a.showOnboarding&&a.view==='home'&&<Modal title={l('Din resa börjar här','Your journey starts here')} onClose={a.handleOnboardingDone}><div className="relative mb-5 flex items-center justify-between overflow-hidden rounded-[24px] bg-[var(--hero-bg)] p-5 text-[var(--hero-text)]"><div><SteeringWheel size={35}/><p className="mt-4 text-2xl leading-tight font-medium">{l('Lite övning.','A little practice.')}<br/>{l('Varje dag.','Every day.')}</p></div><RouteArt compact/></div><p className="mb-4 text-sm leading-relaxed text-muted">{l('Öva på frågor, testa dina kunskaper och följ din utveckling. Vi sparar var du slutade.','Practise questions, test your knowledge and follow your progress. We save where you left off.')}</p><p className="mb-6 flex items-center gap-2 text-xs text-muted"><WifiSlash size={17}/>{l('Fungerar offline. Inget konto behövs.','Works offline. No account needed.')}</p><Button className="w-full" onClick={a.handleOnboardingDone}>{l('Nu kör vi','Let’s get started')}<ArrowRight size={18}/></Button></Modal>}
  </div></MotionConfig></StudyContext.Provider>;
}
