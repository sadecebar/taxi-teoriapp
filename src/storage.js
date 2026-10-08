export const NATIVE_STATE_KEY = 'taxi-teori-state-v1';
const owned = key => key.startsWith('taxi-teori-');

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
      if (!owned(key)) throw Error('Unsupported storage key');
      values.set(key, String(value)); schedule();
    },
    removeItem(key) { values.delete(key); schedule(); },
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
  getItem: key => (nativeStorage ?? localStorage).getItem(key),
  setItem: (key, value) => (nativeStorage ?? localStorage).setItem(key, value),
  removeItem: key => (nativeStorage ?? localStorage).removeItem(key),
  flush: () => nativeStorage?.flush() ?? Promise.resolve(),
  retry: () => nativeStorage?.retry() ?? Promise.resolve(),
  getError: () => nativeStorage?.getError() ?? null,
  subscribe: fn => nativeStorage?.subscribe(fn) ?? (() => {}),
};
