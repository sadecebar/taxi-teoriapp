export const NATIVE_STATE_KEY = 'taxi-teori-state-v1';
const owned = key => typeof key === 'string' && key.startsWith('taxi-teori-');
export const RESTORE_JOURNAL = 'taxi-teori-restore-journal-v1';

export function recoverWebRestore(web) {
  const raw = web.getItem(RESTORE_JOURNAL);
  if (!raw) return;
  const previous = JSON.parse(raw);
  if (!Array.isArray(previous) || previous.some(item => !Array.isArray(item) || item.length !== 2 || !owned(item[0]) || item[0] === RESTORE_JOURNAL || (item[1] !== null && typeof item[1] !== 'string'))) throw Error('Invalid restore journal');
  // Free space occupied by a partially imported, larger backup before rollback.
  // Keep the journal until every original value has been recovered.
  for (const [key] of previous) web.removeItem(key);
  for (const [key, value] of previous) if (value !== null) web.setItem(key, value);
  web.removeItem(RESTORE_JOURNAL);
}

export function replaceWebItems(web, changes) {
  recoverWebRestore(web);
  validateChanges(changes);
  const previous = Object.keys(changes).map(key => [key, web.getItem(key)]);
  // Retain the original state if the tab closes or a quota error interrupts a restore.
  web.setItem(RESTORE_JOURNAL, JSON.stringify(previous));
  try {
    for (const [key, value] of Object.entries(changes)) value === null ? web.removeItem(key) : web.setItem(key, value);
    web.removeItem(RESTORE_JOURNAL);
  } catch (error) {
    recoverWebRestore(web);
    throw error;
  }
}

function validateChanges(changes) {
  if (!changes || Object.entries(changes).some(([key,value]) => !owned(key) || key === RESTORE_JOURNAL || (value !== null && typeof value !== 'string'))) throw Error('Invalid replacement');
}

// One small snapshot keeps session, counters and installation ID together.
// Native writes are ordered and coalesced within each synchronous action.
export async function createNativeStorage(preferences, legacy) {
  const { value } = await preferences.get({ key: NATIVE_STATE_KEY });
  let entries;
  if (value === null) {
    entries = [];
    for (let i = 0; i < legacy.length; i++) {
      const key = legacy.key(i);
      if (key && owned(key)) entries.push([key, legacy.getItem(key)]);
    }
    await preferences.set({ key: NATIVE_STATE_KEY, value: JSON.stringify({ version: 1, values: Object.fromEntries(entries) }) });
  } else {
    const parsed = JSON.parse(value);
    if (parsed?.version !== 1 || !parsed.values || typeof parsed.values !== 'object' || Array.isArray(parsed.values)) throw Error('Invalid saved state');
    entries = Object.entries(parsed.values);
    if (entries.some(([key, item]) => !owned(key) || typeof item !== 'string')) throw Error('Invalid saved entry');
  }
  const values = new Map(entries);
  const listeners = new Set();
  let pending = Promise.resolve(), scheduled = false, failure = null;
  let replacing = false;
  const notify = () => listeners.forEach(fn => fn(failure));
  const enqueue = () => {
    const snapshot = JSON.stringify({ version: 1, values: Object.fromEntries(values) });
    pending = pending.then(() => preferences.set({ key: NATIVE_STATE_KEY, value: snapshot }))
      .then(() => { failure = null; notify(); })
      .catch(error => { failure = error; notify(); });
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; enqueue(); });
  };
  const flush = async () => {
    await Promise.resolve();
    let current;
    do { current = pending; await current; } while (current !== pending);
    if (failure) throw failure;
  };
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      if (replacing) throw Error('Restore in progress');
      if (!owned(key)) throw Error('Unsupported storage key');
      values.set(key, String(value)); schedule();
    },
    removeItem(key) { if (replacing) throw Error('Restore in progress'); values.delete(key); schedule(); },
    async replaceItems(changes) {
      validateChanges(changes);
      if (replacing) throw Error('Restore in progress');
      replacing = true;
      try {
        await flush();
        const next = new Map(values);
        for (const [key,value] of Object.entries(changes)) value === null ? next.delete(key) : next.set(key,value);
        await preferences.set({key:NATIVE_STATE_KEY,value:JSON.stringify({version:1,values:Object.fromEntries(next)})});
        values.clear();
        next.forEach((value,key)=>values.set(key,value));
      } finally { replacing = false; }
    },
    flush,
    retry() { schedule(); return flush(); },
    getError: () => failure,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

let nativeStorage = null;
export async function initializeNativeStorage(preferences, legacy = localStorage) {
  nativeStorage = await createNativeStorage(preferences, legacy);
}

// Web builds continue to use their existing localStorage data.
export const storage = {
  replaceItems: async changes => nativeStorage ? nativeStorage.replaceItems(changes) : replaceWebItems(localStorage, changes),
  getItem: key => (nativeStorage ?? localStorage).getItem(key),
  setItem: (key, value) => (nativeStorage ?? localStorage).setItem(key, value),
  removeItem: key => (nativeStorage ?? localStorage).removeItem(key),
  flush: () => nativeStorage?.flush() ?? Promise.resolve(),
  retry: () => nativeStorage?.retry() ?? Promise.resolve(),
  getError: () => nativeStorage?.getError() ?? null,
  subscribe: fn => nativeStorage?.subscribe(fn) ?? (() => {}),
};
