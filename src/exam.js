import { shuffle } from './practice.js';

// Trafikverket: taxiförarlegitimation, checked 2026-10-04.
export const DELPROV_CONFIG = {
  1: { name: 'Delprov 1', nameKey: 'mode_dp1', subKey: 'dp1_sub', total: 70, countedQ: 65, passMark: 48, time: 50 },
  2: { name: 'Delprov 2', nameKey: 'mode_dp2', subKey: 'dp2_sub', total: 50, countedQ: 46, passMark: 34, time: 50 },
};
export const isExamMode = mode => mode === 1 || mode === 2;

export function createQuiz(questions, mode, random = Math.random) {
  const cfg = DELPROV_CONFIG[mode];
  if (cfg && questions.length !== cfg.total) throw new Error('Incomplete exam question bank');
  return {
    questions, current: 0, answered: null, answers: [], finished: false,
    unscoredIds: cfg ? shuffle(questions.map(q => q.id), random).slice(0, cfg.total - cfg.countedQ) : [],
  };
}

// Exam choices are editable and do not affect practice counters until submission.
export function selectExamAnswer(quiz, chosen) {
  if (!quiz || quiz.finished) return quiz;
  const q = quiz.questions[quiz.current];
  if (!Number.isInteger(chosen) || chosen < 0 || chosen >= q.options.length) return quiz;
  if (quiz.answered === chosen) return quiz;
  const answer = { id: q.id, correct: chosen === q.correct, chosen, q };
  return { ...quiz, answered: chosen, answers: [...quiz.answers.filter(a => a.id !== q.id), answer] };
}

export function moveExam(quiz, index) {
  if (!quiz || quiz.finished || !Number.isInteger(index) || index < 0 || index >= quiz.questions.length) return quiz;
  return { ...quiz, current: index, answered: quiz.answers.find(a => a.id === quiz.questions[index].id)?.chosen ?? null };
}

export function quizResult(quiz, mode) {
  const cfg = isExamMode(mode) ? DELPROV_CONFIG[mode] : null;
  const unscored = new Set(quiz.unscoredIds || []);
  const answers = cfg ? quiz.questions.map(q => {
    const chosen = quiz.answers.find(a => a.id === q.id)?.chosen ?? null;
    return { id: q.id, q, chosen, correct: chosen === q.correct, counted: !unscored.has(q.id) };
  }) : quiz.answers.map(a => ({ ...a, counted: true }));
  const total = cfg ? cfg.countedQ : answers.length;
  const score = answers.filter(a => a.counted && a.correct).length;
  const pct = total > 0 ? Math.round(score / total * 100) : 0;
  return { score, total, pct, answers, mode, scoringVersion: 2,
    passed: cfg ? score >= cfg.passMark : total > 0 && pct >= 70,
    unanswered: quiz.questions.length - quiz.answers.length,
    unscoredCount: unscored.size };
}

export function historyPassed(record) {
  if (typeof record.passed === 'boolean') return record.passed;
  return isExamMode(record.mode) ? record.score >= DELPROV_CONFIG[record.mode].passMark : record.pct >= 70;
}
