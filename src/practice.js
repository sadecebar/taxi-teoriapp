// Shared mastery rules, session selection and pure quiz transitions.
export function getQuestionStatus(question, stats) {
  const s = stats[question.id] || { c: 0, w: 0 };
  if (s.c + s.w === 0) return "ej övad";
  if (s.c >= 2 && s.c > s.w) return "behärskad";
  if (s.c > s.w) return "på väg";
  return "öva mer";
}

export function shuffle(array, random = Math.random) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const FOCUS_QUOTAS = { "ej övad": 6, "öva mer": 5, "på väg": 2, "behärskad": 2 };
const BACKFILL_ORDER = ["öva mer", "på väg", "ej övad", "behärskad"];

export function buildStatusBuckets(questions, stats) {
  const buckets = Object.fromEntries(Object.keys(FOCUS_QUOTAS).map(status => [status, []]));
  const seen = new Set();
  for (const q of questions) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    buckets[getQuestionStatus(q, stats)].push(q);
  }
  return buckets;
}

export function selectFocusQuestions(questions, stats, recentIds = [], random = Math.random) {
  const buckets = buildStatusBuckets(questions, stats);
  // History is newest first. Repeated IDs use their most recent appearance.
  const recency = new Map();
  recentIds.forEach((id, index) => {
    if (!recency.has(id)) recency.set(id, index);
  });
  for (const status of Object.keys(buckets)) {
    const candidates = shuffle(buckets[status], random);
    // Unseen coverage wins even if inconsistent history contains an unseen ID.
    buckets[status] = status === "ej övad" ? candidates : [
      ...candidates.filter(q => !recency.has(q.id)),
      ...candidates.filter(q => recency.has(q.id))
        .sort((a, b) => recency.get(b.id) - recency.get(a.id)),
    ];
  }
  const selected = [];
  for (const [status, quota] of Object.entries(FOCUS_QUOTAS)) {
    selected.push(...buckets[status].splice(0, quota));
  }
  for (const status of BACKFILL_ORDER) {
    selected.push(...buckets[status].splice(0, 15 - selected.length));
  }
  return shuffle(selected, random);
}

export function commitQuizAnswer(quiz, chosen) {
  if (!quiz || quiz.finished || quiz.answered !== null) return quiz;
  const q = quiz.questions[quiz.current];
  if (!Number.isInteger(chosen) || chosen < 0 || chosen >= q.options.length) return quiz;
  return {
    ...quiz,
    answered: chosen,
    answers: [...quiz.answers, { id: q.id, correct: chosen === q.correct, chosen, q }],
  };
}

export function advanceQuiz(quiz, mode) {
  if (!quiz || quiz.finished || quiz.answered === null) return quiz;
  const lastAnswer = quiz.answers[quiz.answers.length - 1];
  if ((mode === "rir" && !lastAnswer.correct) || quiz.current + 1 >= quiz.questions.length) {
    return { ...quiz, finished: true };
  }
  return { ...quiz, current: quiz.current + 1, answered: null };
}
