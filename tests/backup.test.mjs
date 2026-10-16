import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, restoreBackup, backupSummary, MAX_BACKUP_BYTES } from '../src/backup.js';
import { replaceWebItems, recoverWebRestore, RESTORE_JOURNAL, createNativeStorage } from '../src/storage.js';
import { registerHooks } from 'node:module';
const hooks=registerHooks({load(url,context,nextLoad){
  if(url.endsWith('.png')) return {format:'module',source:`export default ${JSON.stringify(url)}`,shortCircuit:true};
  return nextLoad(url,context);
}});
const { QUESTIONS } = await import('../src/questions.js');
hooks.deregister();

function webStore(initial={}) {
  const values=new Map(Object.entries(initial));
  const store={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),get length(){return values.size},key:i=>[...values.keys()][i]??null};
  store.replaceItems=async changes=>replaceWebItems(store,changes);
  return store;
}
const fixture = () => createBackup(webStore({
  'taxi-teori-installation-id':'source', 'private-key':'secret', 'taxi-teori-active-session-v1':'in-progress',
  'taxi-teori-stats-source':'{"1":{"c":8,"w":2},"2":{"c":1,"w":3}}',
  'taxi-teori-history-source':JSON.stringify([{ts:1720000000000,mode:1,total:65,score:50,pct:77,passed:true,scoringVersion:2}]),
  'taxi-teori-saved-source':'[1,2]', 'taxi-teori-checklist-source':'[0,3]', 'taxi-teori-rir-source':'9',
  'taxi-teori-recent-questions-source':'[1,2,1]', 'taxi-teori-quick-hist-source':'[[1,2]]',
  'taxi-teori-language':'en','taxi-teori-theme':'dark','taxi-teori-text-scale':'2',
  'taxi-teori-notif-settings':'{"enabled":true,"timing":"day","sound":false,"vibration":true}',
}), 'source','2.3.0',QUESTIONS,10,new Date('2026-10-08T12:00:00Z'));

