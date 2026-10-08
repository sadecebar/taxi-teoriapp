import { storage } from './storage.js';
import { QUESTIONS as importedQuestions } from './questions.js';
import { BUNDLED_IMAGES } from './bundled-images.js';
const QUESTIONS = importedQuestions.map(q => BUNDLED_IMAGES[q.image]
  ? { ...q, image: import.meta.env.BASE_URL + BUNDLED_IMAGES[q.image] }
  : q);


// ─── Quick Test recency config ────────────────────────────────────────────────
// How many recent Quick Tests to remember for weighting purposes.
const QUICK_HISTORY_SIZE = 8;
// Weight multiplier per "age slot" (index 0 = appeared in last test, index 1 = 2 tests ago, …).
// 1.0 means full weight (no penalty). Values below 1.0 reduce selection probability.
// Extend or shorten this array to tune the fade-out curve.
const QUICK_RECENCY_WEIGHTS = [0.05, 0.20, 0.40, 0.60, 0.80, 1.0, 1.0, 1.0];

// ─── Checklist steps ──────────────────────────────────────────────────────────
const CHECKLIST_STEPS = [
  { title: "Säkerställ att grundkraven är uppfyllda",                app: false,
    desc:  "Du behöver ha fyllt 20 år, ha haft B-körkort i minst två år, inte ha fått körkortet återkallat under de senaste två åren och uppfylla de medicinska kraven." },
  { title: "Boka läkarundersökning",                                 app: false,
    desc:  "Innan du ansöker ska du genomgå en läkarundersökning. Läkaren utfärdar ett läkarintyg som ska lämnas in i samband med ansökan." },
  { title: "Ta ställning till om du behöver förhandsbesked",         app: false,
    desc:  "Om du är osäker på om du kan bli godkänd på grund av sjukdom eller andra medicinska hinder kan du först ansöka om förhandsbesked hos Transportstyrelsen." },
  { title: "Visa stabil provberedskap i appen",                      app: true,
    desc:  "Rekommendationen är att du har godkända resultat flera gånger i rad och känner dig trygg i både Delprov 1 och Delprov 2 innan du bokar kunskapsprovet." },
  { title: "Boka kunskapsprovet hos Trafikverket",                   app: false,
    desc:  "Kunskapsprovet består av två delprov, och du väljer själv i vilken ordning du gör dem. Delprov 1 handlar om säkerhet och beteende, och delprov 2 handlar om lagstiftning." },
  { title: "Klara båda delproven inom sex månader",                  app: false,
    desc:  "För att kunskapsprovet ska räknas som godkänt måste båda delproven vara godkända inom sex månader från det första godkända delprovet." },
  { title: "Fotografera dig inför provet",                           app: false,
    desc:  "Innan ditt första prov för taxiförarlegitimation ska du fotografera dig hos Trafikverket. Kom i god tid så att foto och kontroll hinner göras." },
  { title: "Ta med giltig legitimation till provet",                 app: false,
    desc:  "Vid provtillfället behöver du kunna legitimera dig med en giltig ID-handling." },
  { title: "Genomför och klara körprovet",                          app: false,
    desc:  "Utöver teorin behöver du också bli godkänd på körprovet för taxiförarlegitimation." },
  { title: "Skicka in ansökan till Transportstyrelsen",             app: false,
    desc:  "När du har blivit godkänd på båda delproven och på körprovet är det dags att ansöka om taxiförarlegitimation hos Transportstyrelsen." },
  { title: "Kontrollera att dina godkända prov fortfarande är giltiga", app: false,
    desc:  "De skriftliga proven får inte vara äldre än tre år, och körprovet får inte vara äldre än ett år när du ansöker." },
  { title: "Invänta Transportstyrelsens slutliga prövning",          app: false,
    desc:  "Till sist prövar Transportstyrelsen att du uppfyller kraven på yrkeskompetens, medicinsk lämplighet och laglydnad innan legitimationen kan beviljas." },
];

