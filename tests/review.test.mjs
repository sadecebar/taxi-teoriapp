import test from 'node:test';
import assert from 'node:assert/strict';
import { filterReviewAnswers, reviewCounts, retryQuestions, canonicalReviewQuestions, weakestCategory } from '../src/review.js';
import { createQuiz, quizResult } from '../src/exam.js';
import { commitQuizAnswer, advanceQuiz } from '../src/practice.js';
import { saveSession, loadSession } from '../src/quiz-session.js';

const bank = Array.from({length:5},(_,i)=>({id:i+1,question:`Question ${i+1}`,options:['Yes','No'],correct:0}));
const answers = [
  {id:1,q:bank[0],chosen:0,correct:true,counted:true},
  {id:2,q:bank[1],chosen:1,correct:false,counted:true},
  {id:3,q:bank[2],chosen:null,correct:false,counted:true},
  {id:4,q:bank[3],chosen:1,correct:false,counted:false},
];
test('review keeps unanswered separate from wrong, and includes unscored questions for learning',()=>{
  assert.deepEqual(reviewCounts(answers),{all:4,wrong:2,unanswered:1,correct:1});
  assert.deepEqual(filterReviewAnswers(answers,'wrong').map(a=>a.id),[2,4]);
  assert.deepEqual(filterReviewAnswers(answers,'unanswered').map(a=>a.id),[3]);
  assert.deepEqual(filterReviewAnswers(answers,'correct').map(a=>a.id),[1]);
});
test('default retry excludes correct answers, explicit selection contains exactly that selection',()=>{
  assert.deepEqual(retryQuestions(answers).map(q=>q.id),[2,3,4]);
  assert.deepEqual(retryQuestions(answers,'wrong').map(q=>q.id),[2,4]);
  assert.deepEqual(retryQuestions(answers,'unanswered').map(q=>q.id),[3]);
  assert.deepEqual(retryQuestions(answers,'correct').map(q=>q.id),[1]);
  assert.equal(answers.length,4);
});
test('empty and perfect results offer no missed-question retry',()=>{
  assert.deepEqual(retryQuestions([]),[]);
  assert.deepEqual(retryQuestions([answers[0]]),[]);
  assert.deepEqual(reviewCounts([]),{all:0,wrong:0,unanswered:0,correct:0});
});
test('targeted practice never inserts unrelated questions and uses current canonical content',()=>{
  const old = {...bank[1],question:'old'};
  const selected=canonicalReviewQuestions([old,bank[1],{id:999}],bank);
  assert.deepEqual(selected,[bank[1]]);
  assert.equal(selected[0],bank[1]);
  assert.deepEqual(canonicalReviewQuestions([],bank),[]);
});
test('saved targeted practice survives restart and prevents double registration of revealed answers',()=>{
  let value=null;
  const storage={setItem:(key,data)=>{value=data;},getItem:()=>value,removeItem:()=>{value=null;}};
  const questions=retryQuestions(answers,'wrong');
  let quiz=createQuiz(questions,'review');
  quiz=commitQuizAnswer(quiz,0);
  assert.equal(saveSession(quiz,'review',null,storage),true);
  const restored=loadSession(bank,storage);
  assert.equal(restored.mode,'review');
  assert.equal(restored.deadline,null);
  assert.deepEqual(restored.quiz.questions.map(q=>q.id),[2,4]);
  assert.equal(commitQuizAnswer(restored.quiz,1),restored.quiz);
  quiz=advanceQuiz(restored.quiz,'review');
  assert.equal(quiz.current,1);
  assert.equal(quiz.answered,null);
  quiz=commitQuizAnswer(quiz,0);
  assert.equal(advanceQuiz(quiz,'review').finished,true);
  assert.equal(quizResult(quiz,'review').score,2);
  assert.equal(quizResult(quiz,'review').total,2);
  assert.deepEqual(retryQuestions(quizResult(quiz,'review').answers),[]);
});
test('weakest area is based on actual questions needing practice, not untried coverage',()=>{
  const areas=[{key:'new',weakCount:0,pct:0},{key:'some',weakCount:1,pct:10},{key:'many',weakCount:5,pct:80}];
  assert.equal(weakestCategory(areas).key,'many');
  assert.equal(weakestCategory(areas.slice(0,1)),null);
  assert.equal(weakestCategory([]),null);
});
