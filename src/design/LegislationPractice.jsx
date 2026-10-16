import { ArrowRight, Scales } from '@phosphor-icons/react';
import { useStudy } from './context.jsx';
import { Button } from './components.jsx';

export function LegislationPractice() {
  const a = useStudy(), { l } = a;
  return <section className="mb-6 rounded-[24px] border border-accent bg-tint p-5" aria-label={l('Lagstiftning, tio frågor', 'Legislation, ten questions')}>
    <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent"><Scales size={20}/>{l('Delprov 2 · Miniprov', 'Sub-test 2 · Mini test')}</div>
    <h2 className="text-2xl font-medium tracking-tight">{l('10 frågor. Bara lagstiftning.', '10 questions. Only legislation.')}</h2>
    <p className="mt-3 text-sm leading-relaxed text-muted">{l('Taxitrafiklagstiftning och trafiklagstiftning. Facit efter varje svar, utan tidspress.', 'Taxi regulations and traffic law. Feedback after each answer, with no time limit.')}</p>
    <Button className="mt-5 w-full" onClick={() => a.startQuiz('legislation')}>{l('Starta 10 lagstiftningsfrågor', 'Start 10 legislation questions')}<ArrowRight size={20}/></Button>
  </section>;
}
