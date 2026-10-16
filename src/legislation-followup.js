// Additional original scenarios mapped to the official feedback areas.
const root='https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/';
const taxi=root+'taxitrafiklag-2012211_sfs-2012-211/';
const signs=root+'vagmarkesforordning-200790_sfs-2007-90/';
const traffic=root+'trafikforordning-19981276_sfs-1998-1276/';
const s=(url,title)=>({url,title,checkedOn:'2026-10-16'});
const items=[
  [501,'taxi','licence','Ditt körkort är återkallat, men datumet på taxiförarlegitimationen har inte gått ut. Får du ändå köra taxi?',
    ['Ja, taxiförarlegitimationen ersätter körkortet','Nej, taxiförarlegitimationen gäller endast tillsammans med ett giltigt körkort','Ja, om arbetsgivaren godkänner det','Ja, men bara utan passagerare'],1,
    'Taxiförarlegitimationen gäller bara tillsammans med ett giltigt körkort. Det räcker alltså inte att datumet på legitimationen fortfarande ligger framåt i tiden. En återkallelse av körkortet gör att du inte kan fortsätta köra taxi på den grunden.',[s(taxi,'Taxitrafiklagen, 3 kap. 10 §')]],
  [502,'taxi','licence','En taxiförare uppfyller inte längre de medicinska krav som gäller för taxiförarlegitimation. Vilken åtgärd ska prövningsmyndigheten vidta enligt lagen?',
    ['Automatiskt förlänga giltighetstiden','Enbart ge en parkeringsanmärkning','Återkalla taxiförarlegitimationen','Låta föraren själv avgöra om kraven behövs'],2,
    'Att inte längre uppfylla de medicinska kraven är en självständig grund för återkallelse. Det krävs inte att föraren först begår ett trafikbrott eller orsakar en olycka.',[s(taxi,'Taxitrafiklagen, 4 kap. 6 § 2')]],
  [503,'taxi','licence','En förare följer inte ett föreläggande att lämna in läkarintyg i ärendet om sin taxiförarlegitimation. Vilken följd anger taxitrafiklagen?',
    ['Taxiförarlegitimationen ska återkallas även om någon sjukdom ännu inte har bevisats','Återkallelse är möjlig först efter en trafikolycka','Det räcker att arbetsgivaren intygar att föraren verkar frisk','Föraren får själv välja när intyget ska lämnas in'],0,
    'Lagen anger underlåtenhet att följa föreläggandet om läkarintyg som en egen återkallelsegrund. Man kan alltså inte ignorera begäran och hävda att legitimationen måste behållas tills en sjukdom har bevisats.',[s(taxi,'Taxitrafiklagen, 3 kap. 6 § och 4 kap. 6 § 3')]],
  [504,'taxi','licence','Missförhållanden visar att en taxiförares lämplighet behöver ifrågasättas, men de är inte så allvarliga att taxiförarlegitimationen bör återkallas. Vad får meddelas i stället enligt lagen?',
    ['En ny körkortsbehörighet','Automatiskt fem års körförbud','Ett permanent undantag från tillsyn','En varning'],3,
    'Vid mindre allvarliga missförhållanden av det slag som avses i 4 kap. 6 § första stycket 1 får myndigheten meddela varning i stället för att återkalla legitimationen. Detta är inte en allmän regel om att medicinska krav kan ersättas med en varning.',[s(taxi,'Taxitrafiklagen, 4 kap. 6 §')]],
  [505,'taxi','licence','Det finns sannolika skäl att en taxiförarlegitimation kommer att återkallas slutligt. Måste myndigheten alltid låta föraren använda legitimationen tills ärendet är slutligt avgjort?',
    ['Ja, varje legitimation gäller tills en ny skrivs ut','Nej, legitimationen ska då återkallas tills vidare i väntan på slutligt avgörande','Ja, så länge föraren har bokade kunder','Nej, men bara om arbetsgivaren begär det'],1,
    'Lagen skiljer mellan ett slutligt avgörande och återkallelse tills vidare. Om det på sannolika skäl kan antas att legitimationen kommer att återkallas slutligt enligt återkallelsebestämmelsen, ska den återkallas tills vidare.',[s(taxi,'Taxitrafiklagen, 4 kap. 8 §')]],
  [506,'taxi','sanctions','En person bedriver medvetet taxitrafik utan taxitrafiktillstånd och gärningen utgör olaga taxitrafik. Vilken straffskala anger lagen för det brottet?',
    ['Endast en skriftlig varning','Endast penningböter','Böter eller fängelse i högst ett år','Fängelse i minst tre år'],2,
    'För olaga taxitrafik enligt 5 kap. 1 § är straffskalan böter eller fängelse i högst ett år. Det ska skiljas från andra överträdelser, till exempel att köra taxi utan rätt förarbehörighet enligt reglerna om taxiförarlegitimation.',[s(taxi,'Taxitrafiklagen, 5 kap. 1 §')]],
  [507,'taxi','sanctions','En förare kör medvetet taxi utan giltig taxiförarlegitimation och har inte heller rätt till tillfällig yrkesutövning. Vilken straffskala gäller för förarens brott mot dessa bestämmelser?',
    ['Böter eller fängelse i högst sex månader','Enbart varning','Fängelse i högst fem år','Ingen påföljd om bilen har taxitrafiktillstånd'],0,
    'Föraren kan enligt 5 kap. 4 § dömas till böter eller fängelse i högst sex månader. Företagets tillstånd ersätter inte förarens personliga behörighet. Straffskalan är inte samma som för olaga taxitrafik utan trafiktillstånd.',[s(taxi,'Taxitrafiklagen, 3 kap. 1 § och 5 kap. 4 §')]],
  [508,'taxi','licence','Du har B-körkort och giltig taxiförarlegitimation och vill starta egen taxiverksamhet. Räcker dessa personliga handlingar för att få bedriva verksamheten?',
    ['Ja, taxiförarlegitimationen är också företagets trafiktillstånd','Ja, om verksamheten bara omfattar en bil','Ja, om kunderna förbokar','Nej, verksamheten kräver också taxitrafiktillstånd'],3,
    'Taxiförarlegitimationen gäller förarens rätt att köra. Taxitrafiktillståndet gäller rätten att bedriva taxitrafiken. Det är två olika krav; en legitimation innebär inte automatiskt att man får starta egen taxiverksamhet.',[s(taxi,'Taxitrafiklagen, 2 kap. 1 § och 3 kap. 1 §')]],
  [509,'traffic','signs','Ett parkeringsförbud har en tilläggstavla med tiden (08–18) i svarta siffror inom parentes. Vilka dagar avser just den tidsraden?',
    ['Endast söndagar och helgdagar','Vardagar före sön- och helgdag','Alla vardagar utom dagen före sön- och helgdag','Alla veckans dagar'],1,
    'Svarta eller vita klockslag inom parentes gäller vardag före sön- och helgdag, exempelvis en vanlig lördag. Det är inte begränsat till lördagar: även en annan vardag före en helgdag kan omfattas.',[s(signs,'Vägmärkesförordningen, 2 kap., tilläggstavla T6')]],
  [510,'traffic','signs','Under ett vägmärke står tiden 08–18 med svarta siffror utan parentes. Vilka dagar avser den tidsraden?',
    ['Alla dagar, även söndagar','Bara vardag före helgdag','Vardagar utom vardag före sön- och helgdag','Endast måndagar'],2,
    'Svarta eller vita klockslag utan parentes avser vardagar utom vardag före sön- och helgdag. Läs hela skyltkombinationen; en annan tidsrad eller text kan ange andra tider och dagar.',[s(signs,'Vägmärkesförordningen, 2 kap., tilläggstavla T6')]],
  [511,'traffic','signs','Ett vägmärke med parkeringsförbud gäller bara 08–18 på en vanlig vardag. Klockan är 19.00 och du vill släppa av fem meter före ett övergångsställe. Inget särskilt undantag gäller. Får du stanna där?',
    ['Nej, trafikförordningens stoppförbud före övergångsstället gäller fortfarande','Ja, alla stoppregler upphör efter klockan 18','Ja, eftersom avstigning alltid är tillåten','Ja, eftersom det bara är ett parkeringsförbud'],0,
    'Att ett skyltat parkeringsförbud inte gäller just då tar inte bort andra regler. Trafikförordningen förbjuder stannande på och inom tio meter före övergångsställe. Därför är stoppet fortfarande förbjudet.',[s(signs,'Vägmärkesförordningen, C35 och T6'),s(traffic,'Trafikförordningen, 3 kap. 53 § 1')]],
  [512,'traffic','signs','Trafiksignalen visar grönt, men en polis ger dig ett tydligt tecken att stanna. Vilken anvisning ska du följa?',
    ['Grönt ljus, eftersom en signal alltid står över personliga tecken','Den anvisning som gör att trafiken flyter snabbast','Grönt ljus om du har en passagerare','Polisens tecken att stanna'],3,
    'En polismans anvisning gäller framför trafikregler och anvisningar genom bland annat trafiksignaler och vägmärken. Du ska därför stanna enligt polisens tecken även om trafiksignalen visar grönt.',[s(traffic,'Trafikförordningen, 2 kap. 3 §')]],
];
export const LEGISLATION_FOLLOWUP = items.map(([id,examSubject,topic,question,options,correct,explanation,sources])=>({
  id,delprov:2,examSubject,topic,question,options,correct,explanation,sources,image:null,
  original:true,translationPending:true,contentRevision:'2026-10-16',
}));
