import { storage as appStorage } from './storage.js';
import { DELPROV_CONFIG, isExamMode } from './exam.js';

export const SESSION_KEY = 'taxi-teori-active-session-v1';
const modes = new Set(['review', 'all', 'quick', 'focus', 'rir', 'bilder', 1, 2, 10, 20, 30]);
// Ignore an old session if content changes under the same IDs.
const fingerprint = q => JSON.stringify([q.question, q.options, q.correct, q.explanation, q.image]);

export function saveSession(quiz, mode, deadline, storage = appStorage) {
  try {
    if (!quiz || quiz.finished) { storage.removeItem(SESSION_KEY); return true; }
    storage.setItem(SESSION_KEY, JSON.stringify({
      version: 1, mode, deadline, current: quiz.current,
      questions: quiz.questions.map(q => ({ id: q.id, fingerprint: fingerprint(q) })),
      answers: quiz.answers.map(({ id, chosen }) => ({ id, chosen })),
      unscoredIds: quiz.unscoredIds,
    }));
    return true;
  } catch (error) { console.error('Taxi session save failed', String(error)); return false; }
}

export function clearSession(storage = appStorage) {
  try { storage.removeItem(SESSION_KEY); } catch { /* Storage may be unavailable. */ }
}

export function loadSession(bank, storage = appStorage) {
  try {
    const data = JSON.parse(storage.getItem(SESSION_KEY));
    if (!data) return null;
    if (data.version !== 1 || !modes.has(data.mode) || !Array.isArray(data.questions) ||
        !data.questions.length || data.questions.length > bank.length || !Array.isArray(data.answers)) throw Error();
    const byId = new Map(bank.map(q => [q.id, q]));
    const questions = data.questions.map(item => {
      const q = byId.get(item.id);
      if (!q || fingerprint(q) !== item.fingerprint) throw Error();
      return q;
    });
    const ids = new Set(questions.map(q => q.id));
    if (ids.size !== questions.length || !Number.isInteger(data.current) || data.current < 0 || data.current >= questions.length) throw Error();
    const answeredIds = new Set();
    const answers = data.answers.map(({ id, chosen }) => {
      const q = byId.get(id);
      if (!ids.has(id) || answeredIds.has(id) || !Number.isInteger(chosen) || chosen < 0 || chosen >= q.options.length) throw Error();
      answeredIds.add(id);
      return { id, q, chosen, correct: chosen === q.correct };
    });
    if (!Array.isArray(data.unscoredIds)) throw Error();
    const unscored = new Set(data.unscoredIds);
    if (unscored.size !== data.unscoredIds.length || [...unscored].some(id => !ids.has(id))) throw Error();
    if (isExamMode(data.mode)) {
      const cfg = DELPROV_CONFIG[data.mode];
      if (questions.length !== cfg.total || unscored.size !== cfg.total - cfg.countedQ ||
          !Number.isFinite(data.deadline) || data.deadline <= 0) throw Error();
    } else if (data.deadline !== null || unscored.size !== 0) throw Error();
    return { mode: data.mode, deadline: data.deadline, quiz: {
      questions, answers, current: data.current,
      answered: answers.find(a => a.id === questions[data.current].id)?.chosen ?? null,
      finished: false, unscoredIds: data.unscoredIds,
    } };
  } catch { clearSession(storage); return null; }
}
