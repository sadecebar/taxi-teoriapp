// Portable study data only: no installation ID, credentials, question text or images.
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const FORMAT = 'taxi-teori-backup';
const modes = new Set(['legislation','all','quick','focus','rir','bilder','review',1,2,10,20,30]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, max=1e9) => Number.isSafeInteger(value) && value>=0 && value<=max;
const fail = () => { throw Error('invalid-backup'); };
const read = (store,key,fallback) => { const raw=store.getItem(key); return raw===null ? fallback : JSON.parse(raw); };

export function createBackup(store, id, appVersion, bank, checklistCount, now=new Date()) {
  const data = {
    stats:read(store,`taxi-teori-stats-${id}`,{}),
    history:read(store,`taxi-teori-history-${id}`,[]),
    saved:read(store,`taxi-teori-saved-${id}`,[]),
    checklist:read(store,`taxi-teori-checklist-${id}`,[]),
    daily:read(store,`taxi-teori-daily-${id}`,null),
    streak:read(store,`taxi-teori-rir-${id}`,0),
    recent:read(store,`taxi-teori-recent-questions-${id}`,[]),
    quickHistory:read(store,`taxi-teori-quick-hist-${id}`,[]),
    settings:{
      language:store.getItem('taxi-teori-language')||'sv',
      theme:store.getItem('taxi-teori-theme')||'light',
      textScale:Number(store.getItem('taxi-teori-text-scale')||1),
      feedback:read(store,'taxi-teori-notif-settings',{enabled:false,timing:'evening',sound:true,vibration:true}),
    },
  };
  return parseBackup(JSON.stringify({format:FORMAT,version:1,appVersion,createdAt:now.toISOString(),data}),bank,checklistCount);
}

export function parseBackup(text, bank, checklistCount) {
  if (typeof text!=='string' || new TextEncoder().encode(text).length>MAX_BACKUP_BYTES) throw Error('backup-too-large');
  let file;
  try { file=JSON.parse(text); } catch { fail(); }
  if (!object(file) || file.format!==FORMAT) fail();
  if (file.version!==1) throw Error('backup-version');
  if (typeof file.createdAt!=='string' || file.createdAt.length>40 || !Number.isFinite(Date.parse(file.createdAt)) || typeof file.appVersion!=='string' || file.appVersion.length>40) fail();
  const d=file.data;
  if (!object(d) || !object(d.stats) || !object(d.settings) || !number(d.streak)) fail();
  const byId=new Map(bank.map(q=>[q.id,q]));
  const ids=(items,max,unique=true)=>Array.isArray(items)&&items.length<=max&&items.every(id=>Number.isInteger(id)&&byId.has(id))&&(!unique||new Set(items).size===items.length);
  const stats={};
  for(const [key,value] of Object.entries(d.stats)) {
    if (!byId.has(Number(key)) || String(Number(key))!==key || !object(value) || !number(value.c) || !number(value.w)) fail();
    stats[key]={c:value.c,w:value.w};
  }
  if (!ids(d.saved,bank.length) || !ids(d.recent,40,false) || !Array.isArray(d.quickHistory) || d.quickHistory.length>10 || d.quickHistory.some(h=>!ids(h,bank.length))) fail();
  if (!Array.isArray(d.checklist) || d.checklist.some(i=>!number(i,checklistCount-1)) || new Set(d.checklist).size!==d.checklist.length) fail();
  if (!Array.isArray(d.history) || d.history.length>200) fail();
  const history=d.history.map(h=>{
    if (!object(h) || !number(h.ts,8640000000000000) || !modes.has(h.mode) || !number(h.total,bank.length) || !number(h.score,h.total) || (h.scoringVersion!==undefined && ![1,2].includes(h.scoringVersion))) fail();
    const pct=h.total?Math.round(h.score/h.total*100):0;
    return {ts:h.ts,mode:h.mode,score:h.score,total:h.total,pct,scoringVersion:h.scoringVersion??1,passed:h.mode===1?h.score>=48:h.mode===2?h.score>=34:h.total>0&&pct>=70};
  });
  let daily=null;
  if (d.daily!==null) {
    const q=byId.get(d.daily?.questionId), day=d.daily;
    if (!q || typeof day.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(Date.parse(day.date)) || typeof day.answered!=='boolean' || !number(day.streak) || !number(day.bestStreak)) fail();
    if (day.answered ? !number(day.chosenIdx,q.options.length-1) || typeof day.correct!=='boolean' || day.correct!==(day.chosenIdx===q.correct) : day.chosenIdx!==null || day.correct!==null) fail();
    daily={date:day.date,questionId:q.id,answered:day.answered,chosenIdx:day.chosenIdx,correct:day.correct,streak:day.streak,bestStreak:day.bestStreak};
  }
  const s=d.settings, f=s.feedback;
  if (!['sv','en'].includes(s.language) || !['light','dark'].includes(s.theme) || ![1,1.25,1.5,2].includes(s.textScale) || !object(f) || !['day','lunch','evening'].includes(f.timing) || typeof f.sound!=='boolean' || typeof f.vibration!=='boolean' || typeof f.enabled!=='boolean') fail();
  // Reconstruct known fields instead of importing arbitrary storage keys or extra JSON properties.
  return {format:FORMAT,version:1,appVersion:file.appVersion,createdAt:file.createdAt,data:{stats,history,saved:[...d.saved],checklist:[...d.checklist],daily,streak:d.streak,recent:[...d.recent],quickHistory:d.quickHistory.map(h=>[...h]),settings:{language:s.language,theme:s.theme,textScale:s.textScale,feedback:{enabled:f.enabled,timing:f.timing,sound:f.sound,vibration:f.vibration}}}};
}

export function backupSummary(file) {
  const stats=Object.values(file.data.stats);
  return {attempts:stats.reduce((n,s)=>n+s.c+s.w,0),correct:stats.reduce((n,s)=>n+s.c,0),bookmarks:file.data.saved.length,sessions:file.data.history.length};
}

export async function restoreBackup(store, id, file, bank, checklistCount) {
  const {data:d}=parseBackup(JSON.stringify(file),bank,checklistCount);
  const changes={};
  for(const [key,value] of Object.entries({stats:d.stats,history:d.history,saved:d.saved,checklist:d.checklist,daily:d.daily,rir:d.streak,'recent-questions':d.recent,'quick-hist':d.quickHistory})) {
    changes[`taxi-teori-${key}-${id}`]=value===null?null:JSON.stringify(value);
  }
  Object.assign(changes,{
    'taxi-teori-language':d.settings.language,'taxi-teori-theme':d.settings.theme,'taxi-teori-text-scale':String(d.settings.textScale),
    'taxi-teori-notif-settings':JSON.stringify({...d.settings.feedback,enabled:false}),
    'taxi-teori-notif-state':null,'taxi-teori-active-session-v1':null,
    [`taxi-teori-migrated-${id}`]:'1', [`taxi-teori-onboarding-done-${id}`]:'1',
  });
  await store.replaceItems(changes);
}
