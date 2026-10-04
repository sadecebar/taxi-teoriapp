import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { commitQuizAnswer, advanceQuiz } from '../src/practice.js';
import { optionStyles } from '../src/quiz-options.js';
import { readFileSync } from 'node:fs';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
localStorage.setItem('taxi-teori-installation-id', 'practice-test');
const { commitPracticeAnswer, loadLocalStats, loadRecentQuestions, recordRecentQuestion, clearRecentQuestions } = await import('../src/progress.js');
const recentKey = 'taxi-teori-recent-questions-practice-test';
const statsKey = 'taxi-teori-stats-practice-test';
beforeEach(() => { storage.clear(); localStorage.setItem('taxi-teori-installation-id', 'practice-test'); });
const questions = [{ id: 1, options: ['correct','wrong'], correct: 0 }, { id: 2, options: ['correct','wrong'], correct: 0 }];
const session = () => ({ questions, current: 0, answered: null, answers: [], finished: false });

// Same transition/commit boundary used by the App's synchronous quiz reference.
function harness(initial = session()) {
  let quiz = initial, stats = loadLocalStats() || {};
  return {
    select(chosen) {
      const committed = commitQuizAnswer(quiz, chosen);
      if (committed === quiz) return;
      quiz = committed;
      const attempt = quiz.answers.at(-1);
      stats = commitPracticeAnswer(stats, attempt.id, attempt.correct);
    },
    next(mode = 'focus') { quiz = advanceQuiz(quiz, mode); },
    end() { quiz = { ...quiz, finished: true }; return quiz.answers; },
    get quiz() { return quiz; },
  };
}

test('G: correct and wrong selections persist immediately, before Next', () => {
  localStorage.setItem(statsKey, JSON.stringify({ 1: { c: 1, w: 4 }, 99: { c: 7, w: 2 } }));
  const app = harness();
  app.select(0);
  assert.deepEqual(loadLocalStats(), { 1: { c: 2, w: 4 }, 99: { c: 7, w: 2 } });
  assert.deepEqual(loadRecentQuestions(), [1]);
  assert.equal(app.quiz.answers[0].correct, true);
  app.next();
  app.select(1);
  assert.deepEqual(loadLocalStats()[2], { c: 0, w: 1 });
  assert.deepEqual(loadRecentQuestions(), [2,1]);
  assert.equal(app.quiz.answers[1].correct, false);
});

test('H: repeat selection, Next, double Next, result and timeout never double count', () => {
  const app = harness();
  app.select(0);
  app.select(0);
  app.select(1);
  app.next();
  app.next();
  assert.equal(app.quiz.current, 1);
  assert.equal(app.quiz.answered, null);
  app.select(1);
  app.next();
  app.next();
  app.select(0);
  app.end();
  app.end();
  assert.deepEqual(loadLocalStats(), { 1: { c: 1, w: 0 }, 2: { c: 0, w: 1 } });
  assert.deepEqual(loadRecentQuestions(), [2,1]);
  assert.equal(app.quiz.answers.length, 2);
});

test('I: answer and history survive discarding session and reloading progress', async () => {
  harness().select(1); // Exit without Next; discard all session state.
  const remountedStorage = await import('../src/progress.js?remount');
  assert.deepEqual(remountedStorage.loadLocalStats(), { 1: { c: 0, w: 1 } });
  assert.deepEqual(remountedStorage.loadRecentQuestions(), [1]);
  assert.deepEqual(harness().quiz.answers, []);
});

test('timeout includes selected current answer and never penalizes an unanswered question', () => {
  const app = harness();
  app.select(0);
  const results = app.end();
  assert.equal(results.length, 1);
  assert.equal(results[0].correct, true);
  assert.equal(loadLocalStats()[2], undefined);
  app.select(1);
  assert.equal(app.quiz.answers.length, 1);
  assert.deepEqual(harness().end(), []);
});

test('Rätt i rad ends on wrong committed answer; ordinary sessions advance', () => {
  const app = harness();
  app.select(1);
  app.next('rir');
  assert.equal(app.quiz.finished, true);
  assert.equal(app.quiz.current, 0);
  assert.equal(app.quiz.answers.length, 1);
  assert.deepEqual(loadLocalStats()[1], { c: 0, w: 1 });
});

test('the next unanswered question has no inherited correct or wrong colors', () => {
  const colors = {
    greenBg: 'green-bg', greenBorder: 'green-border', greenLight: 'green-text', green: 'green',
    redBg: 'red-bg', redBorder: 'red-border', redLight: 'red-text', red: 'red',
    borderSoft: 'soft', muted: 'muted', faint: 'faint',
    goldBg: 'gold-bg', gold: 'gold', goldLight: 'gold-text',
    surface: 'neutral-bg', border: 'neutral-border', textSoft: 'neutral-text', surfaceAlt: 'neutral-badge',
  };
  const first = { id: 1, options: ['A', 'B', 'C'], correct: 2 };
  const second = { id: 2, options: ['A', 'B', 'C'], correct: 0 };
  for (const choice of [2, 1]) {
    const answered = commitQuizAnswer({ questions: [first, second], current: 0, answered: null, answers: [], finished: false }, choice);
    assert.equal(optionStyles(colors, 2, first.correct, answered.answered, true).bg, colors.greenBg);
    if (choice === 1) assert.equal(optionStyles(colors, 1, first.correct, answered.answered, true).bg, colors.redBg);
    const next = advanceQuiz(answered, 'quick');
    assert.equal(next.current, 1);
    assert.equal(next.answered, null);
    for (let i = 0; i < second.options.length; i++) {
      const style = optionStyles(colors, i, second.correct, next.answered, next.answered !== null);
      assert.equal(style.bg, colors.surface);
      assert.equal(style.brd, colors.border);
      assert.equal(style.indicator, null);
    }
  }
  // React must replace the old option buttons so their reveal animation and transitions cannot persist.
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /<div key=\{`\$\{quiz\.current\}-\$\{q\.id\}`\}[^>]*>\s*\{q\.options\.map/);
});

test('invalid option indices and unanswered Next cannot create attempts', () => {
  const app = harness();
  for (const value of [-1, 2, null, undefined, 0.5]) app.select(value);
  app.next();
  assert.equal(loadLocalStats(), null);
  assert.equal(app.quiz.current, 0);
});

test('recent storage keeps the last 40 commits, newest first, across module reloads', async () => {
  for (let id = 1; id <= 45; id++) recordRecentQuestion(id);
  assert.deepEqual(loadRecentQuestions(), Array.from({ length: 40 }, (_,i) => 45-i));
  recordRecentQuestion(45);
  assert.deepEqual(loadRecentQuestions().slice(0,3), [45,45,44]);
  const reloaded = await import('../src/progress.js?recent-remount');
  assert.deepEqual(reloaded.loadRecentQuestions(), loadRecentQuestions());
  assert.equal(storage.has(recentKey), true);
  clearRecentQuestions();
  assert.deepEqual(loadRecentQuestions(), []);
});

test('missing or corrupt recent data is safe and never alters existing counters', () => {
  localStorage.setItem(statsKey, JSON.stringify({ 1: { c: 5, w: 3 } }));
  assert.deepEqual(loadRecentQuestions(), []);
  for (const invalid of ['broken', '{}', 'null']) {
    localStorage.setItem(recentKey, invalid);
    assert.deepEqual(loadRecentQuestions(), []);
  }
  localStorage.setItem(recentKey, '[1,"2",null,-1,3]');
  assert.deepEqual(loadRecentQuestions(), [1,3]);
  assert.deepEqual(loadLocalStats(), { 1: { c: 5, w: 3 } });
});
