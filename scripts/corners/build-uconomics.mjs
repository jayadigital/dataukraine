import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPublicRelease,
  createCornerDatabase,
  generatedAt,
  insertDatasets,
  publicRoot,
  root,
} from "./common.mjs";

const ucRoot = process.env.UC_ROOT ?? resolve(root, "../../../0_O_o.3/UC");
const packRoot = resolve(ucRoot, "artifacts/du 0.1");
const canonicalPath = resolve(ucRoot, "03-canonical_sources.md");
const publicUkraineRoot = resolve(publicRoot, "ukraine");
const generatedRoot = resolve(publicRoot, "uconomics");
const staticRoot = resolve(root, "public/uc");

const suiteMeta = {
  U1: {
    category: "Промислова економіка",
    title: "Промислова економіка",
    titleEn: "Industrial economy",
  },
  U2: {
    category: "Сервісна економіка",
    title: "Сервісна економіка",
    titleEn: "Service economy",
  },
  U3: {
    category: "Публічна, оборонна і соціальна економіка",
    title: "Публічна, оборонна і соціальна економіка",
    titleEn: "Public, defence and social economy",
  },
  U4: {
    category: "Макроекономіка і зовнішній сектор",
    title: "Макроекономіка і зовнішній сектор",
    titleEn: "Macroeconomics and the external sector",
  },
  U5: {
    category: "Податки, публічні фінанси, капітал та інвестиції",
    title: "Податки, публічні фінанси, капітал та інвестиції",
    titleEn: "Taxes, public finance, capital and investment",
  },
  U6: {
    category: "Люди, домогосподарства і праця",
    title: "Люди, домогосподарства і праця",
    titleEn: "People, households and labour",
  },
  U7: {
    category: "Втрати, допомога, відбудова і стійкість",
    title: "Втрати, допомога, відбудова і стійкість",
    titleEn: "Losses, aid, reconstruction and resilience",
  },
  U8: {
    category: "Інституції, власність і тіньова економіка",
    title: "Інституції, власність і тіньова економіка",
    titleEn: "Institutions, ownership and the shadow economy",
  },
};

const monthNumbers = new Map([
  ["січень", 1], ["січня", 1], ["січні", 1], ["january", 1], ["jan", 1],
  ["лютий", 2], ["лютого", 2], ["лютому", 2], ["february", 2], ["feb", 2],
  ["березень", 3], ["березня", 3], ["березні", 3], ["march", 3], ["mar", 3],
  ["квітень", 4], ["квітня", 4], ["квітні", 4], ["april", 4], ["apr", 4],
  ["травень", 5], ["травня", 5], ["травні", 5], ["may", 5],
  ["червень", 6], ["червня", 6], ["червні", 6], ["june", 6], ["jun", 6],
  ["липень", 7], ["липня", 7], ["липні", 7], ["july", 7], ["jul", 7],
  ["серпень", 8], ["серпня", 8], ["серпні", 8], ["august", 8], ["aug", 8],
  ["вересень", 9], ["вересня", 9], ["вересні", 9], ["september", 9], ["sep", 9],
  ["жовтень", 10], ["жовтня", 10], ["жовтні", 10], ["october", 10], ["oct", 10],
  ["листопад", 11], ["листопада", 11], ["листопаді", 11], ["november", 11], ["nov", 11],
  ["грудень", 12], ["грудня", 12], ["грудні", 12], ["december", 12], ["dec", 12],
]);

const translationPhrases = [
  ["Від мінуса до крихкого плюса", "From contraction to a fragile plus"],
  ["від третини довоєнного випуску до однієї тонни з шести", "from one third of pre-war output to one tonne in six"],
  ["Що змінилося", "What changed"],
  ["що змінилося", "what changed"],
  ["як відновити", "how to restore"],
  ["кінця 1970-х", "the late 1970s"],
  ["експорту", "exports"],
  ["бюджету", "budget"],
  ["капіталу", "capital"],
  ["ризику", "risk"],
  ["вартості", "value"],
  ["інфраструктура", "infrastructure"],
  ["інфраструктурою", "infrastructure"],
  ["інфраструктури", "infrastructure"],
  ["відновлено", "restored"],
  ["відновити", "restore"],
  ["ризикової", "risk-based"],
  ["індикаторів", "indicators"],
  ["показників", "indicators"],
  ["км²", "km²"],
  ["після початку повномасштабної війни", "after the full-scale invasion"],
  ["прямі іноземні інвестиції", "foreign direct investment"],
  ["публічні фінанси", "public finance"],
  ["тіньова економіка", "shadow economy"],
  ["соціальний захист", "social protection"],
  ["домогосподарства", "households"],
  ["державне управління", "public administration"],
  ["економічна активність", "economic activity"],
  ["виробничі потужності", "production capacity"],
  ["Промисловість", "Industry"],
  ["промисловість", "industry"],
  ["Металургія", "Metallurgy"],
  ["металургія", "metallurgy"],
  ["Електроенергія", "Electricity"],
  ["електроенергія", "electricity"],
  ["Електроенергетика", "Power sector"],
  ["електроенергетика", "power sector"],
  ["Енергетика", "Energy"],
  ["енергетика", "energy"],
  ["Виробництво", "Production"],
  ["виробництво", "production"],
  ["Видобування", "Extraction"],
  ["видобування", "extraction"],
  ["Переробка", "Processing"],
  ["переробка", "processing"],
  ["Будівництво", "Construction"],
  ["будівництво", "construction"],
  ["Добрива", "Fertilizers"],
  ["добрива", "fertilizers"],
  ["Машинобудування", "Mechanical engineering"],
  ["машинобудування", "mechanical engineering"],
  ["Оборонна промисловість", "Defence industry"],
  ["оборонна промисловість", "defence industry"],
  ["Агропромисловість", "Agri-food sector"],
  ["агропромисловість", "agri-food sector"],
  ["Харчова промисловість", "Food industry"],
  ["харчова промисловість", "food industry"],
  ["Нові технологічні індустрії", "New technology industries"],
  ["Історія", "History"],
  ["історія", "history"],
  ["Політика", "Policy"],
  ["політика", "policy"],
  ["Форсайт", "Foresight"],
  ["форсайт", "foresight"],
  ["Сервісна економіка", "Service economy"],
  ["сервісна економіка", "service economy"],
  ["Торгівля", "Trade"],
  ["торгівля", "trade"],
  ["Логістика", "Logistics"],
  ["логістика", "logistics"],
  ["Фінансові послуги", "Financial services"],
  ["Платежі", "Payments"],
  ["платежі", "payments"],
  ["Цифрові послуги", "Digital services"],
  ["Професійні послуги", "Professional services"],
  ["Малий бізнес", "Small business"],
  ["Транспортні послуги", "Transport services"],
  ["Нерухомість", "Real estate"],
  ["Гостинність", "Hospitality"],
  ["Креативна економіка", "Creative economy"],
  ["Автоматизація сервісів", "Service automation"],
  ["Держава воєнного часу", "Wartime state"],
  ["Оборона", "Defence"],
  ["Державне управління", "Public administration"],
  ["Громади", "Communities"],
  ["Школа", "School"],
  ["Медицина", "Healthcare"],
  ["Ветеранський перехід", "Veteran transition"],
  ["Державні підприємства", "State-owned enterprises"],
  ["Закупівлі", "Procurement"],
  ["Цифрова держава", "Digital state"],
  ["Макроекономіка", "Macroeconomics"],
  ["Резерви", "Reserves"],
  ["Споживання", "Consumption"],
  ["Інвестиція", "Investment"],
  ["Податкова система", "Tax system"],
  ["Державний бюджет", "State budget"],
  ["Гарантії й страхування", "Guarantees and insurance"],
  ["Пільгове фінансування МСП", "SME concessional finance"],
  ["Міжнародне бюджетне фінансування", "International budget finance"],
  ["Податкові пільги", "Tax expenditures"],
  ["Доступ до капіталу", "Access to capital"],
  ["Люди", "People"],
  ["Ринок праці", "Labour market"],
  ["Оплата праці", "Labour compensation"],
  ["Доходи", "Income"],
  ["Бідність", "Poverty"],
  ["Житло", "Housing"],
  ["Освіта", "Education"],
  ["Здоров’я", "Health"],
  ["Психологічна допомога", "Mental-health support"],
  ["Рахунок війни", "War account"],
  ["Пряма шкода", "Direct damage"],
  ["Географія удару", "Geography of damage"],
  ["Допомога без подвійного рахунку", "Aid without double counting"],
  ["Портфель", "Portfolio"],
  ["Воєнний ризик", "War risk"],
  ["Антикорупційний pipeline", "Anti-corruption pipeline"],
  ["Власність і приватизація", "Ownership and privatisation"],
  ["Захоплення держави", "State capture"],
  ["Банки і пов’язане кредитування", "Banks and related-party lending"],
  ["Бенефіціарна власність", "Beneficial ownership"],
  ["Повернення активів", "Asset recovery"],
  ["Неформальна праця", "Informal work"],
  ["Податкові й митні розриви", "Tax and customs gaps"],
  ["Нелегальні ринки", "Illegal markets"],
  ["Цифрова спостережуваність", "Digital observability"],
  ["довоєнного випуску", "pre-war output"],
  ["дефіцит", "shortage"],
  ["попиту", "demand"],
  ["попит", "demand"],
  ["ціна", "price"],
  ["ціни", "prices"],
  ["зросла", "rose"],
  ["зросли", "rose"],
  ["скоротився", "contracted"],
  ["перевищив", "exceeded"],
  ["перевищує", "exceeds"],
  ["купує", "buys"],
  ["замовлення", "orders"],
  ["можливості", "capacity"],
  ["зруйнований вузол", "destroyed node"],
  ["першого півріччя", "first half of the year"],
  ["пів року", "half-year"],
  ["кварталу", "quarter"],
  ["року", "year"],
  ["років", "years"],
  ["понад", "more than"],
  ["майже", "nearly"],
  ["однієї", "one"],
  ["тонни", "tonne"],
  ["з шести", "in six"],
  ["змінилося", "changed"],
  ["влітку", "in summer"],
  ["сільське господарство", "agriculture"],
  ["Експорт", "Exports"],
  ["експорт", "exports"],
  ["Імпорт", "Imports"],
  ["імпорт", "imports"],
  ["інвестиції", "investment"],
  ["капітал", "capital"],
  ["податки", "taxes"],
  ["бюджет", "budget"],
  ["доходи", "revenue"],
  ["видатки", "expenditure"],
  ["борг", "debt"],
  ["праця", "labour"],
  ["зайнятість", "employment"],
  ["безробіття", "unemployment"],
  ["зарплата", "wages"],
  ["Населення", "Population"],
  ["населення", "population"],
  ["міграція", "migration"],
  ["домогосподарств", "households"],
  ["відбудова", "reconstruction"],
  ["допомога", "aid"],
  ["збитки", "losses"],
  ["стійкість", "resilience"],
  ["Інституції", "Institutions"],
  ["інституції", "institutions"],
  ["власність", "ownership"],
  ["корупція", "corruption"],
  ["ризики", "risks"],
  ["ризик", "risk"],
  ["показник", "indicator"],
  ["частка", "share"],
  ["рівень", "level"],
  ["зростання", "growth"],
  ["падіння", "decline"],
  ["порівняння", "comparison"],
  ["України", "of Ukraine"],
  ["Україна", "Ukraine"],
];

