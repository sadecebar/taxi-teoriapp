import { getQuestionStatus, shuffle, weightedPickQuestions } from './practice.js';

const licenceIds = new Set([16,32,34,43,48,83,103,119,146,157,187,211,221,231]);
const restIds = new Set([2,21,35,39,58,60,67,80,100,101,102,108,127,136,137,145,158,160,165,175,176,179,183]);
const signIds = new Set([99,125,263]);
export const isLicencePractice = q => licenceIds.has(q.id) || ['licence','sanctions'].includes(q.topic);
export const isRestPractice = q => restIds.has(q.id) || q.topic === 'rest';
export const isSignPractice = q => signIds.has(q.id) || q.topic === 'signs';

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
    if (subject === 'taxi') {
      // Keep all feedback areas in one mixed mini test, without extra modes.
      pick(pool.filter(isLicencePractice), 1);
      pick(pool.filter(isRestPractice), 1);
      pick(pool.filter(q => q.topic === 'equipment'), 1);
      pick(pool.filter(q => q.topic === 'tariffs'), 1);
    } else {
      pick(pool.filter(q => q.topic === 'stops'), 2);
      pick(pool.filter(isSignPractice), 1);
    }
    pick(pool, Math.max(0, 5 - (chosen.length - start)));
  }
  pick(unique, Math.max(0, 10 - chosen.length));
  return shuffle(chosen, random);
}
