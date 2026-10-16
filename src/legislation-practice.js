import { getQuestionStatus, shuffle, weightedPickQuestions } from './practice.js';

// Five questions from each official legislation subject. No DP1 content.
// Include new scenarios while keeping the rest of the legislation bank in use.
export function selectLegislationQuestions(bank, stats = {}, recentIds = [], random = Math.random) {
  const unique = [...new Map(bank.filter(q => q.delprov === 2 && (q.approvedBatch || q.original)).map(q => [q.id, q])).values()];
  const lastRound = new Set(recentIds.slice(0, 10));
  const chosen = [];
  const pick = (pool, count) => {
    const used = new Set(chosen.map(q => q.id));
    const available = pool.filter(q => !used.has(q.id));
    const fresh = available.filter(q => !lastRound.has(q.id));
    const candidates = fresh.length >= count ? fresh : available;
    // Weighted sampling stays varied; wrong and unseen questions recur more often.
    const buckets = ['behärskad','på väg','ej övad','öva mer'].map(status =>
      candidates.filter(q => getQuestionStatus(q, stats) === status).map(q => q.id));
    chosen.push(...weightedPickQuestions(candidates, buckets, count, [1,2,4,5], random));
  };
  for (const subject of ['taxi', 'traffic']) {
    const pool = unique.filter(q => q.examSubject === subject);
    const start = chosen.length;
    pick(pool.filter(q => q.original), Math.min(2, pool.filter(q => q.original).length));
    pick(pool, Math.max(0, 5 - (chosen.length - start)));
  }
  pick(unique, Math.max(0, 10 - chosen.length));
  return shuffle(chosen, random);
}