const translationWords = [
  ["ФОП", "sole proprietor"],
  ["індикаторів", "indicators"],
  ["показників", "indicators"],
  ["Енергія", "Energy"],
  ["км", "km"],
  ["Металургійний", "Steel"],
  ["Видобувна", "Extractive"],
  ["Промислова", "Industrial"],
  ["Відбудова", "Reconstruction"],
  ["Відскок", "Rebound"],
  ["Втрачена", "Lost"],
  ["Тіньова", "Shadow"],
  ["Соціальна", "Social"],
  ["Соціальний", "Social"],
  ["Фіскальні", "Fiscal"],
  ["Вікова", "Age"],
  ["Ціна", "Price"],
  ["Курс", "Exchange rate"],
  ["Капітал", "Capital"],
  ["Повернення", "Return"],
  ["Дев’ять", "Nine"],
  ["Дефіцит", "Deficit"],
  ["До", "By"],
  ["Земля", "Land"],
  ["Людський", "Human"],
  ["Українці", "Ukrainians"],
  ["Сім", "Seven"],
  ["Борг", "Debt"],
  ["азартні", "gambling"],
  ["активу", "asset"],
  ["актив", "asset"],
  ["безпека", "security"],
  ["безпеку", "security"],
  ["більш", "more"],
  ["біля", "near"],
  ["близько", "about"],
  ["введений", "commissioned"],
  ["великих", "large"],
  ["верифікована", "verified"],
  ["видимим", "visible"],
  ["виживання", "survival"],
  ["виїзний", "mobile"],
  ["використання", "use"],
  ["випуск", "output"],
  ["війни", "war"],
  ["власних", "own"],
  ["воєнної", "wartime"],
  ["ВПО", "IDPs"],
  ["вразливості", "vulnerability"],
  ["втрат", "losses"],
  ["втратою", "loss"],
  ["вузла", "node"],
  ["входу", "entry"],
  ["гарантій", "guarantees"],
  ["гіперінфляції", "hyperinflation"],
  ["графіка", "graph"],
  ["гривня", "hryvnia"],
  ["грн", "UAH"],
  ["дали", "provided"],
  ["даними", "data"],
  ["держпідприємства", "state-owned enterprises"],
  ["десять", "ten"],
  ["дня", "day"],
  ["доброчесність", "integrity"],
  ["доброчесності", "integrity"],
  ["догляд", "care"],
  ["договору", "contract"],
  ["додаткову", "additional"],
  ["доларів", "dollars"],
  ["допомогою", "with support"],
  ["доставка", "delivery"],
  ["доходів", "revenues"],
  ["економіка", "economy"],
  ["економіку", "economy"],
  ["євро", "euros"],
  ["житло", "housing"],
  ["займають", "account for"],
  ["залишається", "remains"],
  ["зарплати", "wages"],
  ["захист", "protection"],
  ["захистом", "protection"],
  ["захисту", "protection"],
  ["зводяться", "are reconciled"],
  ["зі", "from"],
  ["змінює", "changes"],
  ["зовнішня", "external"],
  ["зріс", "grew"],
  ["експорту", "exports"],
  ["інвалідність", "disability"],
  ["інвестицій", "investment"],
  ["інституційної", "institutional"],
  ["іншої", "another"],
  ["іпотеки", "mortgage"],
  ["кадрів", "staff"],
  ["карта", "map"],
  ["квартали", "quarters"],
  ["квітні", "April"],
  ["комп’ютерним", "computer"],
  ["комп’ютерні", "computer"],
  ["контрактного", "contractual"],
  ["кордону", "border"],
  ["кредит", "credit"],
  ["кривої", "curve"],
  ["куди", "where"],
  ["ланцюг", "chain"],
  ["легальної", "legal"],
  ["липня", "July"],
  ["ліквідність", "liquidity"],
  ["людського", "human"],
  ["магії", "magic"],
  ["макрорежимів", "macro regimes"],
  ["маршрутів", "routes"],
  ["медичних", "medical"],
  ["менше", "less"],
  ["металевих", "metal"],
  ["міг", "could"],
  ["міграційна", "migration"],
  ["між", "between"],
  ["мільярдів", "billions"],
  ["міст", "bridge"],
  ["місяців", "months"],
  ["млн", "million"],
  ["млрд", "billion"],
  ["моделі", "model"],
  ["морський", "maritime"],
  ["навчального", "learning"],
  ["невидимий", "invisible"],
  ["нижча", "lower"],
  ["ніж", "than"],
  ["нові", "new"],
  ["об’єктів", "facilities"],
  ["обладнання", "equipment"],
  ["облік", "accounting"],
  ["означає", "means"],
  ["офіційний", "official"],
  ["оцінка", "estimate"],
  ["п’яти", "five"],
  ["червня", "June"],
  ["із", "from"],
  ["ігри", "games"],
  ["не", "not"],
  ["в", "in"],
  ["та", "and"],
  ["центральна", "central"],
  ["гарантії", "guarantees"],
  ["зайнятості", "employment"],
  ["ової", "of"],
  ["підприємства", "enterprises"],
  ["гарантія", "guarantee"],
  ["випуску", "output"],
  ["узгодженість", "alignment"],
  ["інфраструктура", "infrastructure"],
  ["панель", "panel"],
  ["параметр", "parameter"],
  ["пенсіонерів", "pensioners"],
  ["пенсіями", "pensions"],
  ["перевіреного", "verified"],
  ["перевірок", "checks"],
  ["півріччі", "half-year"],
  ["під", "under"],
  ["пік", "peak"],
  ["повертає", "returns"],
  ["повний", "full"],
  ["повторення", "repetition"],
  ["поза", "outside"],
  ["позитивний", "positive"],
  ["послугами", "services"],
  ["послуг", "services"],
  ["поточного", "current"],
  ["потреб", "needs"],
  ["початку", "start"],
  ["пошкодженого", "damaged"],
  ["пріоритетів", "priorities"],
  ["продуктивного", "productive"],
  ["продуктивності", "productivity"],
  ["промисловості", "industry"],
  ["простих", "simple"],
  ["публічна", "public"],
  ["публічний", "public"],
  ["публічної", "public"],
  ["пункт", "point"],
  ["раза", "times"],
  ["рамки", "framework"],
  ["рахунку", "bill"],
  ["режими", "regimes"],
  ["резервний", "backup"],
  ["рента", "rent"],
  ["ринку", "market"],
  ["різні", "different"],
  ["роботи", "work"],
  ["розподіл", "distribution"],
  ["розриву", "gap"],
  ["роки", "years"],
  ["рослинництво", "crop production"],
  ["ряд", "series"],
  ["саме", "exactly"],
  ["самостійністю", "independence"],
  ["сектором", "sector"],
  ["сервіси", "services"],
  ["сервісної", "service"],
  ["середньої", "average"],
  ["системі", "system"],
  ["систему", "system"],
  ["скільки", "how much"],
  ["скоротилося", "contracted"],
  ["слабшає", "weakens"],
  ["соціальна", "social"],
  ["спроможність", "capacity"],
  ["спрямовано", "allocated"],
  ["став", "became"],
  ["стає", "becomes"],
  ["стало", "became"],
  ["створили", "created"],
  ["створює", "creates"],
  ["стоїть", "stands"],
  ["страхування", "insurance"],
  ["сум", "sums"],
  ["супроводу", "support"],
  ["сценарії", "scenarios"],
  ["сягнути", "reach"],
  ["тимчасового", "temporary"],
  ["тис", "thousand"],
  ["тисячі", "thousands"],
  ["титулу", "title"],
  ["тонн", "tonnes"],
  ["третину", "one third"],
  ["трлн", "trillion"],
  ["ударами", "strikes"],
  ["удару", "strike"],
  ["урвався", "was interrupted"],
  ["участі", "participation"],
  ["фактичної", "actual"],
  ["фахівців", "specialists"],
  ["фізична", "physical"],
  ["фронту", "frontline"],
  ["функцію", "function"],
  ["харчування", "meals"],
  ["цивільними", "civilian"],
  ["часу", "time"],
  ["чисел", "numbers"],
  ["чому", "why"],
  ["швидкого", "rapid"],
  ["шкоди", "damage"],
  ["шлях", "path"],
  ["щоденних", "daily"],
  ["ЄС", "EU"],
  ["ВВП", "GDP"],
  ["EBRD", "EBRD"],
  ["EIB", "EIB"],
  ["український", "Ukrainian"],
  ["українська", "Ukrainian"],
  ["українські", "Ukrainian"],
  ["український", "Ukrainian"],
  ["літній", "summer"],
  ["літня", "summer"],
  ["серпнева", "August"],
  ["серпневий", "August"],
  ["півтора", "one and a half"],
  ["чотири", "four"],
  ["один", "one"],
  ["однієї", "one"],
  ["два", "two"],
  ["три", "three"],
  ["дев’ять", "nine"],
  ["сім", "seven"],
  ["п’ять", "five"],
  ["першого", "first"],
  ["перший", "first"],
  ["другого", "second"],
  ["другий", "second"],
  ["нової", "new"],
  ["новий", "new"],
  ["офіційних", "official"],
  ["доданої", "added"],
  ["вартість", "value"],
  ["обороту", "turnover"],
  ["рахунків", "accounts"],
  ["розрахунків", "payments"],
  ["відбуваються", "take place"],
  ["готівки", "cash"],
  ["карткових", "card"],
  ["операцій", "transactions"],
  ["ночівель", "overnight stays"],
  ["секції", "section"],
  ["чеків", "receipts"],
  ["наступний", "next"],
  ["вимір", "measure"],
  ["вагони", "railcars"],
  ["продовжує", "continues"],
  ["робіт", "works"],
  ["роботу", "work"],
  ["можливості", "capacity"],
  ["замовлень", "orders"],
  ["ресурсів", "resources"],
  ["незалежної", "independent"],
  ["залишився", "remained"],
  ["рівні", "level"],
  ["кінця", "end"],
  ["десятиліття", "decades"],
  ["програм", "programmes"],
  ["питання", "question"],
  ["вимірюваного", "measurable"],
  ["результату", "result"],
  ["стартова", "starting"],
  ["рамка", "framework"],
  ["економіки", "economy"],
  ["першому", "first"],
  ["півріччя", "half-year"],
  ["перший", "first"],
  ["квартал", "quarter"],
  ["кварталу", "quarter"],
  ["пошкоджено", "damaged"],
  ["зачеплено", "affected"],
  ["дітей", "children"],
  ["бар’єрами", "barriers"],
  ["втраченого", "lost"],
  ["навчання", "learning"],
  ["контакту", "contact"],
  ["системою", "system"],
  ["функціонального", "functional"],
  ["відновлення", "recovery"],
  ["нову", "new"],
  ["демографічної", "demographic"],
  ["бази", "base"],
  ["одна", "one"],
  ["система", "system"],
  ["виснаження", "depletion"],
  ["спроможності", "capacity"],
  ["маршрут", "route"],
  ["працю", "work"],
  ["підтримує", "supports"],
  ["догляду", "care"],
  ["кордоном", "abroad"],
  ["повернених", "returnees"],
  ["заходу", "measure"],
  ["відомим", "visible"],
  ["кадр", "snapshot"],
  ["поточний", "current"],
  ["поточна", "current"],
  ["поточному", "current"],
  ["державні", "state"],
  ["державних", "state"],
  ["активів", "assets"],
  ["центрів", "centres"],
  ["відповідальності", "responsibility"],
  ["поставки", "delivery"],
  ["користувачів", "users"],
  ["обмінів", "exchanges"],
  ["траєкторії", "trajectories"],
  ["заміщення", "replacement"],
  ["опори", "support"],
  ["крихкого", "fragile"],
  ["плюса", "positive growth"],
  ["мінуса", "negative growth"],
  ["два", "two"],
  ["рахунки", "accounts"],
  ["повернення", "return"],
  ["родини", "household"],
  ["виробника", "producer"],
  ["розрив", "gap"],
  ["передавач", "transmitter"],
  ["шоку", "shock"],
  ["позиції", "positions"],
  ["бізнесу", "business"],
  ["держави", "state"],
  ["купує", "buys"],
  ["зовнішнє", "external"],
  ["фінансування", "financing"],
  ["довшим", "longer"],
  ["дешевшим", "cheaper"],
  ["проте", "but"],
  ["зобов’язанням", "obligation"],
  ["тримає", "supports"],
  ["підсилює", "strengthens"],
  ["починається", "starts"],
  ["введеного", "commissioned"],
  ["режимів", "regimes"],
  ["безперервного", "continuous"],
  ["зовнішньої", "external"],
  ["надходжень", "revenue"],
  ["видатків", "expenditure"],
  ["загального", "general"],
  ["фонду", "fund"],
  ["пільг", "benefits"],
  ["відкриває", "opens"],
  ["приватний", "private"],
  ["договір", "contract"],
  ["траншу", "tranche"],
  ["довгого", "long-term"],
  ["потреба", "need"],
  ["готовим", "ready"],
  ["проєктом", "project"],
  ["бар’єрів", "barriers"],
  ["застави", "collateral"],
  ["воєнного", "war"],
  ["першого", "first"],
  ["точності", "precision"],
  ["межі", "bounds"],
  ["вікова", "age"],
  ["структура", "structure"],
  ["менша", "smaller"],
  ["база", "base"],
  ["праці", "labour"],
  ["більшу", "larger"],
  ["за кордоном", "abroad"],
  ["ширша", "broader"],
  ["картина", "picture"],
  ["прості", "simple"],
  ["суми", "sums"],
  ["слабким", "weak"],
  ["розподільним", "distributional"],
  ["обліком", "accounting"],
  ["зростання", "growth"],
  ["нерівності", "inequality"],
  ["умова", "condition"],
  ["повернення", "return"],
  ["фонду", "stock"],
  ["після", "after"],
  ["повторних", "repeated"],
  ["ударів", "strikes"],
  ["потужність", "capacity"],
  ["резервність", "redundancy"],
  ["час", "time"],
  ["єдиного", "single"],
  ["пропускна", "throughput"],
  ["запуску", "restart"],
  ["втрачена", "lost"],
  ["функція", "function"],
  ["перевищують", "exceed"],
  ["рахунок", "bill"],
  ["ремонту", "repair"],
  ["готового", "ready"],
  ["проєкту", "project"],
  ["пастки", "trap"],
  ["стійкої", "resilient"],
  ["модернізації", "modernisation"],
  ["справ", "cases"],
  ["підозрюваних", "suspects"],
  ["засуджених", "convictions"],
  ["контролю", "control"],
  ["політично", "politically"],
  ["пов’язаних", "connected"],
  ["компаній", "companies"],
  ["корпоративного", "corporate"],
  ["експозиції", "exposure"],
  ["судового", "court"],
  ["стягнення", "recovery"],
  ["усього", "entire"],
  ["ланцюга", "chain"],
  ["реєстрації", "registration"],
  ["верифікованого", "verified"],
  ["економічного", "economic"],
  ["ефекту", "effect"],
  ["стадій", "stages"],
  ["замість", "instead of"],
  ["одного", "one"],
  ["відсотка", "percentage"],
  ["статус", "status"],
  ["зайнятості", "employment"],
  ["конверті", "envelope"],
  ["залежний", "dependent"],
  ["ризикової", "risk-based"],
  ["різниці", "difference"],
  ["встановленого", "established"],
  ["зобов’язання", "liability"],
  ["тютюнового", "tobacco"],
  ["кількістю", "count"],
  ["року", "year"],
  ["років", "years"],
  ["року", "year"],
  ["році", "year"],
  ["з", "from"],
  ["у", "in"],
  ["і", "and"],
  ["й", "and"],
  ["на", "at"],
  ["до", "to"],
  ["від", "from"],
  ["за", "for"],
  ["для", "for"],
  ["без", "without"],
  ["поруч", "alongside"],
  ["як", "as"],
  ["що", "what"],
  ["ще", "still"],
];

