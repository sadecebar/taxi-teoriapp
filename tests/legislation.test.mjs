import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { selectLegislationQuestions, isLicencePractice, isRestPractice, isSignPractice } from '../src/legislation-practice.js';
import { LEGISLATION_QUESTIONS } from '../src/legislation-questions.js';
import { APPROVED_QUESTIONS } from '../src/approved-questions.js';
import { createQuiz, quizResult } from '../src/exam.js';
import { commitQuizAnswer, advanceQuiz } from '../src/practice.js';
import { saveSession, loadSession } from '../src/quiz-session.js';
import { createBackup, parseBackup } from '../src/backup.js';
import { recentTestResults } from '../src/study-insights.js';
const hooks = registerHooks({load(url,context,nextLoad) {
  if(url.endsWith('.png')) return {format:'module',source:`export default ${JSON.stringify(url)}`,shortCircuit:true};
  return nextLoad(url,context);
}});
const {QUESTIONS} = await import('../src/questions.js');
hooks.deregister();
const seeded = () => {let x=42;return () => ((x=Math.imul(x,1664525)+1013904223)>>>0)/4294967296;};
const store = () => {const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};

test('bank contains exactly the approved 200 versions, 52 originals, and no pending approval overlay', () => {
  assert.equal(QUESTIONS.length,512);
  assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,512);
  assert.equal(APPROVED_QUESTIONS.length,200);
  assert.deepEqual([...new Set(APPROVED_QUESTIONS.map(q=>q.approvedBatch))].sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i+1));
  for (const approved of APPROVED_QUESTIONS) {
    const q=QUESTIONS.find(q=>q.id===approved.id);
    for (const key of ['question','options','correct','explanation','image']) assert.deepEqual(q[key],approved[key]);
    assert.equal(q.translationPending,true);
  }
  for (const id of [193,202,203,204,222,223,224,225,226,227]) assert.equal(QUESTIONS.find(q=>q.id===id).approvedBatch,undefined);
  assert.equal(LEGISLATION_QUESTIONS.length,52);
  for (const q of LEGISLATION_QUESTIONS) {
    assert.equal(q.delprov,2);assert.equal(q.image,null);
    assert.ok(q.id>=461&&q.id<=512);
    assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);
    assert.ok(q.correct>=0&&q.correct<4&&Number.isInteger(q.correct));
    assert.ok(q.explanation.length>80);
    assert.ok(q.sources.every(s=>new URL(s.url).protocol==='https:'&&s.checkedOn===(q.id>=501?'2026-10-16':'2026-10-15')));
  }
  assert.match(readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),/q\.translationPending\) return q/);
});

test('100 rounds contain ten unique reviewed legislation questions, balanced 5+5, with new scenarios and no immediate repeats', () => {
  const random=seeded(),stats={},seen=new Set();let recent=[];
  for(let i=0;i<100;i++) {
    const qs=selectLegislationQuestions([...QUESTIONS,QUESTIONS[0]],stats,recent,random);
    assert.equal(qs.length,10);assert.equal(new Set(qs.map(q=>q.id)).size,10);
    assert.ok(qs.every(q=>q.delprov===2&&(q.approvedBatch||q.original)));
    assert.equal(qs.filter(q=>q.examSubject==='taxi').length,5);
    assert.equal(qs.filter(q=>q.examSubject==='traffic').length,5);
    assert.ok(qs.filter(q=>q.original).length>=4);
    assert.ok(qs.some(isLicencePractice));
    assert.ok(qs.some(isRestPractice));
    assert.ok(qs.some(isSignPractice));
    assert.ok(qs.some(q=>q.topic==='equipment'));
    assert.ok(qs.some(q=>q.topic==='tariffs'));
    assert.ok(qs.filter(q=>q.topic==='stops').length>=2);
    assert.ok(qs.every(q=>!recent.slice(0,10).includes(q.id)));
    for(const q of qs) {seen.add(q.id);stats[q.id]={c:(stats[q.id]?.c||0)+1,w:0};}
    recent=[...qs.map(q=>q.id),...recent].slice(0,40);
  }
  assert.equal(LEGISLATION_QUESTIONS.filter(q=>seen.has(q.id)).length,52);
  assert.equal(selectLegislationQuestions(QUESTIONS.filter(q=>q.delprov===1)).length,0);
});

test('mini test resumes revealed answers safely, completes at ten, and survives portable backup with chart history', () => {
  const storage=store(),qs=selectLegislationQuestions(QUESTIONS,{},[],seeded());
  let quiz=commitQuizAnswer(createQuiz(qs,'legislation'),qs[0].correct);
  saveSession(quiz,'legislation',null,storage);
  const restored=loadSession(QUESTIONS,storage);
  assert.equal(restored.mode,'legislation');assert.equal(restored.quiz.questions.length,10);
  assert.equal(commitQuizAnswer(restored.quiz,0),restored.quiz);
  quiz=advanceQuiz(restored.quiz,'legislation');
  for(let i=1;i<10;i++) {
    quiz=commitQuizAnswer(quiz,qs[i].correct);
    if(i<9) quiz=advanceQuiz(quiz,'legislation');
  }
  assert.equal(advanceQuiz(quiz,'legislation').finished,true);
  const result=quizResult(quiz,'legislation');
  assert.equal(result.total,10);assert.equal(result.score,10);
  const entry={ts:Date.now(),mode:result.mode,score:result.score,total:result.total,scoringVersion:2};
  storage.setItem('taxi-teori-history-test',JSON.stringify([entry]));
  const file=createBackup(storage,'test','2.4.1',QUESTIONS,12);
  assert.equal(parseBackup(JSON.stringify(file),QUESTIONS,12).data.history[0].mode,'legislation');
  assert.equal(recentTestResults([entry])[0].pct,100);
});

// Independently check rolling 24-hour arithmetic for the three hard schedules.
const qualifyingRest = (periods, at) => {
  const lengths=periods.map(([start,end])=>Math.max(0,Math.min(end,at)-Math.max(start,at-24))).sort((a,b)=>b-a);
  return (lengths[0]??0)>=8-1e-9&&(lengths[0]??0)+(lengths[1]??0)>=11-1e-9;
};
test('hard rest schedules satisfy the rule throughout, not only when the shift starts', () => {
  assert.equal(qualifyingRest([[20,31],[34,36]],46),true); // Tue 22
  assert.equal(qualifyingRest([[20,31],[34,36]],46+1/60),false);
  for(const start of [35,36,37,38]) { // Tue 11,12,13,14
    const periods=[[0,11],[18,21],[27,start]];
    const valid=Array.from({length:481},(_,minute)=>start+minute/60).every(t=>qualifyingRest(periods,t));
    assert.equal(valid,start===38);
  }
  assert.equal(qualifyingRest([[16,32]],45),true);
  assert.equal(qualifyingRest([[16,32]],45+1/60),false);
  assert.equal(qualifyingRest([[0,8],[10,11.5],[13,14.5]],24),false);
  assert.equal(qualifyingRest([[0,7],[12,16]],24),false);
});