test('portable backup only includes allowed study fields and accurate preview totals',()=>{
  const file=fixture();
  assert.deepEqual(backupSummary(file),{attempts:14,correct:9,bookmarks:2,sessions:1});
  assert.doesNotMatch(JSON.stringify(file),/secret|source|in-progress|installation-id|question-images/);
  assert.deepEqual(parseBackup(JSON.stringify(file),QUESTIONS,10),file);
});
test('restore moves progress to current ID, preserves unrelated data and disables reminders',async()=>{
  const store=webStore({'taxi-teori-installation-id':'target',unrelated:'keep','taxi-teori-stats-target':'old','taxi-teori-active-session-v1':'remove','taxi-teori-notif-state':'old'});
  await restoreBackup(store,'target',fixture(),QUESTIONS,10);
  assert.equal(store.getItem('taxi-teori-installation-id'),'target');
  assert.equal(store.getItem('unrelated'),'keep');
  assert.equal(store.getItem('taxi-teori-stats-source'),null);
  assert.equal(store.getItem('taxi-teori-active-session-v1'),null);
  assert.equal(store.getItem('taxi-teori-notif-state'),null);
  const restored=createBackup(store,'target','2.3.0',QUESTIONS,10);
  const expected=fixture().data;expected.settings.feedback.enabled=false;
  assert.deepEqual(restored.data,expected);
  assert.equal(store.getItem(RESTORE_JOURNAL),null);
});
test('preview and cancelling by discarding the candidate do not change storage',()=>{
  const store=webStore({'taxi-teori-stats-target':'original'});
  const candidate=parseBackup(JSON.stringify(fixture()),QUESTIONS,10);backupSummary(candidate);
  assert.equal(store.length,1);assert.equal(store.getItem('taxi-teori-stats-target'),'original');
});
test('empty study data can be backed up and restored',async()=>{
  const store=webStore();const file=createBackup(store,'new','2.3.0',QUESTIONS,10);
  assert.deepEqual(backupSummary(file),{attempts:0,correct:0,bookmarks:0,sessions:0});
  await restoreBackup(store,'new',file,QUESTIONS,10);
  assert.deepEqual(createBackup(store,'new','2.3.0',QUESTIONS,10).data,file.data);
});
test('malformed, oversized and unsupported files are rejected',()=>{
  assert.throws(()=>parseBackup('{bad',QUESTIONS,10),/invalid-backup/);
  assert.throws(()=>parseBackup(' '.repeat(MAX_BACKUP_BYTES+1),QUESTIONS,10),/backup-too-large/);
  const file=fixture();file.version=2;
  assert.throws(()=>parseBackup(JSON.stringify(file),QUESTIONS,10),/backup-version/);
});
test('invalid fields are rejected without writing any data, including changed preview objects',async()=>{
  for(const mutate of [f=>f.data.stats[1].c=-1,f=>f.data.stats[1].w='2',f=>f.data.saved=[999999],f=>f.data.checklist=[50],f=>f.data.history[0].score=999,f=>f.data.settings.textScale=100,f=>f.data.saved=[1,1],f=>f.data.recent=Array(41).fill(1),f=>f.data.settings.feedback.enabled='true']) {
    const file=fixture();mutate(file);let writes=0;
    await assert.rejects(restoreBackup({replaceItems:()=>{writes++}},'id',file,QUESTIONS,10),/invalid-backup/);
    assert.equal(writes,0);
  }
});
test('unknown fields never become storage keys and prototype properties are rejected',()=>{
  const file=fixture();file.data['taxi-teori-installation-id']='attacker';file.data.settings.extra='secret';
  const parsed=parseBackup(JSON.stringify(file),QUESTIONS,10);
  assert.equal(parsed.data['taxi-teori-installation-id'],undefined);assert.equal(parsed.data.settings.extra,undefined);
  file.data.stats=JSON.parse('{"__proto__":{"c":1,"w":1}}');
  assert.throws(()=>parseBackup(JSON.stringify(file),QUESTIONS,10),/invalid-backup/);
});
test('daily answer and streaks survive a roundtrip and incorrect answer metadata is rejected',()=>{
  const file=fixture(),q=QUESTIONS[0];
  file.data.daily={date:'2026-10-08',questionId:q.id,answered:true,chosenIdx:q.correct,correct:true,streak:3,bestStreak:5};
  assert.deepEqual(parseBackup(JSON.stringify(file),QUESTIONS,10).data.daily,file.data.daily);
  file.data.daily.correct=false;assert.throws(()=>parseBackup(JSON.stringify(file),QUESTIONS,10),/invalid-backup/);
});
test('web mid-restore failure rolls back all keys, including removed keys',()=>{
  const store=webStore({'taxi-teori-a':'old a','taxi-teori-b':'old b'}),set=store.setItem;
  store.setItem=(key,value)=>{if(value==='fail')throw Error('quota');set(key,value)};
  assert.throws(()=>replaceWebItems(store,{'taxi-teori-a':null,'taxi-teori-new':'new','taxi-teori-b':'fail'}),/quota/);
  assert.equal(store.getItem('taxi-teori-a'),'old a');assert.equal(store.getItem('taxi-teori-b'),'old b');
  assert.equal(store.getItem('taxi-teori-new'),null);assert.equal(store.getItem(RESTORE_JOURNAL),null);
});
test('startup recovers interrupted restore, retaining journal if recovery itself fails',()=>{
  const store=webStore({'taxi-teori-a':'partial',[RESTORE_JOURNAL]:JSON.stringify([['taxi-teori-a','original'],['taxi-teori-new',null]])});
  const set=store.setItem;store.setItem=()=>{throw Error('disk')};
  assert.throws(()=>recoverWebRestore(store));assert.ok(store.getItem(RESTORE_JOURNAL));
  store.setItem=set;recoverWebRestore(store);
  assert.equal(store.getItem('taxi-teori-a'),'original');assert.equal(store.getItem(RESTORE_JOURNAL),null);
});
test('journal creation failure and corrupt journal leave existing data intact',()=>{
  const store=webStore({'taxi-teori-a':'original'}),set=store.setItem;
  store.setItem=()=>{throw Error('quota')};
  assert.throws(()=>replaceWebItems(store,{'taxi-teori-a':'new'}));assert.equal(store.getItem('taxi-teori-a'),'original');
  store.setItem=set;store.setItem(RESTORE_JOURNAL,JSON.stringify([['unrelated','overwrite']]));
  assert.throws(()=>recoverWebRestore(store));assert.equal(store.getItem('taxi-teori-a'),'original');
});
test('native replacement failure preserves memory and durable data; success survives restart',async()=>{
  let disk=JSON.stringify({version:1,values:{'taxi-teori-a':'original'}}),fail=false;
  const prefs={get:async()=>({value:disk}),set:async({value})=>{if(fail)throw Error('disk');disk=value}};
  const store=await createNativeStorage(prefs,webStore());
  fail=true;await assert.rejects(store.replaceItems({'taxi-teori-a':'new'}));
  assert.equal(store.getItem('taxi-teori-a'),'original');assert.equal(JSON.parse(disk).values['taxi-teori-a'],'original');
  fail=false;store.setItem('taxi-teori-b','queued');await store.replaceItems({'taxi-teori-a':'new'});
  const restarted=await createNativeStorage(prefs,webStore());
  assert.equal(restarted.getItem('taxi-teori-a'),'new');assert.equal(restarted.getItem('taxi-teori-b'),'queued');
});
