export const REVIEW_FILTERS = ['all', 'wrong', 'unanswered', 'correct'];

export function answerStatus(answer) {
  if (answer.chosen == null) return 'unanswered';
  return answer.correct ? 'correct' : 'wrong';
}

export function filterReviewAnswers(answers, filter = 'all') {
  return answers.filter(a => filter === 'all' || answerStatus(a) === filter);
}

export function reviewCounts(answers) {
  const counts = { all: answers.length, wrong: 0, unanswered: 0, correct: 0 };
  for (const answer of answers) counts[answerStatus(answer)]++;
  return counts;
}

export function retryQuestions(answers, filter = 'all') {
  return filterReviewAnswers(answers, filter).filter(a => filter !== 'all' || answerStatus(a) !== 'correct').map(a => a.q);
}

// Use canonical questions and never expand a targeted practice selection.
export function canonicalReviewQuestions(selected, bank) {
  const byId = new Map(bank.map(q => [q.id, q]));
  return [...new Set(selected.map(q => q.id))].flatMap(id => byId.has(id) ? [byId.get(id)] : []);
}

export function weakestCategory(categories) {
  return categories.filter(c => c.weakCount > 0).reduce((best, c) => !best || c.weakCount > best.weakCount ? c : best, null);
}
