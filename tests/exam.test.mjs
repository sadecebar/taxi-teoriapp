import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuiz, selectExamAnswer, moveExam, quizResult, historyPassed } from '../src/exam.js';
import { saveSession, loadSession, SESSION_KEY } from '../src/quiz-session.js';
import { commitQuizAnswer, advanceQuiz } from '../src/practice.js';
import { remainingSeconds } from '../src/mobile-timer.js';
import { optionStyles } from '../src/quiz-options.js';

const bank = Array.from({length:70}, (_,i) => ({id:i+1, question:`Question ${i+1}`, options:['Yes','No'], correct:0, explanation:'Why'}));
const memory = () => { const values = new Map(); return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; };
function answerCount(quiz, count) {
  let answered=0;
  quiz.questions.forEach((q,index) => {
    if(!quiz.unscoredIds.includes(q.id) && answered++ < count) quiz=selectExamAnswer(moveExam(quiz,index),0);
  });
  return quiz;
}

for (const [mode, total, counted, passMark] of [[1,70,65,48],[2,50,46,34]]) {
  test(`DP${mode}: unscored questions never inflate score; boundary is ${passMark}/${counted}`, () => {
    const initial=createQuiz(bank.slice(0,total),mode,()=>0.5);
    assert.equal(new Set(initial.unscoredIds).size,total-counted);
    let quiz=answerCount(initial,passMark-1);
    initial.questions.forEach((q,index)=>{if(initial.unscoredIds.includes(q.id)) quiz=selectExamAnswer(moveExam(quiz,index),0);});
    assert.equal(quizResult(quiz,mode).score,passMark-1);
    assert.equal(quizResult(quiz,mode).passed,false);
    assert.equal(quizResult(answerCount(initial,passMark),mode).passed,true);
    const perfect=quizResult(answerCount(initial,counted),mode);
    assert.equal(perfect.score,counted);
    assert.equal(perfect.total,counted);
    assert.equal(perfect.pct,100);
    assert.equal(perfect.answers.length,total);
  });
  test(`DP${mode}: zero or partial answers still use full scored denominator on timeout`, () => {
    const initial=createQuiz(bank.slice(0,total),mode);
    const empty=quizResult(initial,mode);
    assert.equal(empty.total,counted);
    assert.equal(empty.score,0);
    assert.equal(empty.pct,0);
    assert.equal(empty.unanswered,total);
    assert.equal(empty.passed,false);
    assert.equal(quizResult(answerCount(initial,1),mode).total,counted);
  });
}
test('editable answers replace the prior choice, retain navigation state, and grade the final choice',()=>{
  let quiz=createQuiz(bank,1);
  quiz=selectExamAnswer(quiz,0);
  quiz=selectExamAnswer(quiz,1);
  assert.equal(quiz.answers.length,1);
  assert.equal(quiz.answers[0].correct,false);
  quiz=moveExam(quiz,5);
  assert.equal(quiz.answered,null);
  quiz=moveExam(quiz,0);
  assert.equal(quiz.answered,1);
  assert.equal(selectExamAnswer(quiz,7),quiz);
  assert.equal(moveExam(quiz,-1),quiz);
  const done={...quiz,finished:true};
  assert.equal(selectExamAnswer(done,0),done);
  assert.equal(moveExam(done,1),done);
  assert.equal(quizResult(quiz,1).answers[0].chosen,1);
});
test('exam selection styling cannot reveal the correct answer',()=>{
  const C={goldBg:'gold',gold:'border',goldLight:'text',surface:'surface',border:'normal',textSoft:'soft',surfaceAlt:'alt',muted:'muted'};
  for(let option=0;option<2;option++) assert.deepEqual(optionStyles(C,option,0,0,false),optionStyles(C,option,1,0,false));
});
test('exam survives process loss with choices, position, unscored IDs and original deadline',()=>{
  const storage=memory();
  let quiz=createQuiz(bank,1);
  quiz=selectExamAnswer(quiz,1);
  quiz=moveExam(quiz,4);
  quiz=selectExamAnswer(quiz,0);
  assert.equal(saveSession(quiz,1,100000,storage),true);
  const restored=loadSession(bank,storage);
  assert.deepEqual(restored.quiz,quiz);
  assert.equal(restored.deadline,100000);
  assert.equal(remainingSeconds(restored.deadline,95000),5);
  assert.equal(remainingSeconds(loadSession(bank,storage).deadline,120000),0);
});
test('training resumes a revealed answer without allowing it to be committed twice',()=>{
  const storage=memory();
  const quiz=commitQuizAnswer(createQuiz(bank.slice(0,10),10),0);
  saveSession(quiz,10,null,storage);
  const restored=loadSession(bank,storage).quiz;
  assert.equal(commitQuizAnswer(restored,1),restored);
  assert.equal(advanceQuiz(restored,10).current,1);
  assert.equal(advanceQuiz(restored,10).answered,null);
});
test('stale question content and corrupt or duplicate choices safely invalidate saved sessions',()=>{
  const storage=memory();
  const quiz=selectExamAnswer(createQuiz(bank,1),0);
  for(const mutate of [data=>{data.answers.push(data.answers[0]);},data=>{data.current=70;},data=>{data.deadline=null;},data=>{data.unscoredIds=[];},data=>{data.questions[0].fingerprint='stale';},data=>{data.answers[0].chosen=-1;}]) {
    saveSession(quiz,1,100000,storage);
    const data=JSON.parse(storage.getItem(SESSION_KEY));mutate(data);storage.setItem(SESSION_KEY,JSON.stringify(data));
    assert.equal(loadSession(bank,storage),null);
    assert.equal(storage.getItem(SESSION_KEY),null);
  }
  storage.setItem(SESSION_KEY,'broken');
  assert.equal(loadSession(bank,storage),null);
});
test('completion clears resumable data and unavailable storage is handled',()=>{
  const storage=memory(); const quiz=createQuiz(bank,1);
  saveSession(quiz,1,100000,storage);
  saveSession({...quiz,finished:true},1,null,storage);
  assert.equal(loadSession(bank,storage),null);
  assert.equal(saveSession(quiz,1,100000,{setItem(){throw Error('full');}}),false);
});
test('history uses the exam-specific pass mark instead of a universal seventy percent',()=>{
  assert.equal(historyPassed({mode:1,score:47,pct:72}),false);
  assert.equal(historyPassed({mode:1,score:48,pct:74}),true);
  assert.equal(historyPassed({mode:2,score:33,pct:72}),false);
  assert.equal(historyPassed({mode:2,score:34,pct:74}),true);
  assert.equal(historyPassed({mode:'quick',pct:70}),true);
});
