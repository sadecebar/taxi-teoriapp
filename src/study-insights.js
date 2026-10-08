import { getQuestionStatus } from './practice.js';
import { DELPROV_CONFIG, isExamMode } from './exam.js';

export const PRACTICE_GOAL = 70;
export const TEST_MODES = new Set(['quick', 10, 20, 30, 1, 2]);
// Keep incomplete coverage below 100%, including when only one question remains.
export function coveragePercent(count, total) {
  if (!total) return 0;
  if (count >= total) return 100;
  return Math.min(99.9, Math.round(count / total * 1000) / 10);
}
export function knowledgeDistribution(questions, stats) {
  const counts = { 'behärskad': 0, 'på väg': 0, 'öva mer': 0, 'ej övad': 0 };
  for (const q of questions) counts[getQuestionStatus(q, stats)]++;
  return counts;
}
export function recentTestResults(history, mode = 'all') {
  return history.filter(h => TEST_MODES.has(h.mode) && (mode === 'all' || h.mode === mode)
    && (!isExamMode(h.mode) || h.scoringVersion === 2)
    && Number.isFinite(h.ts) && Number.isFinite(h.score) && Number.isFinite(h.total)
    && h.total > 0 && h.score >= 0 && h.score <= h.total)
    .sort((a,b) => b.ts - a.ts).slice(0,10).reverse().map(h => {
      const cfg = isExamMode(h.mode) ? DELPROV_CONFIG[h.mode] : null;
      const pct = Math.round(h.score / h.total * 100);
      return { ...h, pct, passed: cfg ? h.score >= cfg.passMark : pct >= 70,
        threshold: cfg ? cfg.passMark / cfg.countedQ * 100 : 70 };
    });
}
export function resultSummary(entries) {
  if (!entries.length) return { average: null, best: null, passed: 0 };
  return { average: Math.round(entries.reduce((sum,h)=>sum+h.pct,0)/entries.length),
    best: Math.max(...entries.map(h=>h.pct)), passed: entries.filter(h=>h.passed).length };
}
export function appendStudyHistory(record, history) {
  const next = [record, ...history];
  const protectedTests = new Set(recentTestResults(next).map(h=>`${h.ts}:${h.mode}`));
  return next.filter((h,i)=>i<100 || protectedTests.has(`${h.ts}:${h.mode}`));
}
