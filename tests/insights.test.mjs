import test from 'node:test';
import assert from 'node:assert/strict';
import { coveragePercent, knowledgeDistribution, recentTestResults, resultSummary, appendStudyHistory } from '../src/study-insights.js';

test('knowledge distribution counts every canonical question once, not orphaned statistics',()=>{
  const bank=[1,2,3,4].map(id=>({id}));
  assert.deepEqual(knowledgeDistribution(bank,{1:{c:2,w:0},2:{c:1,w:0},3:{c:1,w:1},900:{c:99,w:0}}),{'behärskad':1,'på väg':1,'öva mer':1,'ej övad':1});
  assert.equal(coveragePercent(458,460),99.6);
  assert.equal(coveragePercent(460,460),100);
  assert.equal(coveragePercent(0,0),0);
});
test('chart uses last ten eligible tests in chronological order without modifying saved history',()=>{
  const history=Array.from({length:14},(_,i)=>({ts:14-i,mode:'quick',score:10,total:15}));
  history.unshift({ts:20,mode:'focus',score:15,total:15},{ts:19,mode:1,score:60,total:70,scoringVersion:1});
  const snapshot=JSON.stringify(history), results=recentTestResults(history);
  assert.equal(results.length,10); assert.deepEqual(results.map(h=>h.ts),[5,6,7,8,9,10,11,12,13,14]);
  assert.equal(JSON.stringify(history),snapshot);
});
test('exam thresholds and chart summary use scored answers, not a universal 70 percent line',()=>{
  const entries=recentTestResults([{ts:1,mode:1,score:47,total:65,scoringVersion:2,passed:true},{ts:2,mode:2,score:34,total:46,scoringVersion:2,passed:false}]);
  assert.equal(entries[0].passed,false);assert.equal(entries[1].passed,true);
  assert.equal(entries[0].threshold,48/65*100);
  assert.deepEqual(resultSummary(entries),{average:73,best:74,passed:1});
  assert.equal(recentTestResults(entries,2).length,1);
  assert.deepEqual(resultSummary([]),{average:null,best:null,passed:0});
});
test('malformed records and empty tests do not produce misleading chart bars',()=>{
  assert.equal(recentTestResults([{ts:1,mode:'quick',score:0,total:0},{ts:2,mode:'quick',score:16,total:15},{ts:3,mode:'quick',score:NaN,total:15}]).length,0);
});
test('the last ten tests survive over 100 intervening practice sessions',()=>{
  let history=Array.from({length:10},(_,i)=>({ts:10-i,mode:'quick',score:10,total:15}));
  for(let ts=11;ts<140;ts++)history=appendStudyHistory({ts,mode:'review',score:1,total:1},history);
  assert.equal(recentTestResults(history).length,10);
  assert.equal(history.length,110);
});
