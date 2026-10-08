import { REVIEW_FILTERS, reviewCounts, retryQuestions } from './review.js';

export default function ReviewControls({ answers, filter, onFilter, onPractice, colors: C, t, tf, btnGold, btnGhost }) {
  const counts = reviewCounts(answers);
  const questions = retryQuestions(answers, filter);
  return (
    <div style={{ marginBottom: '18px' }}>
      <div role="group" aria-label={t('review_filter_label')} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {REVIEW_FILTERS.map(key => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => onFilter(key)}
            style={{ ...btnGhost, minHeight: '44px', padding: '10px 12px', color: C.text, borderColor: filter === key ? C.gold : C.border, background: filter === key ? C.goldBg : 'transparent' }}>
            {t(`review_${key}`)} ({counts[key]})
          </button>
        ))}
      </div>
      {questions.length > 0 && (
        <>
          <button type="button" onClick={() => onPractice(questions)} style={{ ...btnGold, width: '100%', minHeight: '48px', padding: '14px', fontSize: '14px' }}>
            {tf(filter === 'all' ? 'review_practice_missed' : 'review_practice_selection', questions.length)}
          </button>
          <p style={{ color: C.textSoft, fontSize: '12px', lineHeight: 1.6, margin: '8px 0 0' }}>{t('review_practice_hint')}</p>
        </>
      )}
      {counts[filter] === 0 && <p role="status" style={{ color: C.textSoft, fontSize: '14px', lineHeight: 1.6 }}>{t('review_empty')}</p>}
    </div>
  );
}
