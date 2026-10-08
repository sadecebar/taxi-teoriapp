import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeStorage } from '../src/storage.js';
import { createQuiz } from '../src/exam.js';
import { saveSession, loadSession, clearSession } from '../src/quiz-session.js';

function legacy(values={}) {
  const data=new Map(Object.entries(values));
  return {get length(){return data.size;},key:index=>[...data.keys()][index],getItem:key=>data.get(key)??null};
}
function preferences(initial=null) {
  let value=initial;
  return {get:async()=>({value}),set:async({value:next})=>{value=next;}};
}
test('native migration preserves existing progress and installation ID, and leaves legacy data intact',async()=>{
  const old=legacy({'taxi-teori-installation-id':'same-id','taxi-teori-stats-same-id':'{"1":{"c":2,"w":1}}',unrelated:'private'});
  const prefs=preferences();const store=await createNativeStorage(prefs,old);
  assert.equal(store.getItem('taxi-teori-installation-id'),'same-id');
  assert.equal(store.getItem('taxi-teori-stats-same-id'),old.getItem('taxi-teori-stats-same-id'));
  assert.equal(store.getItem('unrelated'),null);
  assert.equal(old.length,3);
});
test('a new targeted session survives reload even when web storage still contains an older session',async()=>{
  const bank=[{id:1,question:'q',options:['yes','no'],correct:0}];
  const old=legacy({'taxi-teori-active-session-v1':'old web session'});
  const prefs=preferences();let store=await createNativeStorage(prefs,old);
  saveSession(createQuiz(bank,'review'),'review',null,store);
  await store.flush();
  store=await createNativeStorage(prefs,old);
  assert.equal(loadSession(bank,store).mode,'review');
  clearSession(store);store.setItem('taxi-teori-stats-test','finished');
  await store.flush();
  store=await createNativeStorage(prefs,old);
  assert.equal(loadSession(bank,store),null);
  assert.equal(store.getItem('taxi-teori-stats-test'),'finished');
});
test('queued writes retain the latest change when an earlier native write is slow',async()=>{
  const prefs=preferences(JSON.stringify({version:1,values:{}}));
  const original=prefs.set;let release;
  prefs.set=async args=>{await new Promise(resolve=>{release=resolve;});await original(args);};
  const store=await createNativeStorage(prefs,legacy());
  store.setItem('taxi-teori-a','first');
  await new Promise(resolve=>setImmediate(resolve));
  store.setItem('taxi-teori-a','latest');
  await new Promise(resolve=>setImmediate(resolve));
  release();
  await new Promise(resolve=>setImmediate(resolve));
  release();await store.flush();
  assert.equal((await createNativeStorage(prefs,legacy())).getItem('taxi-teori-a'),'latest');
});
test('failed writes surface an error and retry persists the retained in-memory value',async()=>{
  const prefs=preferences(JSON.stringify({version:1,values:{}}));const original=prefs.set;
  const store=await createNativeStorage(prefs,legacy());let reported=null;
  const unsubscribe=store.subscribe(error=>{reported=error;});
  prefs.set=async()=>{throw Error('disk unavailable');};
  store.setItem('taxi-teori-a','new');
  await assert.rejects(store.flush(),/disk unavailable/);
  assert.ok(reported);
  assert.equal(store.getItem('taxi-teori-a'),'new');
  prefs.set=original;await store.retry();
  assert.equal(reported,null);
  assert.equal((await createNativeStorage(prefs,legacy())).getItem('taxi-teori-a'),'new');
  unsubscribe();
});
test('corrupt native state is never overwritten with stale browser data',async()=>{
  let writes=0;
  const prefs={get:async()=>({value:'corrupt'}),set:async()=>{writes++;}};
  await assert.rejects(createNativeStorage(prefs,legacy({'taxi-teori-a':'stale'})));
  assert.equal(writes,0);
});