function escapeRegExp(value) {
  return value;
}

function translateTitle(title, suite, articleId) {
  let translated = String(title ?? "");
  for (const [from, to] of [...translationPhrases].sort((left, right) => right[0].length - left[0].length)) {
    translated = translated.replaceAll(from, to);
  }
  for (const [from, to] of [...translationWords].sort((left, right) => right[0].length - left[0].length)) {
    translated = translated.replace(
      new RegExp(`(?<![\\p{L}])${escapeRegExp(from)}(?![\\p{L}])`, "gu"),
      to,
    );
  }
  if (translated === title || /[А-Яа-яІіЇїЄєҐґ]/u.test(translated)) {
    translated = `${suiteMeta[suite]?.titleEn ?? "Uconomics"}: ${translated}`;
  }
  return translated.trim();
}

function parseFrontMatter(block) {
  const separator = block.indexOf("\n---\n", 4);
  const front = block.slice(4, separator < 0 ? block.length : separator);
  const fields = {};
  let currentList = null;
  for (const line of front.split("\n")) {
    const listItem = line.match(/^\s+-\s+(.+)$/u);
    if (listItem && currentList) {
      fields[currentList].push(listItem[1].trim());
      continue;
    }
    const field = line.match(/^([a-z_]+):\s*(.*)$/u);
    if (!field) continue;
    currentList = null;
    if (field[2]) fields[field[1]] = field[2].trim();
    else {
      fields[field[1]] = [];
      currentList = field[1];
    }
  }
  const body = separator < 0 ? "" : block.slice(separator + 5);
  return { fields, body };
}

