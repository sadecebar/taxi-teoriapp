export const LAGSTIFTNING_3 = [
  {
  id: 101,
  delprov: 2,
  question: "Efter 11 timmars ledighet kör du taxi en lördag kl. 18.00–04.00 och har dessutom en viloperiod kl. 20.00–21.00. På söndagen börjar du köra igen kl. 12.00. När måste du senast påbörja ytterligare en viloperiod under söndagen?",
  options: ["Kl. 14.00", "Kl. 15.00", "Kl. 16.00", "Kl. 17.00"],
  correct: 2,
  image: null,
  explanation: "Rätt svar är kl. 16.00. Du ska alltid ha haft minst 11 timmars dygnsvila under de föregående 24 timmarna. Vid kl. 16.00 på söndagen räknar du alltså tillbaka till lördag kl. 16.00. Under den perioden finns 2 timmars vila från lördagens längre ledighet (16.00–18.00), 1 timmes vila kl. 20.00–21.00 och 8 timmars vila kl. 04.00–12.00 på söndagen. Det blir totalt 11 timmar. Efter kl. 16.00 faller mer av den äldre vilan bort ur 24-timmarsperioden, och då räcker vilan inte längre. Tänk så här nästa gång: räkna alltid bakåt 24 timmar från den aktuella tidpunkten och summera bara den vila som fortfarande ligger inom den perioden."
},
{
  id: 102,
  delprov: 2,
  question: "Du börjar ditt körpass kl. 06.00 efter dygnsvila. Du gör ett uppehåll i arbetet mellan kl. 09.00 och 13.00. När måste du senast sluta köra taxi enligt vilotidsreglerna?",
  options: ["Kl. 21.00", "Kl. 23.00", "Kl. 22.00", "Kl. 24.00", "Kl. 01.00"],
  correct: 2,
  image: null,
  explanation: "Rätt svar är kl. 22.00. Du ska alltid ha haft minst 11 timmars dygnsvila under de föregående 24 timmarna. Dygnsvilan får delas upp i två perioder, men en av dem måste vara minst 8 timmar. Vid kl. 22.00 finns fortfarande 8 timmars vila från nattvilan och 4 timmars vila mellan kl. 09.00 och 13.00 inom den senaste 24-timmarsperioden. Vid kl. 23.00 finns bara 7 timmar kvar av nattvilan inom 24-timmarsperioden, och då uppfylls inte längre kravet att en viloperiod ska vara minst 8 timmar. Tänk så här nästa gång: räkna alltid bakåt 24 timmar från den aktuella tidpunkten och kontrollera både total vila och att minst en viloperiod är minst 8 timmar."
},
{
  id: 103,
  delprov: 2,
  question: "Vilken av följande personer uppfyller inte grundkraven för att kunna få taxiförarlegitimation?",
  options: [
    "En 19-åring som har körkort med behörighet B sedan två år",
    "En 20-åring som har körkort med behörighet B sedan två år",
    "En 21-åring som har körkort med behörighet B sedan två år",
    "En 25-åring som har körkort med behörighet B sedan tre år"
  ],
  correct: 0,
  image: null,
  explanation: "Rätt svar är 19-åringen. För taxiförarlegitimation krävs bland annat att personen har fyllt 20 år och har haft körkort med behörighet B i minst två år. Därför uppfyller 20-, 21- och 25-åringen grundkraven, men inte 19-åringen. Tänk så här nästa gång: kontrollera först minimiåldern och därefter hur länge personen har haft B-körkort."
},
{
  id: 104,
  delprov: 2,
  question: "Du stannar vid vägkanten och väntar på en passagerare som dröjer. Det är mörkt och vägen saknar belysning. Vilket ljus ska du ha tänt i bilen?",
  options: ["Halvljus", "Varningsblinkers", "Parkeringsljus", "Helljus"],
  correct: 2,
  image: null,
  explanation: "Rätt svar är parkeringsljus. När ett fordon står stilla på en mörk och obelyst väg ska det vara markerat så att andra trafikanter tydligt kan se det. Då ska parkeringsljus och baklyktor vara tända, inte halvljus, helljus eller varningsblinkers. Tänk så här nästa gång: när bilen står stilla vid vägkanten i mörker ska den markeras, inte lysa upp vägen som vid vanlig körning."
},
{
  id: 105,
  delprov: 2,
  question: "Vad krävs för att du ska få köra en skolskjuts med en buss som har sittplats för 10 passagerare?",
  options: [
    "Minst D1-körkort",
    "D1-körkort och taxiförarlegitimation",
    "Enbart taxiförarlegitimation",
    "Enbart C-körkort",
    "C-körkort och taxiförarlegitimation"
  ],
  correct: 0,
  image: null,
  explanation: "Rätt svar är minst D1-körkort. En buss med plats för 10 passagerare räknas som buss, eftersom den har fler än åtta sittplatser utöver föraren. För en sådan buss krävs bussbehörighet. D1 räcker för bussar med högst 16 passagerare utöver föraren, medan D gäller för större bussar. Taxiförarlegitimation behövs inte för att köra skolskjuts med buss. Tänk så här nästa gång: fråga först om fordonet är personbil eller buss, och avgör sedan om det är bussbehörighet eller taxiförarlegitimation som är relevant."
},
{
  id: 106,
  delprov: 2,
  question: "Har någon av taxibilarna stannat rätt?",
  options: [
    "Ja, taxibilen på bild B",
    "Ja, både taxibilen på bild A och B",
    "Nej, ingen av taxibilarna",
    "Ja, taxibilen på bild A"
  ],
  correct: 3,
  image: "https://teori-taxi.com/images/Lagstiftning/107.png",
  explanation: "Ja, taxibilen på bild A har stannat rätt. På en väg med trafik i båda riktningarna ska du stanna på högra sidan i färdriktningen. I bild A står bilen på rätt sida av vägen, medan bilen i bild B står på fel sida. Tänk så här nästa gång: utgå alltid från bilens färdriktning och kontrollera om den står på höger sida av vägen."
},
{
  id: 107,
  delprov: 2,
  question: "Du kör i 70 km/h i situationen på bilden. Vad är säkrast att göra?",
  options: ["Bromsa", "Styra ut mot högerkanten", "Signalera med signalhornet", "Signalera med helljuset"],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/108.png",
  explanation: "Rätt svar är att styra ut mot högerkanten. I den här situationen är det viktigaste att skapa så stor säkerhetsmarginal som möjligt till det mötande fordonet. Genom att gå ut åt höger minskar du risken för en allvarlig möteskollision. Signalhorn eller helljus kan möjligen varna den andre föraren, men de löser inte själva utrymmesproblemet. Tänk så här nästa gång: när ett möte blir trångt är det säkraste oftast att direkt skapa mer sidomarginal."
},
{
  id: 108,
  delprov: 2,
  question: "Efter 11 timmars vila börjar du köra taxi kl. 07.00. Du vilar kl. 09.00–12.00. När måste du senast avsluta körpasset enligt vilotidsreglerna?",
  options: ["Kl. 20.00", "Kl. 22.00", "Kl. 23.00", "Kl. 01.00"],
  correct: 2,
  image: null,
  explanation: "Rätt svar är kl. 23.00. Du ska alltid ha haft minst 11 timmars dygnsvila under de föregående 24 timmarna. Vid kl. 23.00 finns fortfarande 8 timmar kvar av nattvilan inom 24-timmarsperioden, plus vilan kl. 09.00–12.00 på 3 timmar. Det blir totalt 11 timmar, och en av viloperioderna är minst 8 timmar. Efter kl. 23.00 faller mer av nattvilan bort ur 24-timmarsperioden, och då uppfylls inte kravet längre. Tänk så här nästa gång: räkna alltid bakåt 24 timmar från den aktuella tidpunkten och kontrollera både total vila och att minst en viloperiod är tillräckligt lång."
},
{
  id: 109,
  delprov: 2,
  question: "Du ska fortsätta rakt fram i korsningen. Hur kör du säkrast i förhållande till cyklisten?",
  options: [
    "Jag fortsätter i höger körfält och kör om före korsningen",
    "Jag väntar med omkörning till efter korsningen",
    "Jag avvaktar och kör sedan om i korsningen",
    "Jag använder vänster körfält för att lämna god marginal"
  ],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/110.png",
  explanation: "Det säkraste är att vänta med omkörningen till efter korsningen. En cyklist nära en korsning kan behöva ändra placering, och samtidigt finns fler riskmoment med gående, signaler och annan trafik. Genom att vänta tills korsningen är passerad får du bättre överblick och kan köra om med större säkerhetsmarginal. Tänk så här nästa gång: om en cyklist befinner sig precis före en korsning är det oftast säkrast att först passera korsningen och sedan köra om när läget är tydligare."
},
{
  id: 110,
  delprov: 2,
  question: "Du ska svänga till höger in på en landsväg som är huvudled och har tät trafik. Får du använda vägrenen som ett accelerationsfält?",
  options: ["Ja, men enbart i dagsljus", "Ja, alltid", "Nej"],
  correct: 2,
  image: null,
  explanation: "Nej. Vägrenen är inte ett accelerationsfält och får inte användas på det sättet bara för att du vill komma upp i fart före infarten. Om accelerationsfält saknas har du väjningsplikt när du kör in på huvudleden, och du får anpassa infarten efter trafiken på vägen. Tänk så här nästa gång: bara ett riktigt accelerationsfält är till för att bygga upp fart före infart, inte vägrenen."
},
{
  id: 111,
  delprov: 2,
  question: "Får du stanna för att vänta på en passagerare efter något av vägmärkena?",
  options: [
    "Ja, men enbart efter vägmärke A",
    "Ja, men enbart efter vägmärke B",
    "Ja, efter båda vägmärkena",
    "Nej"
  ],
  correct: 3,
  image: "https://teori-taxi.com/images/Lagstiftning/112.png",
  explanation: "Nej. Vägmärke A betyder förbud mot att parkera, och att vänta på en passagerare räknas som parkering om personen inte stiger i direkt. Vägmärke B betyder förbud mot att stanna och parkera, och där får du inte ens stanna för att vänta. Tänk så här nästa gång: direkt på- eller avstigning kan vara tillåten vid parkeringsförbud, men att stå kvar och vänta är parkering."
},
{
  id: 112,
  delprov: 2,
  question: "Du ska stanna för att släppa av en passagerare vid en vägkorsning. Vilket avstånd måste det minst vara till korsningen?",
  options: ["3 meter", "5 meter", "10 meter", "20 meter", "30 meter"],
  correct: 2,
  image: null,
  explanation: "Rätt svar är 10 meter. Du får inte stanna eller parkera i en vägkorsning eller inom 10 meter från den korsande körbanans närmaste ytterkant. Regeln gäller även om du bara ska släppa av en passagerare. Tänk så här nästa gång: vid korsningar ska du alltid hålla minst 10 meters avstånd, och du mäter från den korsande körbanans närmaste ytterkant."
},
{
  id: 113,
  delprov: 2,
  question: "I hur många av situationerna måste du stanna, oavsett om det kommer fordon eller inte?",
  options: [
    "I en av situationerna",
    "I två av situationerna",
    "I tre av situationerna",
    "I alla situationerna"
  ],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/114-600x552.png",
  explanation: "Rätt svar är två. I situation B måste du stanna eftersom märket betyder stopplikt. I situation D måste du också stanna eftersom rött fast ljus betyder att vägen är avstängd. I situation A får du köra eftersom signalen visar grönt. I situation C har du väjningsplikt, men du måste inte stanna om det inte behövs. Tänk så här nästa gång: skilj på väjningsplikt och stopplikt. Stopplikt och rött ljus kräver alltid stopp, men väjningsplikt gör inte alltid det."
},
{
  id: 114,
  delprov: 2,
  question: "Vilken högsta tillåtna hastighet gäller när du passerar detta vägmärke om inget annat anges?",
  options: ["50 km/h", "70 km/h", "90 km/h", "110 km/h"],
  correct: 3,
  image: "https://teori-taxi.com/images/Lagstiftning/2000px-429x600.png",
  explanation: "Rätt svar är 110 km/h. Märket visar motorväg. Anvisningen gäller från platsen där märket sitter, och på motorväg är högsta tillåtna hastighet 110 km/h om ingen annan hastighet anges. Tänk så här nästa gång: identifiera först vägmärket och koppla sedan märket till den grundregel som gäller för just den vägen."
},
{
  id: 115,
  delprov: 2,
  question: "Den 30 augusti har du förvärvsarbetat från kl. 07.00 till kl. 13.00. Du börjar sedan köra taxi kl. 18.00. När måste du senast påbörja nästa viloperiod enligt tidboksbladet?",
  options: ["Kl. 23.00", "Kl. 01.00", "Kl. 03.00", "Kl. 05.00"],
  correct: 0,
  image: "https://teori-taxi.com/images/Lagstiftning/116.png",
  explanation: "Rätt svar är kl. 23.00. Du ska alltid ha haft minst 11 timmars dygnsvila under de föregående 24 timmarna, och om vilan delas upp måste en av viloperioderna vara minst 8 timmar. Vid kl. 23.00 finns fortfarande en sammanhängande vila på 8 timmar inom 24-timmarsperioden, från den 29 augusti kl. 23.00 till den 30 augusti kl. 07.00. Dessutom finns vilan kl. 13.00–18.00 på 5 timmar. Efter kl. 23.00 faller mer av den äldre vilan bort ur 24-timmarsperioden, och då uppfylls inte längre kravet. Tänk så här nästa gång: räkna alltid bakåt 24 timmar från den aktuella tidpunkten och kontrollera både total vila och att minst en viloperiod är minst 8 timmar."
},
{
  id: 116,
  delprov: 2,
  question: "Du ska köra rakt fram i korsningen. Vilka trafikanter kan du vara säker på har rött ljus?",
  options: [
    "Gående som ska gå över den korsande gatan",
    "Mötande fordon",
    "Gående som ska gå över gatan på övergångsstället framför mig"
  ],
  correct: 2,
  image: "https://teori-taxi.com/images/Lagstiftning/117.png",
  explanation: "Rätt svar är gående som ska gå över gatan på övergångsstället framför dig. När du har grönt ljus och ska köra rakt fram kan mötande fordon också ha grönt, och gående över den korsande gatan kan också ha tillåtande signal beroende på hur signalerna är styrda. Däremot kan gående inte samtidigt få grönt rakt över din direkta färdväg framför bilen. Tänk så här nästa gång: grönt för dig betyder inte rött för alla andra, bara att just din väg framåt är tillåten."
},
{
  id: 117,
  delprov: 2,
  question: "Du ska svänga höger. Vad gäller?",
  options: [
    "Det är förbjudet att köra nu eftersom signalen med grön pil inte är tänd",
    "Det är tillåtet att köra nu eftersom trafiksignalen visar grönt ljus"
  ],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/118.png",
  explanation: "Rätt svar är att det är tillåtet att köra. Ett vanligt grönt ljus innebär att du får passera signalen. En grön pil används när en viss körriktning regleras särskilt och ger rätt att köra i just den riktningen även om en annan signalbild visas samtidigt. Att pilen inte lyser betyder därför inte automatiskt att högersväng är förbjuden. Tänk så här nästa gång: om den vanliga fordonssignalen är grön får du köra, medan en extra grön pil bara ger en särskild tillåtelse för pilens riktning."
},
{
  id: 118,
  delprov: 2,
  question: "Du ska bogsera en personbil som fått motorstopp. Vilken högsta tillåtna hastighet gäller?",
  options: ["20 km/h", "30 km/h", "40 km/h", "50 km/h", "70 km/h", "80 km/h"],
  correct: 1,
  image: null,
  explanation: "Rätt svar är 30 km/h. Vid bogsering gäller en låg högsta hastighet eftersom situationen kräver extra försiktighet och fordonet som bogseras inte kan framföras på vanligt sätt. Tänk så här nästa gång: när ett fordon bogseras gäller inte vanliga hastigheter för personbil, utan en särskilt låg maxhastighet."
},
{
  id: 119,
  delprov: 2,
  question: "När ska en taxiförarlegitimation förnyas?",
  options: [
    "Senast vart tionde år",
    "Senast vart femte år",
    "Bara om innehavaren bytt adress",
    "Senast vart tredje år"
  ],
  correct: 0,
  image: null,
  explanation: "Rätt svar är senast vart tionde år. En taxiförarlegitimation ska förnyas vart tionde år. Den ska också förnyas om någon uppgift har ändrats, till exempel om innehavaren byter namn. Tänk så här nästa gång: huvudregeln är periodisk förnyelse vart tionde år, men vissa ändrade personuppgifter kan också göra att legitimationen behöver förnyas tidigare."
},
{
  id: 120,
  delprov: 2,
  question: "Du råkar med din taxi köra på en parkerad personbil. Personbilsföraren är inte anträffbar. Vad måste du göra enligt lag?",
  options: [
    "Kontakta parkeringsbolaget",
    "Kontakta taxiväxeln",
    "Invänta personbilsföraren",
    "Kontakta polisen",
    "Kontakta försäkringsbolaget"
  ],
  correct: 3,
  image: null,
  explanation: "Rätt svar är att kontakta polisen. Om du skadar någon annans fordon får du inte lämna platsen utan att lämna uppgifter om händelsen. När ägaren till bilen inte finns på plats är det därför polisen som du ska kontakta. Tänk så här nästa gång: om du inte kan lämna uppgifter direkt till den som drabbats måste du ändå se till att händelsen anmäls och att dina uppgifter kan nå fram."
},
{
  id: 121,
  delprov: 2,
  question: "Vilken vikt förändras när du tar upp passagerare i din taxibil?",
  options: ["Maximilasten", "Totalvikten", "Bruttovikten", "Tjänstevikten"],
  correct: 2,
  image: null,
  explanation: "Rätt svar är bruttovikten. Bruttovikt är fordonets aktuella vikt vid ett visst tillfälle. När passagerare stiger in ökar bilens verkliga vikt, alltså bruttovikten. Totalvikt, tjänstevikt och maximilast är däremot fasta viktbegrepp som inte ändras bara för att bilen får fler passagerare. Tänk så här nästa gång: fråga dig vilken vikt som beskriver hur tung bilen faktiskt är just nu."
},
{
  id: 122,
  delprov: 2,
  question: "I vilket fall krävs minst BE-behörighet för att få köra fordonskombinationen?",
  options: [
    "Bilens totalvikt är 2 300 kg och släpets totalvikt är 2 200 kg",
    "Bilens totalvikt är 2 100 kg och släpets totalvikt är 1 900 kg",
    "Bilens totalvikt är 2 000 kg och släpets totalvikt är 1 400 kg"
  ],
  correct: 0,
  image: null,
  explanation: "Rätt svar är alternativ 1. Med B-behörighet får bilens och släpets sammanlagda totalvikt vara högst 3 500 kg. Med utökad B-behörighet (B96) får den vara högst 4 250 kg. I alternativ 1 är den sammanlagda totalvikten 4 500 kg, vilket är för mycket för både B och B96. Därför krävs minst BE-behörighet. Tänk så här nästa gång: jämför först bilens och släpets sammanlagda totalvikt med gränserna för B och B96. Om kombinationen går över 4 250 kg räcker inte de behörigheterna."
},
{
  id: 123,
  delprov: 2,
  question: "Din kund bor vid den här gatan. Får du köra in med din taxi för att lämna av kunden vid bostaden?",
  options: [
    "Ja, eftersom förbudet bara gäller genomfart till E4",
    "Ja, men endast om jag kör i gångfart",
    "Nej, eftersom motorfordon inte får passera vägmärket",
    "Nej, om jag inte har särskilt tillstånd"
  ],
  correct: 0,
  image: "https://teori-taxi.com/images/Lagstiftning/124.png",
  explanation: "Ja. Vägmärket förbjuder motordriven trafik, men tilläggstavlan begränsar förbudet till genomfart till E4. Det betyder att du inte får använda vägen som genomfartsled mot E4, men du får köra in om du har ett ärende på gatan, till exempel för att lämna av en kund vid en bostad där. Tänk så här nästa gång: läs alltid både huvudmärket och tilläggstavlan tillsammans. Det är ofta tilläggstavlan som avgör exakt vad förbudet gäller."
},
{
  id: 124,
  delprov: 2,
  question: "När ska taxametern vara inställd på LEDIG under ett körpass?",
  options: [
    "När jag kör med kund till fast pris",
    "När jag kör färdtjänst med kund i bilen",
    "När bilen inte används för köruppdrag",
    "När jag kör skolskjuts med passagerare"
  ],
  correct: 2,
  image: null,
  explanation: "Rätt svar är när bilen inte används för köruppdrag. Under en körning ska taxametern vara inställd på UPPTAGEN. När ett köruppdrag är avslutat ska den ställas på STOPPAD. När bilen inte används för köruppdrag ska taxametern stå i läget LEDIG. Tänk så här nästa gång: taxametern ska inte vara avstängd bara för att bilen är tom, utan den ska stå i rätt läge beroende på om du kör ett uppdrag, har avslutat ett uppdrag eller väntar på nästa."
},
{
  id: 125,
  delprov: 2,
  question: "Vad anger en gul heldragen linje i körbanans kant?",
  options: [
    "Förbud att parkera",
    "Förbud att stanna och parkera",
    "Förbud att köra på linjen"
  ],
  correct: 1,
  image: null,
  explanation: "Rätt svar är förbud att stanna och parkera. En gul heldragen linje i körbanans kant betyder att du varken får stanna eller parkera där. Tänk så här nästa gång: gul kantlinje handlar om stopp- och parkeringsregler, och heldragen linje är strängare än bruten linje."
},
{
  id: 126,
  delprov: 2,
  question: "Får du stanna med din taxi bredvid en parkerad bil för att släppa av passagerare?",
  options: [
    "Nej, det är inte tillåtet med två stillastående fordon i bredd",
    "Ja, men endast om det är minst 3 meter mellan taxin och gatans mitt",
    "Ja, om det inte hindrar eller stör övrig trafik"
  ],
  correct: 2,
  image: "https://teori-taxi.com/images/Lagstiftning/127.png",
  explanation: "Ja, ett kort stopp för att släppa av en passagerare kan vara tillåtet även bredvid en parkerad bil, eftersom det räknas som stannande och inte parkering. Men du får bara göra det om det kan ske utan att du i onödan hindrar eller stör annan trafik. Tänk så här nästa gång: att snabbt släppa av någon är inte samma sak som att parkera, men du måste alltid bedöma om stoppet är säkert och om trafiken fortfarande kommer fram."
},
{
  id: 127,
  delprov: 2,
  question: "Du är anställd som taxiförare och din tidbok är fulltecknad. Vad ska du göra med tidboken?",
  options: [
    "Jag lämnar den till den arbetsgivare som jag har fått boken från. Därefter börjar jag på nästa tidbok",
    "Jag har den med mig i bilen i en vecka. Därefter lämnar jag den till den arbetsgivare som jag har fått boken från",
    "Jag har den med mig i bilen i tre arbetsdagar. Därefter lämnar jag den till arbetsgivaren",
    "Jag behåller den i ett år för att kunna lämna den till arbetsgivaren om denne begär det"
  ],
  correct: 1,
  image: null,
  explanation: "Rätt svar är att du behåller den fulltecknade tidboken i en vecka och därefter lämnar tillbaka den till den arbetsgivare som har gett dig boken. Tänk så här nästa gång: som anställd ska du först behålla den avslutade tidboken i en vecka, sedan återlämna den till arbetsgivaren."
},
{
  id: 128,
  delprov: 2,
  question: "Får du köra om en cykel strax före ett obevakat övergångsställe?",
  options: ["Ja", "Nej"],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/129.png",
  explanation: "Nej. Du får inte köra om ett fordon strax före eller på ett obevakat övergångsställe. En cykel räknas som ett fordon, så förbudet gäller även här. Tänk så här nästa gång: vid obevakade övergångsställen ska du undvika omkörning helt och i stället vara beredd på gående och andra oväntade situationer."
},
{
  id: 129,
  delprov: 2,
  question: "Vilket alternativ anger två uppgifter som alltid ska finnas med på ett taxikvitto?",
  options: [
    "Fordonets yrkestrafiknummer och inkört belopp under körpasset",
    "Framkörningsavgiften och beställningscentralens namn",
    "Tidpunkten då köruppdraget påbörjats och avslutats",
    "Antalet registrerade körningar under körpasset och taxiföretagets telefonnummer"
  ],
  correct: 2,
  image: null,
  explanation: "Rätt svar är tidpunkten då köruppdraget påbörjats och avslutats. För varje köruppdrag ska taxametern registrera när körningen startade och när den avslutades, och det är grunduppgifter för kvitto och uppdragsredovisning. Uppgifter som gäller hela körpasset, till exempel totalt inkört belopp eller antal körningar under passet, är något annat och hör inte hemma som obligatoriska kvittouppgifter. Tänk så här nästa gång: skilj på uppgifter för själva resan och uppgifter för hela körpasset."
},
{
  id: 130,
  delprov: 2,
  question: "Vad innebär det inringade vägmärket?",
  options: [
    "Trafiken på bron är enkelriktad",
    "Endast ett fordon i taget får vistas på bron",
    "Jag ska lämna företräde till mötande trafik om utrymmet inte räcker till för möte",
    "Mötande trafik ska lämna mig företräde om utrymmet inte räcker till för möte"
  ],
  correct: 3,
  image: "https://teori-taxi.com/images/Lagstiftning/131.png",
  explanation: "Märket betyder att mötande trafik har väjningsplikt. Det används vid smala vägsträckor, till exempel broar, där två fordon inte säkert kan mötas samtidigt. Du har alltså företräde, och det är den mötande trafiken som ska vänta om utrymmet inte räcker till för möte. Tänk så här nästa gång: röd pil i din riktning betyder att du har företräde, medan den mötande trafiken ska lämna plats."
},
{
  id: 131,
  delprov: 2,
  question: "Du kör taxi och ska lämna av två färdtjänstkunder vid ett hotell. Får du köra in på den här gatan?",
  options: [
    "Ja, men enbart om hotellet ligger på gågatan",
    "Ja, all fordonstrafik är tillåten, även genomgående trafik",
    "Nej, endast utryckningsfordon får köra på gågatan",
    "Nej, all fordonstrafik är förbjuden"
  ],
  correct: 0,
  image: "https://teori-taxi.com/images/Lagstiftning/132.png",
  explanation: "Rätt svar är att du får köra in endast om hotellet ligger på gågatan. Märket visar gågata. På en gågata får motordrivna fordon normalt inte köra, men undantag finns bland annat för transporter av gäster till eller från hotell eller motsvarande vid gågatan. Det betyder att du får köra in för att lämna av kunder vid hotellet om hotellet ligger där, men inte använda gatan för vanlig genomfart. Tänk så här nästa gång: på gågata är huvudregeln förbud för motorfordon, men vissa särskilda transporter till adresser på gatan är tillåtna."
},
{
  id: 132,
  delprov: 2,
  question: "Vilka personer brukar gå över på övergångsstället, enligt tilläggstavlan?",
  options: [
    "Personer med nedsatt rörelseförmåga",
    "Personer med nedsatt hörsel",
    "Personer med nedsatt syn",
    "Äldre trafikanter"
  ],
  correct: 2,
  image: "https://teori-taxi.com/images/Lagstiftning/133.png",
  explanation: "Rätt svar är personer med nedsatt syn. Tilläggstavlan betyder att personer med nedsatt syn är vanligt förekommande vid platsen. När den sitter vid ett övergångsställe ska du därför vara extra uppmärksam och anpassa körningen i god tid. Tänk så här nästa gång: läs alltid huvudmärket och tilläggstavlan tillsammans, eftersom tilläggstavlan förklarar vilken särskild risk eller trafikantgrupp som finns där."
},
{
  id: 133,
  delprov: 2,
  question: "Har du väjningsplikt mot trafik från höger i någon av korsningarna?",
  options: [
    "Ja, men enbart i korsning A",
    "Ja, men enbart i korsning B",
    "Ja, i båda korsningarna",
    "Nej"
  ],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/134.png",
  explanation: "Rätt svar är att du har väjningsplikt bara i korsning B. Där ser det ut som en vanlig obevakad korsning, och då gäller högerregeln mot trafik från höger. I korsning A ser anslutningen från höger inte ut som en vanlig likvärdig korsning, utan mer som en utfart eller annan anslutning där högerregeln inte tar över. Tänk så här nästa gång: fråga först om det verkligen är en vanlig korsning mellan två vägar. Om det i stället är en utfart gäller inte högerregeln på samma sätt."
},
{
  id: 134,
  delprov: 2,
  question: "Vid vilken av dessa tidpunkter gäller förbudet att parkera?",
  options: [
    "Torsdag kl. 18.00",
    "Lördag kl. 12.00",
    "Söndag kl. 12.00",
    "Söndag kl. 18.00"
  ],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/135.png",
  explanation: "Rätt svar är lördag kl. 12.00. Tilläggstavlan visar 9–17 utan parentes, vilket gäller vardagar, och (9–17) inom parentes, vilket gäller lördag eller annan vardag före sön- eller helgdag. Eftersom ingen röd söndagstid anges gäller förbudet inte på söndag. Tänk så här nästa gång: vanliga svarta tider gäller vardagar, tider inom parentes gäller lördag, och röda tider gäller söndag och helgdag."
},
{
  id: 135,
  delprov: 2,
  question: "Vem ansvarar för att en taxi som används vid skolskjutsning har rätt utrustning?",
  options: [
    "Föraren och skolstyrelsen",
    "Föraren och tillståndshavaren",
    "Enbart föraren",
    "Skolstyrelsen och tillståndshavaren"
  ],
  correct: 1,
  image: null,
  explanation: "Rätt svar är föraren och tillståndshavaren. När en taxi används för skolskjutsning måste fordonet uppfylla reglerna om utrustning, till exempel krav på skyltning och bilbälten. Om fordonet inte uppfyller kraven är det föraren och den som bedriver skolskjutsningen som ansvarar. I taxitrafik är det tillståndshavaren som bedriver trafiken. Tänk så här nästa gång: skilj på skolans ansvar för själva skolskjutsorganisationen och transportörens ansvar för att fordonet är rätt utrustat."
},
{
  id: 136,
  delprov: 2,
  question: "Du ska börja köra taxi igen efter två veckors ledighet. Hur ska du ange dygnsvilan i tidboken före körningen?",
  options: [
    "Jag anger dygnsvila för det närmast föregående dygnet",
    "Jag anger dygnsvila för de sju närmast föregående dygnen",
    "Jag anger dygnsvila för de åtta närmast föregående dygnen",
    "Jag anger dygnsvila för hela ledigheten"
  ],
  correct: 0,
  image: null,
  explanation: "Rätt svar är att du anger dygnsvila för det närmast föregående dygnet. Innan du påbörjar en transport ska du anteckna tidpunkterna för den närmast föregående dygnsvilan. Du behöver alltså inte fylla i hela ledigheten bara för att du varit ledig länge. Tänk så här nästa gång: före första körningen efter ledighet ska du alltid börja med att skriva in den senaste dygnsvilan."
},
{
  id: 137,
  delprov: 2,
  question: "Vilken av följande transporter omfattas av vilotidsbestämmelserna för vissa vägtransporter inom landet?",
  options: [
    "Godstransport med en lastbil med totalvikt över 3,5 ton",
    "Skolskjuts med en bil som är registrerad som buss",
    "Skolskjuts med en bil som är registrerad som personbil"
  ],
  correct: 2,
  image: null,
  explanation: "Rätt svar är skolskjuts med en bil som är registrerad som personbil. De nationella vilotidsbestämmelserna för vissa vägtransporter inom landet gäller bland annat bilar som används i taxitrafik eller för skolskjutsning när bilen är utformad för högst nio personer inklusive föraren. En tung lastbil över 3,5 ton omfattas i stället av reglerna om kör- och vilotider för tunga fordon. Tänk så här nästa gång: den här regleringen gäller främst lättare fordon i nationell yrkestrafik, till exempel taxi och skolskjuts med personbil."
},
{
  id: 138,
  delprov: 2,
  question: "Hur lång tid får det högst vara mellan besiktningarna av en taxameter?",
  options: ["6 månader", "12 månader", "18 månader", "24 månader"],
  correct: 1,
  image: null,
  explanation: "Rätt svar är 12 månader. Taxameterutrustningen ska besiktas senast ett år från installationen eller från den senaste besiktningen. Tänk så här nästa gång: om regeln säger senast ett år, betyder det att högsta tillåtna intervall är 12 månader."
},
{
  id: 139,
  delprov: 2,
  question: "Vem ansvarar normalt för att ett 14-årigt barn använder bilbälte vid skolskjutsning i taxibil?",
  options: [
    "Skolpersonal om det finns sådan med i bilen",
    "Föraren",
    "Barnet själv",
    "Barnets föräldrar om de finns med i bilen"
  ],
  correct: 1,
  image: null,
  explanation: "Rätt svar är föraren. Passagerare under 15 år ska använda bilbälte eller annan särskild skyddsanordning, och det är föraren som normalt ansvarar för att detta sker i en taxibil. Om annan ombordpersonal eller ledsagare finns med kan även den personen ha ansvar, men i en vanlig taxiskolskjuts är det normalt föraren som ansvarar. Tänk så här nästa gång: barn under 15 år ansvarar inte själva fullt ut för bilbältet, utan ansvaret ligger normalt på den vuxne som ansvarar för transporten."
},
{
  id: 140,
  delprov: 2,
  question: "Du kör i taxitrafik och kommer fram till en vägfärja där andra fordon väntar i kö. Har du förtur till färjan?",
  options: [
    "Nej, det är enbart utryckningsfordon som har förtur",
    "Ja, eftersom taxi normalt har förtur på Trafikverkets vägfärjor",
    "Nej, det är enbart de som har ett särskilt medgivande om det som har förtur, till exempel öbor",
    "Ja, men enbart om jag har en kund i bilen"
  ],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/141.png",
  explanation: "Rätt svar är att taxi normalt har förtur på Trafikverkets vägfärjor. Trafikverket anger att utryckningsfordon, kollektivtrafik och taxi har förtur. Regeln är alltså inte knuten till att du måste ha en kund i bilen. Tänk så här nästa gång: utgå från den särskilda prioriteringsordning som gäller för vägfärjan, inte från vanliga köregler."
},
{
  id: 141,
  delprov: 2,
  question: "Får du stanna din taxi framför infarten till en fastighet för att ta upp passagerare?",
  options: [
    "Ja, men endast om passageraren är rörelsehindrad",
    "Ja, men endast om det är minst 3 meter mellan bilen och gatans mitt",
    "Nej, det är förbjudet att stanna framför en infart",
    "Ja, men endast om det inte hindrar övrig trafik"
  ],
  correct: 3,
  image: null,
  explanation: "Rätt svar är att du får stanna om det inte hindrar övrig trafik. Att snabbt ta upp en passagerare räknas som stannande, inte parkering. Det finns inget generellt förbud mot att stanna framför en infart, men du får aldrig stanna på ett sätt som skapar fara eller onödigt hindrar eller stör trafiken. Tänk så här nästa gång: kontrollera först om platsen omfattas av ett uttryckligt stoppförbud, och bedöm sedan om ditt stopp hindrar trafiken eller tillgången till platsen."
},
{
  id: 142,
  delprov: 2,
  question: "Var kan vägkontroll av taxametern ske?",
  options: [
    "Enbart på vägen, när jag kör i taxitrafik",
    "Både vid taxiföretagets lokaler och på vägen när jag kör taxitrafik",
    "Enbart på vägen, när jag kör i taxitrafik, förutsatt att jag inte har någon kund i bilen",
    "Enbart vid taxiföretagets lokaler"
  ],
  correct: 1,
  image: null,
  explanation: "Rätt svar är att kontrollen kan ske både på vägen och vid taxiföretagets lokaler eller liknande område i anslutning till dessa. Lagen tillåter alltså inte bara kontroll ute i trafiken utan också kontroll hos företaget. Tänk så här nästa gång: om frågan gäller vägkontroll av taxameter ska du inte låsa dig vid ordet väg, eftersom samma kontroll också får göras i taxiföretagets miljö enligt lagen."
},
{
  id: 143,
  delprov: 2,
  question: "Du har kört taxi från kl. 05.00 den 24 september. Kl. 09.00 får du besked om en körning som börjar kl. 09.15 och beräknas ta 3 timmar. Kan du ta körningen med tanke på den vilotid du har haft enligt tidboksbladet?",
  options: [
    "Ja",
    "Nej, det saknas 1 timmes vilotid",
    "Nej, det saknas 2 timmars vilotid",
    "Nej, det saknas 3 timmars vilotid"
  ],
  correct: 0,
  image: "https://teori-taxi.com/images/Lagstiftning/144.png",
  explanation: "Ja. För att få utföra transporten måste du under de föregående 24 timmarna ha haft minst 11 timmars dygnsvila, och om vilan delas upp ska en av perioderna vara minst 8 timmar. När körningen avslutas kl. 12.15 kan du räkna vila från kl. 13.00–15.00 den 23 september samt från kl. 20.00 den 23 september till kl. 05.00 den 24 september. Det blir totalt 11 timmars vila, varav en sammanhängande period är 9 timmar. Därför får du ta körningen. Tänk så här nästa gång: räkna alltid bakåt 24 timmar från den tidpunkt då körningen slutar och kontrollera både total vila och längden på den längsta viloperioden."
},
{
  id: 144,
  delprov: 2,
  question: "Hur lång tid får du som längst köra taxi under en 24-timmarsperiod?",
  options: ["8 timmar", "11 timmar", "12 timmar", "13 timmar"],
  correct: 3,
  image: null,
  explanation: "Rätt svar är 13 timmar. Du ska ha haft minst 11 timmars dygnsvila under den 24-timmarsperiod som föregår varje tidpunkt då du utför transporter. Det innebär att högst 13 timmar återstår för körning och annat arbete inom samma 24-timmarsperiod. Tänk så här nästa gång: börja med 24 timmar och dra bort den dygnsvila som alltid måste finnas kvar. 24 minus 11 blir 13."
},
{
  id: 145,
  delprov: 2,
  question: "Efter dygnsvila kör du taxi från kl. 12.00. Du har uppehåll i arbetet mellan kl. 19.00 och kl. 22.00, då du får en långkörning till Stockholm. Den tar precis 6 timmar utan paus och lika lång tid tillbaka. När får du tidigast starta hemfärden från Stockholm?",
  options: ["Kl. 10.00", "Kl. 12.00", "Kl. 14.00", "Kl. 16.00", "Kl. 19.00"],
  correct: 1,
  image: null,
  explanation: "Rätt svar är kl. 12.00. Du måste under de föregående 24 timmarna ha haft minst 11 timmars dygnsvila, och om vilan delas upp måste en av viloperioderna vara minst 8 timmar. Inför hemfärden räcker det inte att bara titta på när du kommer fram till Stockholm, utan vilan måste räcka under hela den 6 timmar långa hemresan. Om du startar hem kl. 12.00 finns fortfarande 3 timmars vila mellan kl. 19.00 och 22.00 samt 8 timmars vila mellan kl. 04.00 och 12.00 inom de senaste 24 timmarna. Det blir totalt 11 timmar, och en viloperiod är minst 8 timmar. Därför är kl. 12.00 den tidigaste lagliga starttiden."
},
{
  id: 146,
  delprov: 2,
  question: "Du har tappat bort din taxiförarlegitimation. Vad gäller?",
  options: [
    "Jag får inte köra taxi förrän jag har fått en ny taxiförarlegitimation",
    "Jag får köra taxi i högst åtta veckor efter att jag har anmält förlusten",
    "Jag får köra taxi om jag har en kopia av legitimationen med mig",
    "Jag får köra taxi så snart jag har anmält förlusten till Transportstyrelsen"
  ],
  correct: 0,
  image: null,
  explanation: "Rätt svar är att du inte får köra taxi förrän du har fått en ny taxiförarlegitimation. Om legitimationen har tappats bort eller förlorats måste du ansöka om en ny, och under tiden får du inte köra taxi. Tänk så här nästa gång: taxiförarlegitimationen måste finnas och vara giltig, det räcker inte med anmälan, kopia eller väntetid."
},
{
  id: 147,
  delprov: 2,
  question: "Taxiföraren har stannat för att vänta på en kund. Är det tillåtet?",
  options: [
    "Nej, inte i någon av situationerna",
    "Ja, i situation B",
    "Ja, i båda situationerna",
    "Ja, i situation A"
  ],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/148.png",
  explanation: "Rätt svar är situation B. Att vänta på en kund räknas som parkering. I situation A står bilen i eller nära en kurva där sikten är skymd, och där får du inte stanna eller parkera. I situation B står bilen vid vägkanten på en plats som inte ser ut att omfattas av samma förbud. Tänk så här nästa gång: om du ska vänta på en kund ska du bedöma platsen som parkering, och då måste du undvika kurvor och andra platser där sikten är skymd."
},
{
  id: 148,
  delprov: 2,
  question: "Vilka av dessa fall anses som yrkesmässig trafik?",
  options: [
    "När jag skjutsar en person på motorcykel mot betalning",
    "När ett företag betalar mig för att transportera gods med min taxi",
    "När jag använder min taxi utan ersättning för att hjälpa en idrottsförening",
    "När jag använder min taxi privat för att köra mina egna barn till skolan"
  ],
  correct: 1,
  image: null,
  explanation: "Rätt svar är när ett företag betalar dig för att transportera gods med din taxi. Yrkestrafik är trafik där fordon och förare ställs till förfogande mot betalning för transporter av personer eller gods. Därför är en godstransport mot ersättning yrkesmässig trafik. Att hjälpa någon utan ersättning eller att köra privat är däremot inte yrkesmässig trafik. Tänk så här nästa gång: om transporten sker mot betalning för någon annans räkning är det normalt yrkesmässig trafik."
},
{
  id: 149,
  delprov: 2,
  question: "Vilket vägmärke används på huvudled för att varna för en farlig korsning?",
  options: ["Vägmärke A", "Vägmärke B", "Vägmärke C"],
  correct: 1,
  image: "https://teori-taxi.com/images/Lagstiftning/150.png",
  explanation: "Rätt svar är vägmärke B. På huvudled används märket A29 för att varna för en vägkorsning där trafikanter på den anslutande vägen har väjningsplikt eller stopplikt. Symbolen visar huvudleden som den tydligare vägen genom korsningen. Tänk så här nästa gång: om frågan gäller varningsmärke på huvudled ska du leta efter märket där huvudvägen markeras tydligt och den anslutande vägen är underordnad."
},
{
  id: 150,
  delprov: 2,
  question: "Vilka har rätt att plombera taxametern?",
  options: [
    "Ackrediterade besiktningsorgan",
    "Alla märkesverkstäder",
    "Vägverket",
    "Svensk Bilprovning"
  ],
  correct: 0,
  image: null,
  explanation: "Rätt svar är ackrediterade besiktningsorgan. Kraven på installation, kontroll och plombering av taxameterutrustning ingår i ett ackrediterat system. Det är därför inte alla verkstäder eller myndigheter som får göra detta, utan organ som är godkända genom ackreditering. Tänk så här nästa gång: när frågan gäller taxameter, plombering eller kontroll ska du leta efter alternativ som bygger på ackreditering, inte vanliga verkstäder eller gamla myndighetsnamn."
},
]  