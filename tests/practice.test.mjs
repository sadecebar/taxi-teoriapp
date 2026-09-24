import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { getQuestionStatus, shuffle, buildStatusBuckets, selectFocusQuestions } from '../src/practice.js';

const statuses = ['ej övad', 'öva mer', 'på väg', 'behärskad'];
const counters = [{ c: 0, w: 0 }, { c: 1, w: 4 }, { c: 1, w: 0 }, { c: 3, w: 1 }];
function fixture(counts) {
  const questions = [], stats = {};
  counts.forEach((count, bucket) => {
    for (let n = 0; n < count; n++) {
      const id = questions.length + 1;
      questions.push({ id, correct: 0, options: ['yes', 'no'] });
      stats[id] = { ...counters[bucket] };
    }
  });
  return { questions, stats };
}
function seeded(seed = 12345) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
function composition(questions, stats) {
  const buckets = buildStatusBuckets(questions, stats);
  return statuses.map(status => buckets[status].length);
}
const unique = questions => assert.equal(new Set(questions.map(q => q.id)).size, questions.length);

test('A: focus guarantees 6/5/2/2 and 15 unique IDs across seeds', () => {
  const { questions, stats } = fixture([100, 100, 100, 100]);
  for (let seed = 0; seed < 100; seed++) {
    const session = selectFocusQuestions(questions, stats, [], seeded(seed));
    assert.deepEqual(composition(session, stats), [6, 5, 2, 2]);
    unique(session);
  }
});

test('B: missing quotas backfill in weak, progressing, unseen, mastered order', () => {
  for (const [counts, expected] of [
    [[2, 100, 100, 100], [2, 9, 2, 2]],
    [[2, 1, 100, 100], [2, 1, 10, 2]],
    [[100, 1, 1, 100], [11, 1, 1, 2]],
    [[2, 1, 1, 100], [2, 1, 1, 11]],
  ]) {
    const { questions, stats } = fixture(counts);
    const session = selectFocusQuestions(questions, stats, [], seeded());
    assert.deepEqual(composition(session, stats), expected);
    unique(session);
  }
});

test('C: canonical weak status includes every wrong/correct combination requested', () => {
  for (const s of [{ c: 1, w: 1 }, { c: 1, w: 4 }, { c: 1, w: 5 }, { c: 2, w: 3 }]) {
    const q = { id: 1 };
    assert.equal(getQuestionStatus(q, { 1: s }), 'öva mer');
    assert.deepEqual(selectFocusQuestions([q], { 1: s }), [q]);
  }
  assert.equal(getQuestionStatus({ id: 1 }, {}), 'ej övad');
  assert.equal(getQuestionStatus({ id: 1 }, { 1: { c: 1, w: 0 } }), 'på väg');
  assert.equal(getQuestionStatus({ id: 1 }, { 1: { c: 2, w: 1 } }), 'behärskad');
});

test('D: excludes all 40 recent attempted IDs when each bucket has alternatives', () => {
  const { questions, stats } = fixture([100, 100, 100, 100]);
  const recent = [...questions.slice(100, 120), ...questions.slice(200, 210), ...questions.slice(300, 310)].map(q => q.id);
  const session = selectFocusQuestions(questions, stats, recent, seeded());
  assert.equal(session.some(q => recent.includes(q.id)), false);
  assert.deepEqual(composition(session, stats), [6, 5, 2, 2]);
});

test('E: fallback takes oldest recent IDs; repeated IDs use most recent occurrence', () => {
  const { questions, stats } = fixture([6, 8, 2, 2]);
  // All weak candidates are recent; ID 7 has both newest and oldest entries.
  const recent = [7, 8, 9, 10, 11, 12, 13, 14, 7];
  const session = selectFocusQuestions(questions, stats, recent, seeded());
  assert.deepEqual(session.filter(q => getQuestionStatus(q, stats) === 'öva mer').map(q => q.id).sort((a,b) => a-b), [10, 11, 12, 13, 14]);
  assert.equal(session.length, 15);
});

test('F: handles empty, tiny, duplicate-input and single-status banks without duplicate IDs', () => {
  for (const counts of [[0,0,0,0], [2,3,1,1], [50,0,0,0], [0,50,0,0], [0,0,50,0], [0,0,0,50]]) {
    const { questions, stats } = fixture(counts);
    const session = selectFocusQuestions([...questions, ...questions], stats, questions.map(q => q.id), seeded());
    assert.equal(session.length, Math.min(15, questions.length));
    unique(session);
  }
});

test('unseen coverage overrides inconsistent recent history', () => {
  const { questions, stats } = fixture([6, 30, 30, 30]);
  const session = selectFocusQuestions(questions, stats, questions.slice(0,6).map(q => q.id), seeded());
  assert.deepEqual(composition(session, stats), [6,5,2,2]);
});

test('J: Fisher–Yates preserves input and reaches each small permutation equally', () => {
  const original = [1,2,3], permutations = new Set();
  for (let first = 0; first < 3; first++) for (let second = 0; second < 2; second++) {
    const draws = [(first + 0.5) / 3, (second + 0.5) / 2];
    permutations.add(shuffle(original, () => draws.shift()).join(','));
  }
  assert.equal(permutations.size, 6);
  assert.deepEqual(original, [1,2,3]);
  assert.deepEqual(shuffle([]), []);
  const counts = [0,0,0,0,0], random = seeded();
  for (let i = 0; i < 50000; i++) counts[shuffle([0,1,2,3,4], random)[0]]++;
  for (const count of counts) assert.ok(Math.abs(count - 10000) < 500);
  for (const file of ['App.jsx', 'DevPanel.jsx']) {
    assert.doesNotMatch(readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), /\.sort\(\(\)\s*=>\s*Math\.random\(\)\s*-\s*0\.5\)/);
  }
});

test('real 460-question bank: ten completed focus sessions introduce 60 unseen questions', async () => {
  // Node needs only an asset URL to load the untouched Vite question bank.
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url.endsWith('.png')) return { format: 'module', source: `export default ${JSON.stringify(url)}`, shortCircuit: true };
    return nextLoad(url, context);
  } });
  const { QUESTIONS } = await import('../src/questions.js');
  hooks.deregister();
  assert.equal(QUESTIONS.length, 460);
  const { stats: initialStats } = fixture([197,84,116,63]);
  // Assign by bank order; do not change any question data or IDs.
  const stats = Object.fromEntries(QUESTIONS.map((q,i) => [q.id, initialStats[i+1]]));
  assert.deepEqual(composition(QUESTIONS, stats), [197,84,116,63]);
  let recent = [];
  const introduced = new Set(), random = seeded();
  for (let round = 0; round < 10; round++) {
    const session = selectFocusQuestions(QUESTIONS, stats, recent, random);
    assert.deepEqual(composition(session, stats), [6,5,2,2]);
    assert.equal(session.some(q => recent.includes(q.id)), false);
    unique(session);
    for (const q of session) {
      if (getQuestionStatus(q, stats) === 'ej övad') introduced.add(q.id);
      stats[q.id] = { ...stats[q.id], c: stats[q.id].c + 1 };
      recent = [q.id, ...recent].slice(0,40);
    }
  }
  assert.equal(introduced.size, 60);
  assert.equal(composition(QUESTIONS, stats)[0], 137);
});