function sourceLineParts(line) {
  const id = line.match(/`(uc-s-[^`]+)`/u)?.[1];
  if (!id) return null;
  const urls = line.match(/https?:\/\/[^\s|)]+/gu) ?? [];
  const title = line
    .replace(/^\s*-\s*/u, "")
    .replace(/`uc-s-[^`]+`\s*[—-]\s*/u, "")
    .replace(/\s*[—-]\s*https?:\/\/.*$/u, "")
    .trim();
  return { id, title, url: urls[0] ?? null };
}

function sourceMapFromMarkdown(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const parts = sourceLineParts(line);
    if (!parts) continue;
    const previous = map.get(parts.id);
    if (!previous || (!previous.url && parts.url)) map.set(parts.id, parts);
  }
  return map;
}

function sourceRefsForBlock(fields, body, sourceMap) {
  const ids = Array.isArray(fields.source_ids) ? fields.source_ids : [];
  const sourceSection = body.match(/## Sources\s+([\s\S]*?)(?=\n## |$)/u)?.[1] ?? "";
  const local = new Map();
  for (const line of sourceSection.split("\n")) {
    const parts = sourceLineParts(line);
    if (parts) local.set(parts.id, parts);
  }
  return ids.map((id) => local.get(id) ?? sourceMap.get(id) ?? {
    id,
    title: "Canonical source reference",
    url: null,
  });
}

function splitMarkdownRow(line) {
  return line.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|").map((item) => item.trim());
}

function normalizedTable(body) {
  const section = body.match(/## Normalized Data\s+([\s\S]*?)(?=\n## |$)/u)?.[1] ?? "";
  const lines = section.split("\n").filter((line) => line.trim().startsWith("|"));
  if (lines.length < 3) return [];
  const headers = splitMarkdownRow(lines[0]).map((header) => header.toLocaleLowerCase());
  const rows = [];
  for (const line of lines.slice(2)) {
    const values = splitMarkdownRow(line);
    if (values.length !== headers.length || values.every((value) => !value)) continue;
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  }
  return rows;
}

function rawCarrier(body) {
  return body.match(/## Raw Carrier Payload\s+```text\s+([\s\S]*?)\s+```/u)?.[1]?.trim() ?? "";
}

function fallbackFactsFromRows(tableRows, graphTitle, fields, body) {
  const facts = tableRows
    .map((row) => {
      const dimension = String(row.dimension ?? "").trim();
      const value = String(row.value ?? "").trim();
      if (!value || /^raw_graph_line$/iu.test(dimension)) return null;
      return {
        label: dimension || graphTitle,
        period: String(row.period ?? "").trim() || "—",
        value,
        unit: String(row["unit or scale"] ?? row.unit ?? "").trim() || "text",
        status: String(row.status ?? fields.status ?? "published").trim(),
      };
    })
    .filter(Boolean);
  if (facts.length) return facts.slice(0, 12);
  const carrierFacts = tableRows
    .filter((row) => /^raw_graph_line$/iu.test(String(row.dimension ?? "").trim()))
    .map((row) => String(row.value ?? "").trim())
    .filter((value) => value && value !== graphTitle && !/^canonical graph\s*:/iu.test(value) && !/^канонічний графік\s*:/iu.test(value))
    .map((value) => {
      const range = value.match(/^((?:19|20|21)\d{2}\s*[-–—]\s*(?:19|20|21)\d{2})\s+(.+)$/u);
      const text = range?.[2]?.trim() || value;
      return {
        label: text,
        period: range?.[1]?.replaceAll(" ", "") || "carrier",
        value: text,
        unit: "text",
        status: "carrier-text",
      };
    });
  if (carrierFacts.length) return carrierFacts.slice(0, 12);
  const carrier = rawCarrier(body);
  const firstLine = carrier.split(/\n+/u).map((line) => line.trim()).find(Boolean);
  return [{
    label: graphTitle,
    period: String(fields.release_date ?? "release"),
    value: firstLine || "Graph payload not present in the release carrier.",
    unit: "text",
    status: String(fields.status ?? "not published"),
  }];
}

function numberTokens(text) {
  const clean = String(text ?? "")
    .replaceAll("−", "-")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/gu, " ")
    .replace(/\b\d{4}-\d{2}\b/gu, " ")
    // Narrative periods such as 2022–2026 are not numeric observations.
    .replace(/\b(?:19|20|21)\d{2}\s*-\s*(?:19|20|21)\d{2}\b/gu, " ");
  if (/\b\d+\s*\/\s*\d+\b/u.test(clean)) return [];
  const tokens = [];
  const expression = /(?<![A-Za-zА-Яа-яІіЇїЄєҐґ])[<>≈~]?\s*[+-]?(?:\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[,.]\d+)?(?![A-Za-zА-Яа-яІіЇїЄєҐґ])/gu;
  for (const match of clean.matchAll(expression)) {
    const token = match[0].trim();
    const before = clean.slice(Math.max(0, match.index - 2), match.index);
    if (/^\s*\d+\.\s*$/u.test(before)) continue;
    const value = Number(token.replace(/[<>≈~]/gu, "").replace(/[ \u00a0]/gu, "").replace(",", "."));
    if (!Number.isFinite(value)) continue;
    if (Number.isInteger(value) && value >= 1900 && value <= 2100) continue;
    tokens.push({ value, token, index: match.index });
  }
  return tokens;
}

function scalarTokens(value) {
  const text = String(value ?? "").trim();
  if (!text || /https?:\/\//iu.test(text) || /qualitative|missing|gap|немає даних|не визначено/iu.test(text)) return [];
  return numberTokens(text);
}

function yearFrom(text) {
  const years = [...String(text ?? "").matchAll(/\b(19\d{2}|20\d{2}|21\d{2})\b/gu)].map((item) => Number(item[1]));
  return years.at(-1) ?? null;
}

function dateFromPeriod(period, fallbackText, releaseDate) {
  const text = `${period ?? ""} ${fallbackText ?? ""}`.trim();
  const exactDate = text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/u);
  if (exactDate) return `${exactDate[3]}-${String(exactDate[2]).padStart(2, "0")}-${String(exactDate[1]).padStart(2, "0")}`;
  const year = yearFrom(text) ?? Number(String(releaseDate).slice(0, 4));
  if (!year) return String(releaseDate).slice(0, 10);
  const quarter = text.match(/\bQ([1-4])\b|\b([1-4])-?й?\s*(?:квартал|кварталі)\b/iu);
  if (quarter) {
    const month = Number(quarter[1] ?? quarter[2]) * 3;
    const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/півріч|half-year|half year/iu.test(text)) return `${year}-06-30`;
  const monthMatches = [...text.toLocaleLowerCase().matchAll(new RegExp([...monthNumbers.keys()].join("|"), "gu"))];
  const month = monthMatches.length ? monthNumbers.get(monthMatches.at(-1)[0]) : null;
  if (month) {
    const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return `${year}-12-31`;
}

function inferredUnit(tableUnit, title, text) {
  const raw = String(tableUnit ?? "").trim();
  if (raw && !/raw carrier line/iu.test(raw)) return raw;
  const subject = `${title} ${text}`;
  if (/%|відсот|р\/р|y\/y/iu.test(subject)) return "%";
  if (/млн\s*тон|million tonnes|млн т/iu.test(subject)) return "млн тонн";
  if (/млрд\s*(?:дол|usd)|billion usd/iu.test(subject)) return "млрд дол. США";
  if (/млн\s*(?:дол|usd)|million usd/iu.test(subject)) return "млн дол. США";
  if (/млрд\s*грн|billion uah/iu.test(subject)) return "млрд грн";
  if (/грн|uah/iu.test(subject)) return "грн";
  if (/млн|million/iu.test(subject)) return "млн";
  if (/млрд|billion/iu.test(subject)) return "млрд";
  if (/осіб|people|persons/iu.test(subject)) return "осіб";
  if (/тонн|tonnes|tons/iu.test(subject)) return "тонн";
  return "значення";
}

function statusInfo(value, fallback) {
  const text = `${value ?? ""} ${fallback ?? ""}`.toLocaleLowerCase();
  const forecast = /forecast|model|scenario|прогноз|модель|сценар/iu.test(text);
  const partial = forecast || /derived|annualized|оцін|поперед|carrier|visual|derived/iu.test(text);
  const qualityFlags = [];
  if (/carrier|visual/iu.test(text)) qualityFlags.push("carrier-text");
  if (/derived|annualized|оцін|поперед/iu.test(text)) qualityFlags.push("derived");
  if (forecast) qualityFlags.push(/scenario|сценар/iu.test(text) ? "scenario" : "modelled");
  if (/[<>≈~]/u.test(text)) qualityFlags.push("approximate");
  return {
    action: forecast ? "F" : "I",
    partial,
    qualityFlags,
  };
}

function indicatorPart(value) {
  const ascii = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/gu, "")
    .replace(/[^A-Za-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .toUpperCase()
    .slice(0, 32);
  return ascii || "VALUE";
}

function numberTokensWithYears(text) {
  const clean = String(text ?? "").replaceAll("−", "-").replaceAll("–", "-").replaceAll("—", "-");
  const tokens = [];
  const expression = /(?<![A-Za-zА-Яа-яІіЇїЄєҐґ])[<>≈~]?\s*[+-]?(?:\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[,.]\d+)?(?![A-Za-zА-Яа-яІіЇїЄєҐґ])/gu;
  for (const match of clean.matchAll(expression)) {
    const token = match[0].trim();
    const value = Number(token.replace(/[<>≈~]/gu, "").replace(/[ \u00a0]/gu, "").replace(",", "."));
    if (!Number.isFinite(value)) continue;
    tokens.push({ value, token, index: match.index });
  }
  return tokens;
}

function labelFromCarrier(line) {
  const label = line
    .replace(/(?<![A-Za-zА-Яа-яІіЇїЄєҐґ])[<>≈~]?\s*[+-]?(?:\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[,.]\d+)?(?![A-Za-zА-Яа-яІіЇїЄєҐґ])/gu, "")
    .replace(/[|█]+/gu, " ")
    .replace(/\s+/gu, " ")
    .replace(/^[\s:;,.+-]+|[\s:;,.+-]+$/gu, "")
    .trim();
  return label.slice(0, 180) || "Carrier observation";
}

function makeRow({ datasetId, suite, articleId, dimension, period, value, unit, status, rawValue, sourceText, releaseDate, graphTitle }) {
  const info = statusInfo(status, sourceText);
  const date = dateFromPeriod(period, sourceText, releaseDate);
  const indicatorCode = `UC_${suite}_${articleId.split(".")[1]}_${indicatorPart(dimension || graphTitle)}`;
  const pointLabel = String(period || sourceText || date).slice(0, 180);
  return {
    timePeriod: String(period || date),
    date,
    value,
    indicatorCode,
    indicatorLabel: dimension || graphTitle,
    pointLabel,
    unit: inferredUnit(unit, graphTitle, sourceText),
    action: info.action,
    partial: info.partial,
    qualityFlags: info.qualityFlags,
    freq: "A",
    dimensions: { dimension: dimension || graphTitle },
    attributes: {
      sourceStatus: status,
      originalPeriod: period || null,
      sourceText: sourceText || null,
    },
    raw: {
      dataset_id: datasetId,
      article_id: articleId,
      dimension: dimension || graphTitle,
      period: period || null,
      value,
      original_value: rawValue ?? String(value),
      unit: unit || "raw carrier line",
      status: status || "carrier-text",
      source_text: sourceText || null,
    },
  };
}

function parseDatasetBlock(block, sourceMap, number) {
  const { fields, body } = parseFrontMatter(block);
  const id = String(fields.dataset_id);
  const articleId = String(fields.article_id);
  const suite = String(fields.suite ?? articleId.split(".")[0]).toUpperCase();
  const article = body.match(/^\*\*Article:\*\*\s+(.+)$/mu)?.[1] ?? articleId;
  const title = article.replace(/^U\d+\.\d+\s+/u, "").trim() || id;
  const graphTitle = body.match(/^\*\*Graph title:\*\*\s+(.+)$/mu)?.[1]?.trim() ?? title;
  const releaseDate = String(fields.release_date ?? "2026-08-24");
  const refs = sourceRefsForBlock(fields, body, sourceMap);
  const rows = [];
  const tableRows = normalizedTable(body);
  const fallbackFacts = fallbackFactsFromRows(tableRows, graphTitle, fields, body);
  const carrierYearRow = tableRows.find((row) =>
    /^(?:year|рік)$/iu.test(String(row.dimension ?? "")) || /^\s*(?:year|рік)(?:\s|$)/iu.test(String(row.value ?? "")),
  );
  const carrierYears = carrierYearRow
    ? numberTokensWithYears(carrierYearRow.value).map((token) => token.value).filter((value) => Number.isInteger(value) && value >= 1900 && value <= 2100)
    : [];
  for (const tableRow of tableRows) {
    const value = tableRow.value ?? tableRow["value"];
    const isCarrierRow = /^raw_graph_line$/iu.test(tableRow.dimension);
    const isCarrierMetadata = isCarrierRow && /^(?:modelled|модель|компоненти|components|канонічний графік|canonical graph|year|рік)/iu.test(String(value).trim());
    if (isCarrierMetadata) continue;
    const tokens = scalarTokens(value);
    const dimension = isCarrierRow
      ? labelFromCarrier(value)
      : tableRow.dimension;
    const scenarioValues = isCarrierRow && carrierYears.length && tokens.length >= carrierYears.length &&
      /^(?:S\d+|scenario|сценар)/iu.test(String(value).trim())
      ? tokens.slice(-carrierYears.length)
      : [];
    if (scenarioValues.length) {
      scenarioValues.forEach((token, index) => rows.push(makeRow({
        datasetId: id,
        suite,
        articleId,
        dimension,
        period: String(carrierYears[index]),
        value: token.value,
        unit: tableRow["unit or scale"] ?? tableRow.unit,
        status: tableRow.status,
        rawValue: value,
        sourceText: value,
        releaseDate,
        graphTitle,
      })));
    } else {
      tokens.forEach((token) => rows.push(makeRow({
        datasetId: id,
        suite,
        articleId,
        dimension,
        period: tableRow.period,
        value: token.value,
        unit: tableRow["unit or scale"] ?? tableRow.unit,
        status: tableRow.status,
        rawValue: value,
        sourceText: isCarrierRow ? value : tableRow.period,
        releaseDate,
        graphTitle,
      })));
    }
  }
  const existingKeys = new Set(rows.map((row) => `${row.date}|${row.value}|${row.unit}`));
  const carrier = tableRows.length ? "" : rawCarrier(body);
  if (carrier) {
    for (const line of carrier.split(/\n+/u).map((item) => item.trim()).filter(Boolean)) {
      const tokens = numberTokens(line);
      for (const token of tokens) {
        const unit = inferredUnit("raw carrier line", graphTitle, line);
        const date = dateFromPeriod("", line, releaseDate);
        const key = `${date}|${token.value}|${unit}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        rows.push(makeRow({
          datasetId: id,
          suite,
          articleId,
          dimension: labelFromCarrier(line),
          period: line.slice(0, 180),
          value: token.value,
          unit,
          status: fields.status || "carrier-text",
          rawValue: token.token,
          sourceText: line,
          releaseDate,
          graphTitle,
        }));
      }
    }
  }
  const validRows = rows.filter((row) => row.date && Number.isFinite(row.value));
  const firstSource = refs.find((ref) => ref.url && !/pending manual recovery/iu.test(ref.url));
  const sourceUrl = firstSource?.url ?? "https://dataukraine.proto.fund/corner/uconomics";
  const suiteInfo = suiteMeta[suite] ?? {
    category: "Uconomics",
    title: "Uconomics",
    titleEn: "Uconomics",
  };
  const titleEn = translateTitle(title, suite, articleId);
  const sourceLimitation = refs.some((ref) => !ref.url)
    ? "Частина канонічних посилань має статус URL pending manual recovery; вихідний ID збережено."
    : "";
  const carrierLimitation = validRows.some((row) => row.qualityFlags.includes("carrier-text"))
    ? "Частину точок відновлено з текстового carrier payload; статус точки не змінено на офіційне спостереження."
    : "";
  const limitation = [sourceLimitation, carrierLimitation].filter(Boolean).join(" ") || null;
  return {
    id,
    number,
    flowId: id.toUpperCase().replaceAll("-", "_"),
    version: "UC 0.1",
    originalTitle: title,
    title,
    titleUa: title,
    titleEn,
    originalLanguage: "uk",
    category: suiteInfo.category,
    frequency: validRows.length > 1 && new Set(validRows.map((row) => row.date.slice(0, 4))).size > 1
      ? "Річна / за періодом carrier-графіка"
      : "За періодом carrier-графіка",
    priority: number <= 8 ? "hero" : number <= 32 ? "top" : "deep",
    officialUrl: sourceUrl,
    sourceUrl,
    fetchMode: "normalized UC 0.1 article datapack",
    description: graphTitle,
    descriptionUa: graphTitle,
    descriptionEn: `${titleEn}. The release retains the published period, unit, status and source binding for each recovered point.`,
    question: `Що показує набір «${title}»?`,
    why: "Набір зберігає дані, на яких побудовано одну статтю Uconomics, щоб графік можна було перевірити та повторно використати.",
    annualization: "Ряд нормалізовано з UC 0.1; період, одиницю, статус і текст carrier-графіка збережено без заповнення пропусків.",
    limitation,
    rows: validRows,
    sourceRefs: refs,
    rawArticle: block,
    articleId,
    suite,
    graphTitle,
    releaseDate,
    fallbackFacts: rows.length ? [] : fallbackFacts,
  };
}

async function readPack() {
  const names = (await readdir(packRoot))
    .filter((name) => /^u[1-8]-datapack-.*\.md$/u.test(name))
    .sort();
  const sourceMap = sourceMapFromMarkdown(await readFile(canonicalPath, "utf8"));
  const blocks = [];
  for (const name of names) {
    const text = await readFile(resolve(packRoot, name), "utf8");
    const starts = [...text.matchAll(/^---\ndataset_id:/gmu)].map((match) => match.index);
    for (let index = 0; index < starts.length; index += 1) {
      blocks.push(text.slice(starts[index], starts[index + 1] ?? text.length));
    }
  }
  const parsed = blocks
    .map((block) => parseDatasetBlock(block, sourceMap, 0))
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
  return parsed.map((dataset, index) => ({ ...dataset, number: index + 1 }));
}

function coverageFor(dataset, latestDate) {
  return dataset.sourceRefs.map((ref) => ({
    id: ref.id,
    label: ref.title,
    status: "included",
    description: "Canonical source binding declared by the UC article datapack.",
    availability: ref.url ? "URL recorded" : "URL pending manual recovery",
    limitation: ref.url ? null : "The source ID is retained, but no URL was supplied in the canonical source file.",
    latestDate,
    latestRows: dataset.rows.filter((row) => row.date === latestDate).length,
    latestUrl: ref.url ?? "https://dataukraine.proto.fund/corner/uconomics",
    cadence: dataset.frequency,
    chartedPoints: dataset.rows.length,
    cache: { snapshots: 1, rows: dataset.rows.length, bytes: Buffer.byteLength(dataset.rawArticle) },
    annualSnapshots: {
      count: new Set(dataset.rows.map((row) => row.date.slice(0, 4))).size,
      firstYear: Number(dataset.rows.map((row) => row.date.slice(0, 4)).sort()[0]) || null,
      lastYear: Number(dataset.rows.map((row) => row.date.slice(0, 4)).sort().at(-1)) || null,
      rows: dataset.rows.length,
    },
  }));
}

async function patchUconomicsRelease(datasets, factOnlyDatasets) {
  const manifestPath = resolve(publicRoot, "uconomics/dataroom/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const liveById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  for (const [id, dataset] of liveById) {
    const datasetRoot = resolve(publicRoot, `uconomics/dataroom/${id}`);
    const summaryPath = resolve(datasetRoot, "summary.json");
    const summary = JSON.parse(await readFile(summaryPath, "utf8"));
    const graphCodeBase = id.toUpperCase();
    summary.graphCodeBase = graphCodeBase;
    summary.flowId = dataset.flowId;
    summary.titleOriginal = dataset.originalTitle;
    summary.sourceReferences = dataset.sourceRefs;
    summary.presentation = dataset.rows.length ? "chart" : "facts";
    summary.fallbackFacts = dataset.fallbackFacts ?? [];
    summary.coverage = coverageFor(dataset, summary.freshness.latestDate);
    summary.freshness.sources = summary.coverage.map((item) => ({
      id: item.id,
      label: item.label,
      latestDate: item.latestDate,
      rowCount: item.latestRows,
      url: item.latestUrl,
    }));
    summary.indicators = summary.indicators.map((indicator, index) => ({
      ...indicator,
      graphCode: `${graphCodeBase}-G${String(index + 1).padStart(2, "0")}`,
    }));
    await writeFile(summaryPath, `${JSON.stringify(summary)}\n`);
    await writeFile(resolve(datasetRoot, "source.md"), `${dataset.rawArticle.trim()}\n`);
    await writeFile(resolve(datasetRoot, "sources.json"), `${JSON.stringify(dataset.sourceRefs, null, 2)}\n`);
    const card = manifest.datasets.find((item) => item.id === id);
    if (card) {
      Object.assign(card, {
        graphCodeBase,
        titleOriginal: dataset.originalTitle,
        titleUa: dataset.titleUa,
        titleEn: dataset.titleEn,
        url: `/corner/uconomics/dataset/${id}`,
      });
    }
  }
  manifest.meta.cornerNumber = 14;
  manifest.meta.publisher = "Uconomics 0.1 article corpus";
  manifest.meta.datasetCount = manifest.datasets.length;
  manifest.meta.liveDatasetCount = manifest.datasets.length;
  manifest.meta.graphReadyDatasetCount = datasets.filter((dataset) => dataset.rows.length).length;
  manifest.meta.factOnlyDatasetCount = factOnlyDatasets.length;
  manifest.meta.failedDatasetCount = 0;
  manifest.failures = [];
  manifest.factsOnly = factOnlyDatasets;
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  return manifest;
}

async function mergeRootIndexes(uconomicsManifest, datasets, factOnlyDatasets) {
  const rootIndexPath = resolve(publicUkraineRoot, "id-index.json");
  const rootIndex = JSON.parse(await readFile(rootIndexPath, "utf8"));
  for (const dataset of uconomicsManifest.datasets) {
    const graphCodeBase = dataset.graphCodeBase;
    rootIndex.byShortId[dataset.id.toLowerCase()] = {
      shortId: dataset.id.toLowerCase(),
      graphCodeBase,
      corner: "uconomics",
      datasetId: dataset.id,
      number: dataset.number,
      title: dataset.title,
      titleUa: dataset.titleUa,
      titleEn: dataset.titleEn,
      url: `https://dataukraine.proto.fund/id/${dataset.id.toLowerCase()}`,
    };
  }
  rootIndex.generatedAt = generatedAt;
  rootIndex.count = Object.keys(rootIndex.byShortId).length;
  await writeFile(rootIndexPath, `${JSON.stringify(rootIndex, null, 2)}\n`);
  const universalPath = resolve(publicUkraineRoot, "universal.json");
  const universal = JSON.parse(await readFile(universalPath, "utf8"));
  const baseCorners = universal.corners.filter((corner) => corner.id !== "uconomics");
  const uconomicsRows = datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
  const uconomicsCorner = {
    id: "uconomics",
    number: 14,
    name: "Uconomics",
    title: "Uconomics 0.1",
    titleUa: "Uconomics 0.1",
    titleEn: "Uconomics 0.1",
    nameUa: "Uconomics",
    nameEn: "Uconomics",
    url: "https://dataukraine.proto.fund/corner/uconomics",
    role: "Аналітичний корпус U1–U8, пов’язаний із канонічними джерелами",
    roleEn: "U1–U8 analytical corpus linked to canonical sources",
    description: "Нормалізовані графіки для восьми груп статей Uconomics 0.1.",
    descriptionEn: "Normalized article graphs for the eight Uconomics 0.1 article suites.",
    datasetCount: uconomicsManifest.datasets.length,
    observationCount: uconomicsRows,
    deferredCount: 0,
    factOnlyCount: factOnlyDatasets.length,
    latestDate: datasets.flatMap((dataset) => dataset.rows.map((row) => row.date)).sort().at(-1) ?? null,
    coverageStart: datasets.flatMap((dataset) => dataset.rows.map((row) => row.date)).sort()[0] ?? null,
    sourceUrl: "https://dataukraine.proto.fund/corner/uconomics",
    categories: [...new Set(datasets.map((dataset) => dataset.category))].sort(),
    status: "live",
  };
  universal.corners = [
    ...baseCorners,
    uconomicsCorner,
  ];
  universal.meta.generatedAt = generatedAt;
  universal.meta.cornerCount = universal.corners.length;
  universal.meta.datasetCount = universal.corners.reduce((sum, corner) => sum + (corner.datasetCount ?? 0), 0);
  universal.meta.observationCount = universal.corners.reduce((sum, corner) => sum + (corner.observationCount ?? 0), 0);
  await writeFile(universalPath, `${JSON.stringify(universal)}\n`);
  return { rootIndex, universal, uconomicsRows };
}

async function buildCanonicalGraphRegistry(uconomicsManifest, rootIndex, universal) {
  const corners = [];
  for (const corner of universal.corners.filter((item) => item.id !== "uconomics")) {
    const cornerRoot = ["frames", "scenarios"].includes(corner.id)
      ? resolve(staticRoot, corner.id)
      : resolve(publicRoot, corner.id);
    const manifestPath = resolve(cornerRoot, "dataroom/manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    for (const dataset of manifest.datasets ?? []) {
      const summaryPath = resolve(cornerRoot, `dataroom/${dataset.id}/summary.json`);
      const summary = JSON.parse(await readFile(summaryPath, "utf8"));
      const sourceRefs = (summary.coverage ?? [])
        .filter((ref) => ref.latestUrl)
        .map((ref) => ({ id: ref.id, label: ref.label, url: ref.latestUrl }));
      const sourceUrl = summary.endpoint ?? sourceRefs[0]?.url ?? corner.sourceUrl;
      const base = String(dataset.graphCodeBase ?? `${corner.id}-${String(dataset.number).padStart(4, "0")}`);
      corners.push({
        corner: corner.id,
        cornerNumber: corner.id === "ukraine" ? "catalogue" : corner.id,
        graphId: base.toLowerCase(),
        graphCode: dataset.graphCodeBase ?? null,
        datasetId: dataset.id,
        number: dataset.number,
        titleUa: dataset.titleUa ?? dataset.title,
        titleEn: dataset.titleEn ?? dataset.title,
        publicUrl: `https://dataukraine.proto.fund/id/${base.replace(/^UA-/iu, "").toLowerCase()}`,
        sourceUrl,
        sourceId: base.replace(/^UA-/iu, "").toLowerCase(),
        sourceRefs,
        flatFiles: null,
      });
    }
  }
  for (const dataset of uconomicsManifest.datasets) {
    const base = dataset.graphCodeBase.toLowerCase();
    const summaryPath = `/uc/uconomics/dataroom/${dataset.id}`;
    const sourceRefs = JSON.parse(await readFile(resolve(publicRoot, `uconomics/dataroom/${dataset.id}/sources.json`), "utf8"));
    corners.push({
      corner: "uconomics",
      cornerNumber: 14,
      graphId: base,
      graphCode: dataset.graphCodeBase,
      datasetId: dataset.id,
      number: dataset.number,
      titleUa: dataset.titleUa,
      titleEn: dataset.titleEn,
      publicUrl: `https://dataukraine.proto.fund/id/${base}`,
      sourceUrl: sourceRefs.find((ref) => ref.url)?.url ?? "https://dataukraine.proto.fund/corner/uconomics",
      sourceId: base,
      sourceRefs,
      flatFiles: {
        summary: `${summaryPath}/summary.json`,
        annualCsv: `${summaryPath}/annual.csv`,
        markdown: `${summaryPath}/README.md`,
        sourceMarkdown: `${summaryPath}/source.md`,
        sourcesJson: `${summaryPath}/sources.json`,
      },
    });
  }
  const registry = {
    generatedAt,
    title: "Ukraine Dataroom canonical graph registry",
    description: "One stable registry of graph IDs, public pages, publisher corners and original source links.",
    graphCount: corners.length,
    cornerCount: universal.corners.length,
    conventions: {
      canonicalId: "dataukraine.proto.fund/id/{publisher-code}-{dataset-number}",
      uconomicsId: "dataukraine.proto.fund/id/uc-u{suite}-{article}-d1",
      directFlatFiles: "Uconomics static release files are available below /uc/uconomics/; other corners remain served by their API-backed public contract.",
    },
    corners,
  };
  const artifactRoot = packRoot;
  await writeFile(resolve(artifactRoot, "canonical-graphs.json"), `${JSON.stringify(registry, null, 2)}\n`);
  const lines = [
    "# DataUkraine canonical graph registry",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Naming and access",
    "",
    "Each graph has one stable public ID. Corners 01–13 are publisher corners; Uconomics is Corner 14 and uses the article-corpus ID `uc-u{suite}-{article}-d1`.",
    "",
    "The original publisher URL is kept on every row. Uconomics also exposes direct static files under `/uc/uconomics/` so a client can bypass the API for the normalized release.",
    "",
    `Total graph records: **${corners.length}** across **${universal.corners.length}** corners.`,
    "",
    "## Graph catalogue",
    "",
    "| Corner | Graph ID | Dataset | Ukrainian name | English name | Public page | Original source | Flat files |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const graph of corners) {
    const flat = graph.flatFiles
      ? `[JSON](${graph.flatFiles.summary}) · [CSV](${graph.flatFiles.annualCsv}) · [MD](${graph.flatFiles.markdown})`
      : "API-backed";
    const sources = (graph.sourceRefs ?? []).map((ref) => ref.url ? `[${ref.id}](${ref.url})` : `\`${ref.id}\``).join("; ") || (graph.sourceUrl ? `[source](${graph.sourceUrl})` : "—");
    lines.push(`| ${graph.corner} | \`${graph.sourceId}\` | \`${graph.datasetId}\` | ${String(graph.titleUa).replaceAll("|", "\\|")} | ${String(graph.titleEn).replaceAll("|", "\\|")} | [open](${graph.publicUrl}) | ${sources} | ${flat} |`);
  }
  await writeFile(resolve(artifactRoot, "canonical-graphs.md"), `${lines.join("\n")}\n`);
  return registry;
}

async function writeAudit(datasets, manifest, failures, factOnlyDatasets, registry, universal, uconomicsRows) {
  const audit = {
    generatedAt,
    corner: "uconomics",
    cornerNumber: 14,
    sourcePack: packRoot,
    canonicalSources: canonicalPath,
    articleDatasets: datasets.length,
    graphReadyDatasets: datasets.filter((dataset) => dataset.rows.length).length,
    factOnlyDatasets: factOnlyDatasets.length,
    excludedDatasets: failures.length,
    normalizedRows: uconomicsRows,
    canonicalGraphCount: registry.graphCount,
    canonicalCornerCount: universal.corners.length,
    exclusions: failures,
    factOnly: factOnlyDatasets,
    policy: {
      publish: "Publish every article dataset. Use charts for numeric observations and a fact card for qualitative or text-only source material.",
      noImputation: "Do not fill missing periods, convert qualitative statements into numbers, or merge incompatible units.",
      status: "Observed, derived, modelled, scenario and carrier-text values remain separately flagged.",
    },
  };
  await writeFile(resolve(packRoot, "uconomics-release-audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(resolve(packRoot, "uconomics-release-audit.md"), [
    "# Uconomics 0.1 release audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    `- Article datasets received: **${datasets.length}**`,
    `- Graph-ready datasets published: **${datasets.filter((dataset) => dataset.rows.length).length}**`,
    `- Fact-only datasets published: **${factOnlyDatasets.length}**`,
    `- Excluded from publication: **${failures.length}**`,
    `- Normalized numeric rows: **${uconomicsRows.toLocaleString("en-US")}**`,
    `- Canonical graph registry records: **${registry.graphCount.toLocaleString("en-US")}**`,
    "",
    "## Publication rule",
    "",
    "Every article receives a public dataset page. Explicit numeric values become chart points; qualitative rows and text-only carriers are shown as fact cards without being converted into invented numbers.",
    "",
    "## Source integrity",
    "",
    "Every Uconomics dataset retains the UC source IDs declared in `03-canonical_sources.md`. A missing publisher URL is recorded as `URL pending manual recovery`, never replaced with an invented link.",
    "",
    "## Fact-only articles",
    "",
    ...factOnlyDatasets.map((dataset) => `- **${dataset.id}:** ${dataset.factsCount} fact blocks; no numeric observation was available for a chart.`),
    "",
    "## Exclusions",
    "",
    ...failures.map((failure) => `- **${failure.id}:** ${failure.error}`),
    "",
    "## Direct files",
    "",
    "- [Canonical graph registry](canonical-graphs.md)",
    "- [Canonical graph registry JSON](canonical-graphs.json)",
    "- [Corner 14 release manifest](../../../country-data-corners/public/data/uconomics/dataroom/manifest.json)",
  ].join("\n") + "\n");
}

const datasets = await readPack();
const factOnlyDatasets = datasets.filter((dataset) => !dataset.rows.length).map((dataset) => ({
  id: dataset.id,
  articleId: dataset.articleId,
  suite: dataset.suite,
  factsCount: dataset.fallbackFacts?.length ?? 0,
  sourceIds: dataset.sourceRefs.map((ref) => ref.id),
}));
const failures = [];

await rm(generatedRoot, { recursive: true, force: true });
// Preserve the independently generated Gate 1 and Gate 2 releases under
// /uc/frames and /uc/scenarios while refreshing the Corner 14 payload.
await rm(resolve(staticRoot, "uconomics"), { recursive: true, force: true });
const { db, databasePath } = await createCornerDatabase("uconomics");
insertDatasets(db, datasets);
await buildPublicRelease("uconomics", db, datasets, failures);
db.close();

const manifest = await patchUconomicsRelease(datasets, factOnlyDatasets);
const merged = await mergeRootIndexes(manifest, datasets, factOnlyDatasets);
const staticUconomicsRoot = resolve(staticRoot, "uconomics");
await mkdir(staticRoot, { recursive: true });
await cp(generatedRoot, staticUconomicsRoot, { recursive: true });
await writeFile(resolve(staticRoot, "id-index.json"), `${JSON.stringify(merged.rootIndex, null, 2)}\n`);
await writeFile(resolve(staticRoot, "universal.json"), `${JSON.stringify(merged.universal)}\n`);
const registry = await buildCanonicalGraphRegistry(manifest, merged.rootIndex, merged.universal);
await writeAudit(datasets, manifest, failures, factOnlyDatasets, registry, merged.universal, merged.uconomicsRows);
await cp(resolve(packRoot, "canonical-graphs.json"), resolve(staticUconomicsRoot, "canonical-graphs.json"));
await cp(resolve(packRoot, "canonical-graphs.md"), resolve(staticUconomicsRoot, "canonical-graphs.md"));
await cp(resolve(packRoot, "uconomics-release-audit.json"), resolve(staticUconomicsRoot, "uconomics-release-audit.json"));
await cp(resolve(packRoot, "uconomics-release-audit.md"), resolve(staticUconomicsRoot, "uconomics-release-audit.md"));
console.log(`Uconomics 0.1: ${datasets.length} article datasets, ${datasets.length - factOnlyDatasets.length} graph-ready, ${factOnlyDatasets.length} fact-only, ${failures.length} excluded, ${merged.uconomicsRows} numeric rows -> ${databasePath}`);