// ─── Checklist steps — English ────────────────────────────────────────────────
const CHECKLIST_STEPS_EN = [
  { title: "Ensure you meet the basic requirements",                 app: false,
    desc:  "You must be at least 20 years old, have held a Category B driving licence for at least two years, not had your licence revoked in the past two years, and meet the medical requirements." },
  { title: "Book a medical examination",                             app: false,
    desc:  "Before applying you must undergo a medical examination. The doctor issues a medical certificate that must be submitted with your application." },
  { title: "Consider whether you need a preliminary decision",       app: false,
    desc:  "If you are unsure whether you can be approved due to illness or other medical obstacles, you may first apply for a preliminary decision from Transportstyrelsen." },
  { title: "Demonstrate solid exam readiness in the app",           app: true,
    desc:  "The recommendation is that you have passing results several times in a row and feel confident in both Sub-test 1 and Sub-test 2 before booking the knowledge test." },
  { title: "Book the knowledge test at Trafikverket",               app: false,
    desc:  "The knowledge test consists of two sub-tests, and you choose the order yourself. Sub-test 1 covers safety and conduct, and Sub-test 2 covers traffic law." },
  { title: "Pass both sub-tests within six months",                 app: false,
    desc:  "For the knowledge test to count as passed, both sub-tests must be passed within six months of the first passed sub-test." },
  { title: "Have your photo taken before the test",                 app: false,
    desc:  "Before your first taxi driver's licence test, you need to have your photo taken at Trafikverket. Arrive in good time so that the photo and check can be completed." },
  { title: "Bring valid ID to the test",                            app: false,
    desc:  "At the test session you will need to identify yourself with a valid ID document." },
  { title: "Complete and pass the driving test",                    app: false,
    desc:  "In addition to the theory test, you also need to pass the practical driving test for the taxi driver's licence." },
  { title: "Submit your application to Transportstyrelsen",         app: false,
    desc:  "Once you have passed both sub-tests and the driving test, it is time to apply for your taxi driver's licence at Transportstyrelsen." },
  { title: "Check that your passed tests are still valid",          app: false,
    desc:  "The written tests may not be more than three years old, and the driving test may not be more than one year old when you apply." },
  { title: "Await Transportstyrelsen's final review",               app: false,
    desc:  "Finally, Transportstyrelsen reviews that you meet the requirements for professional competence, medical fitness, and law-abidingness before the licence can be granted." },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dayBefore(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dailyQIdx(dateStr) {
  let h = 5381;
  for (let i = 0; i < dateStr.length; i++) h = (h * 33 ^ dateStr.charCodeAt(i)) >>> 0;
  return h % QUESTIONS.length;
}
function initDailyData(installId) {
  try {
    const raw    = storage.getItem(`taxi-teori-daily-${installId}`);
    const stored = raw ? JSON.parse(raw) : null;
    const today  = todayStr();
    if (stored?.date === today) return stored;
    const idx        = dailyQIdx(today);
    const qId        = QUESTIONS[idx]?.id ?? QUESTIONS[0].id;
    const yesterday  = dayBefore(today);
    const prevStreak = (stored?.date === yesterday && stored?.answered && stored?.correct)
      ? (stored.streak || 0) : 0;
    const bestStreak = Math.max(stored?.bestStreak || 0, stored?.streak || 0);
    return { date: today, questionId: qId, answered: false, chosenIdx: null, correct: null, streak: prevStreak, bestStreak };
  } catch {
    const today = todayStr();
    return { date: today, questionId: QUESTIONS[dailyQIdx(today)]?.id ?? QUESTIONS[0].id, answered: false, chosenIdx: null, correct: null, streak: 0, bestStreak: 0 };
  }
}

const VILOTID_EXCLUDE_IDS = new Set([383, 398]);
function isVilotidQuestion(q) {
  if (VILOTID_EXCLUDE_IDS.has(q.id)) return false;
  const text = [q.question, ...(q.options || []), q.explanation || ""].join(" ").toLowerCase();
  return /vilotid|dygnsvila|veckovila|viloperiod|vilotidsförordning|tidbok/.test(text);
}

// ─── Taxiregler question predicate ───────────────────────────────────────────
// Matches questions specifically about taxi-business regulations:
// taxiförarlegitimation, taxameter, trafiktillstånd, pricing rules, inspection.
function isTaxiregelQuestion(q) {
  const text = [q.question, ...(q.options || []), q.explanation || ""].join(" ").toLowerCase();
  return /taxiförarlegitimation|taxameter|trafiktillstånd|prisinformation|taxetabell|jämförpris|summatariff|plombering|kontrollrapport|yrkesmässig taxitrafik|förarbevis/.test(text);
}

// ─── Navigering question predicate ───────────────────────────────────────────
// Navigation questions live in navigering-1.js and use IDs starting at 431.
// All are delprov: 1, so we exclude them from the general "Fordon & säkerhet"
// category to give them their own dedicated category.
function isNavigeringQuestion(q) {
  return q.delprov === 1 && q.id >= 431;
}


export { QUESTIONS, QUICK_HISTORY_SIZE, QUICK_RECENCY_WEIGHTS, CHECKLIST_STEPS, CHECKLIST_STEPS_EN, initDailyData, isVilotidQuestion, isTaxiregelQuestion, isNavigeringQuestion };
