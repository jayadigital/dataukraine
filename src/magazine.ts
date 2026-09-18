import type { SeriesPoint } from "./types";

export type MagazineSource = {
  labelUa: string;
  labelEn: string;
  publisher: string;
  url: string;
};

export type MagazineArticle = {
  slug: string;
  number: string;
  publishedAt: string;
  periodUa: string;
  periodEn: string;
  titleUa: string;
  titleEn: string;
  standfirstUa: string;
  standfirstEn: string;
  paragraphsUa: string[];
  paragraphsEn: string[];
  chart: {
    titleUa: string;
    titleEn: string;
    noteUa: string;
    noteEn: string;
    unit: string;
    color: string;
    view: "line" | "area" | "column";
    points: SeriesPoint[];
  };
  figures: Array<{
    labelUa: string;
    labelEn: string;
    value: string;
    noteUa: string;
    noteEn: string;
  }>;
  related: Array<{
    labelUa: string;
    labelEn: string;
    href: string;
  }>;
  sources: MagazineSource[];
};

const unemployment: SeriesPoint[] = [
  [1991, 1.9], [1992, 1.9], [1993, 2], [1994, 2], [1995, 5.62],
  [1996, 7.65], [1997, 8.93], [1998, 11.32], [1999, 11.864],
  [2000, 11.707], [2001, 11.061], [2002, 10.136], [2003, 9.057],
  [2004, 8.59], [2005, 7.18], [2006, 6.81], [2007, 6.351],
  [2008, 6.363], [2009, 8.84], [2010, 8.1], [2011, 7.851],
  [2012, 7.529], [2013, 7.17], [2014, 9.27], [2015, 9.14],
  [2016, 9.35], [2017, 9.5], [2018, 8.799], [2019, 8.194],
  [2020, 9.475], [2021, 9.834],
].map(([year, value]) => ({
  date: `${year}-12-31`,
  year,
  value,
}));

export const magazineArticles: MagazineArticle[] = [
  {
    slug: "2025-against-2024",
    number: "PFM-001",
    publishedAt: "2026-07-30",
    periodUa: "Річний підсумок",
    periodEn: "Annual review",
    titleUa: "2025 проти 2024: зростання сповільнилося, ціновий тиск посилився",
    titleEn: "2025 versus 2024: slower growth, stronger price pressure",
    standfirstUa:
      "Оцінки IMF показують економіку, що продовжила зростати, але повільніше: 1,8% після 3,2%. Середня інфляція майже подвоїлася, а зовнішній і борговий баланс стали напруженішими.",
    standfirstEn:
      "IMF estimates show an economy that kept growing, but more slowly: 1.8% after 3.2%. Average inflation almost doubled, while external and debt balances became more strained.",
    paragraphsUa: [
      "У 2025 році українська економіка не повернулася до рецесії, але втратила швидкість. У зіставній рамці IMF реальний ВВП зріс на 1,8% проти 3,2% у 2024 році. Це різниця між продовженням відновлення і достатньо швидким відновленням: позитивний знак у ВВП ще не означає, що виробництво, доходи та інвестиції вже надолужили попередні втрати.",
      "Найвиразніший контраст року був у цінах. Середня інфляція зросла з 6,5% до 12,7%, хоча грудневий темп сповільнився до 8% рік до року. Ці дві цифри не суперечать одна одній. Середня інфляція описує весь рік, а грудневий показник порівнює ціни наприкінці року з груднем попереднього. НБУ пов’язував пізніше уповільнення передусім із більшими врожаями, слабшим тиском на ринку праці та стійкішим валютним ринком.",
      "Зовнішній контур став складнішим. Дефіцит поточного рахунку в рамці IMF розширився з 8% до 15% ВВП, а валовий державний борг зріс з 89,7% до 108,7% ВВП. Для читача це означає, що країна більше спиралася на імпорт, зовнішнє фінансування і державний баланс. Самі відсотки не оцінюють якість витрат: під час війни борг може фінансувати оборону та базові послуги, але він звужує простір для помилки й робить регулярність міжнародної підтримки критичною.",
      "Ринок праці у прогнозній рамці виглядав менш напруженим за показником безробіття: 11,6% проти 13,1%. Проте зниження безробіття не дорівнює повному відновленню зайнятості. Міграція, мобілізація, дефіцит працівників у частині професій і відсутність повних воєнних обстежень змінюють знаменник. Тому цей ряд варто читати разом із зайнятістю, участю в робочій силі, зарплатами та вакансіями.",
      "Підсумок 2025 року не зводиться до одного кольору. ВВП залишився в плюсі, інфляція завершила рік нижче свого травневого піку, але борг і зовнішній дефіцит зросли. Для моделі це не сигнал «краще» або «гірше», а зміна режиму: повільніше реальне зростання при дорожчих цінах і більшій залежності від фінансування.",
    ],
    paragraphsEn: [
      "Ukraine did not fall back into recession in 2025, but the economy lost momentum. In the comparable IMF frame, real GDP grew by 1.8%, down from 3.2% in 2024. That is the difference between recovery continuing and recovery moving fast enough: a positive GDP number does not mean output, income and investment have recovered earlier losses.",
      "Prices produced the clearest contrast. Average inflation rose from 6.5% to 12.7%, even though the December rate slowed to 8% year on year. Those numbers describe different windows. Average inflation covers the whole year; the December rate compares prices at year-end with the previous December. The NBU linked the late-year slowdown mainly to larger harvests, weaker labour-market pressure and a stable foreign-exchange market.",
      "The external position became harder. The IMF frame puts the current-account deficit at 15% of GDP, versus 8% in 2024, and gross public debt at 108.7% of GDP, up from 89.7%. This means greater reliance on imports, external finance and the public balance sheet. The ratios do not judge the quality of wartime spending, but they do show less room for error and a stronger dependence on predictable international support.",
      "Unemployment in the IMF frame fell to 11.6% from 13.1%, but a lower rate is not the same as full employment recovery. Migration, mobilisation, occupational shortages and gaps in wartime surveys affect the denominator. The series should therefore be read with employment, labour-force participation, wages and vacancies.",
      "The 2025 result is not a simple green or red signal. Output remained positive and inflation ended below its May peak, while debt and the external deficit increased. For a model, this is a regime change: slower real growth, higher average prices and more dependence on financing.",
    ],
    chart: {
      titleUa: "Зростання реального ВВП України, 2020–2026",
      titleEn: "Ukraine real GDP growth, 2020–2026",
      noteUa: "2020–2025: історія та оцінки IMF; 2026: прогноз.",
      noteEn: "2020–2025: IMF history and estimates; 2026: forecast.",
      unit: "%",
      color: "#0f5eff",
      view: "column",
      points: [
        { date: "2020-12-31", year: 2020, value: -3.8 },
        { date: "2021-12-31", year: 2021, value: 3.4 },
        { date: "2022-12-31", year: 2022, value: -28.8 },
        { date: "2023-12-31", year: 2023, value: 5.5 },
        { date: "2024-12-31", year: 2024, value: 3.2 },
        { date: "2025-12-31", year: 2025, value: 1.8 },
        { date: "2026-12-31", year: 2026, value: 2, forecast: true },
      ],
    },
    figures: [
      { labelUa: "Реальний ВВП", labelEn: "Real GDP", value: "1.8%", noteUa: "2025; 3,2% у 2024", noteEn: "2025; 3.2% in 2024" },
      { labelUa: "Середня інфляція", labelEn: "Average inflation", value: "12.7%", noteUa: "2025; 6,5% у 2024", noteEn: "2025; 6.5% in 2024" },
      { labelUa: "Державний борг", labelEn: "Public debt", value: "108.7%", noteUa: "ВВП; 89,7% у 2024", noteEn: "of GDP; 89.7% in 2024" },
    ],
    related: [
      { labelUa: "Кадри економіки 2020–2026", labelEn: "Economic frames 2020–2026", href: "/frames#gate-1" },
      { labelUa: "Показники IMF для України", labelEn: "IMF indicators for Ukraine", href: "/corner/imf" },
    ],
    sources: [
      { labelUa: "Дані про Україну", labelEn: "Ukraine data", publisher: "World Bank", url: "https://data.worldbank.org/country/ukraine" },
      { labelUa: "Оновлення інфляції за 2025 рік", labelEn: "2025 inflation update", publisher: "NBU", url: "https://bank.gov.ua/en/news/all/komentar-natsionalnogo-banku-schodo-rivnya-inflyatsiyi-u-2025-rotsi" },
      { labelUa: "Огляд ставки та прогнозу", labelEn: "Rate and outlook coverage", publisher: "Reuters", url: "https://www.investing.com/news/economy-news/ukraines-c-bank-holds-key-rate-at-155-sees-slower-2025-economic-growth-3990564" },
    ],
  },
  {
    slug: "2026-open-year-signals",
    number: "PFM-002",
    publishedAt: "2026-07-30",
    periodUa: "Відкритий 2026 рік",
    periodEn: "Open 2026",
    titleUa: "2026 проти 2025: дезінфляція вже видима, річний результат ще не сформований",
    titleEn: "2026 versus 2025: disinflation is visible, the annual result is not",
    standfirstUa:
      "За однаковий відрізок інфляція знизилася на 7,7 в. п., кредити зросли на 10,9%, депозити — на 15,8%. Це ранні сигнали до липня, а не підсумок 2026 року.",
    standfirstEn:
      "Across matching windows, inflation fell by 7.7 percentage points, loans rose 10.9%, and deposits 15.8%. These are signals through July, not a final 2026 result.",
    paragraphsUa: [
      "На кінець липня 2026 року найнадійніше порівнювати не повний 2025 рік із неповним 2026-м, а однакові календарні вікна. У такому зрізі червнева інфляція становила 8,2% рік до року проти 15,9% у червні 2025-го. Зниження на 7,7 відсоткового пункту є сильним сигналом дезінфляції, але воно ще не гарантує такого самого грудневого результату.",
      "Монетарні ряди показують, що номінальний обсяг грошей і банківських балансів зріс. М3 у червні був на 15,7% більшим, ніж роком раніше; депозити — на 15,8%, кредити — на 10,9%. Це не слід автоматично називати реальним розширенням на ті самі відсотки: частину приросту пояснюють ціни, курс і зміна структури. Водночас кредитний ріст вище 10% на тлі жорсткої ставки вказує, що банківський канал не зупинився.",
      "Облікова ставка на порівнювану дату знизилася з 15,5% до 15%, тоді як середня UONIA майже не змінилася і залишалася біля 15,06%. Це важлива різниця між рішенням центрального банку та фактичною ціною одноденних грошей між банками. Коли вони близькі, короткий грошовий ринок передає сигнал політики без великого розриву.",
      "Міжнародні резерви у червні були на 2,7% вищими, ніж роком раніше, але на 5,2% нижчими, ніж у травні. Обидва твердження правильні: річне порівняння показує запас міцності, місячне — рух потоків фінансування, інтервенцій і платежів. Одне число без бази порівняння могло б створити протилежне враження.",
      "Річний прогноз залишається сценарієм. IMF очікує 2% зростання ВВП і 6,1% середньої інфляції; НБУ на початку року прогнозував 1,8% зростання та 7,5% інфляції на кінець року. Дані серпня–грудня можуть змінити траєкторію через енергетику, врожай, зовнішнє фінансування і безпекові умови. До появи цих спостережень правильний статус 2026 року — «частково спостережено, частково спрогнозовано».",
    ],
    paragraphsEn: [
      "At the end of July 2026, the sound comparison is not a full 2025 against an incomplete 2026, but matching calendar windows. June inflation was 8.2% year on year, versus 15.9% in June 2025. A fall of 7.7 percentage points is a strong disinflation signal, but it does not guarantee the same year-end outcome.",
      "Monetary series show growth in nominal money and bank balance sheets. M3 was 15.7% higher than a year earlier; deposits rose 15.8% and loans 10.9%. These are not equal real-volume gains because prices, exchange rates and composition matter. Still, double-digit loan growth under a tight policy rate indicates that the banking channel has not stopped.",
      "The key policy rate fell from 15.5% to 15%, while average UONIA barely moved and remained close to 15.06%. The distinction matters: one is the central-bank decision, the other the observed price of overnight interbank money. Their proximity suggests that the short money market is transmitting the policy signal without a large gap.",
      "International reserves were 2.7% higher than a year earlier in June, yet 5.2% lower than in May. Both statements are true. The annual comparison describes the buffer; the monthly comparison reflects financing, interventions and payments. A number without its baseline could give the opposite impression.",
      "The annual outcome remains a scenario. The IMF expects 2% GDP growth and 6.1% average inflation; the NBU’s early-year outlook put growth at 1.8% and year-end inflation at 7.5%. August–December data can still alter the path through energy, harvests, external finance and security conditions. The correct label for 2026 is therefore partly observed, partly forecast.",
    ],
    chart: {
      titleUa: "Інфляція: однаковий місяць 2025 і 2026 років",
      titleEn: "Inflation: matching months in 2025 and 2026",
      noteUa: "Річний темп у червні; зниження вимірюється у відсоткових пунктах.",
      noteEn: "June year-on-year rate; the change is measured in percentage points.",
      unit: "%",
      color: "#ff312e",
      view: "column",
      points: [
        { date: "2025-06-01", year: 2025, value: 15.9 },
        { date: "2026-06-01", year: 2026, value: 8.2, partial: true },
      ],
    },
    figures: [
      { labelUa: "Інфляція р/р", labelEn: "Inflation y/y", value: "8.2%", noteUa: "червень 2026; −7,7 в. п. р/р", noteEn: "June 2026; −7.7 pp y/y" },
      { labelUa: "Кредити", labelEn: "Loans", value: "+10.9%", noteUa: "червень до червня", noteEn: "June to June" },
      { labelUa: "Депозити", labelEn: "Deposits", value: "+15.8%", noteUa: "червень до червня", noteEn: "June to June" },
    ],
    related: [
      { labelUa: "Повний річний зріз НБУ", labelEn: "Full NBU annual comparison", href: "/corner/nbu/report/annual-2025-2026" },
      { labelUa: "Прогнози для України", labelEn: "Ukraine forecasts", href: "/#forecasts" },
    ],
    sources: [
      { labelUa: "Інфляційний звіт 2026", labelEn: "2026 Inflation Report", publisher: "NBU", url: "https://bank.gov.ua/en/news/all/inflyatsiya-bude-pomirnoyu-u-20262028-rokah-a-ekonomika-postupovo-zrostatime--inflyatsiyniy-zvit" },
      { labelUa: "Зниження ставки до 15%", labelEn: "Rate cut to 15%", publisher: "Reuters", url: "https://www.investing.com/news/economy-news/ukraines-central-bank-cuts-key-rate-to-15-after-inflation-slows-4472980" },
      { labelUa: "Енергетичні ризики для зростання", labelEn: "Energy risks to growth", publisher: "Associated Press", url: "https://apnews.com/article/838255aa27f76046a296dfe029e2d0a9" },
    ],
  },
  {
    slug: "june-against-may-2026",
    number: "PFM-003",
    publishedAt: "2026-07-30",
    periodUa: "Місячний монітор",
    periodEn: "Monthly monitor",
    titleUa: "Червень проти травня: резерви зменшилися, кредит і гроші продовжили рости",
    titleEn: "June versus May: reserves declined while credit and money kept growing",
    standfirstUa:
      "Резерви зменшилися на 5,2% за місяць. Одночасно М3 додав 1,2%, кредити — 1,8%, а річна інфляція сповільнилася з 8,6% до 8,2%.",
    standfirstEn:
      "Reserves fell 5.2% over the month. At the same time, M3 added 1.2%, loans 1.8%, and annual inflation slowed from 8.6% to 8.2%.",
    paragraphsUa: [
      "Червневий зріз показує не одну історію, а рух різних частин балансу. Міжнародні резерви зменшилися з 48,22 до 45,73 млрд доларів, або на 5,2%. Резерви є запасом іноземної валюти центрального банку; вони змінюються через надходження допомоги, продаж валюти на ринку, переоцінку активів та виплати за боргом. Тому місячне зниження є приводом перевірити потоки, але не автоматичним доказом втрати макрофінансової стійкості.",
      "У гривневому контурі рух був додатним. Грошова маса М3 зросла на 49 млрд грн, до 4,10 трлн грн. Кредити додали 22,8 млрд грн, або 1,8%, а депозити майже не змінилися — плюс 0,04%. Швидший рух кредитів за депозити протягом одного місяця вартий спостереження, але одного періоду недостатньо, щоб говорити про зміну банківського циклу.",
      "Інфляція рік до року знизилася з 8,6% у травні до 8,2% у червні. Це зміна темпу, а не падіння загального рівня цін: ціни могли продовжувати зростати, але повільніше, ніж рік тому. Для домогосподарства різниця проста: кошик не став дешевшим лише тому, що інфляція сповільнилася.",
      "Разом ці показники описують економіку, де ціновий тиск слабшає, банківський кредит розширюється, а валютний буфер за місяць зменшився. Для прогнозу наступний крок — перевірити липневі резерви після публікації, склад кредитного приросту за секторами та те, чи продовжиться сповільнення базової інфляції.",
      "Публікаційний календар тут важливий не менше за цифри. На 30 липня червень є останнім повним зіставним місяцем для цього набору. Частина липневих щоденних ставок уже доступна, але місячні банківські та зовнішні ряди виходять пізніше. Змішувати ці частоти в одному висновку без позначки було б помилкою.",
    ],
    paragraphsEn: [
      "The June cut shows several parts of the balance sheet moving in different directions. International reserves fell from USD 48.22 billion to USD 45.73 billion, or 5.2%. Reserves change with external inflows, foreign-exchange sales, asset valuation and debt payments. A monthly decline is therefore a reason to inspect flows, not automatic proof of lost macrofinancial stability.",
      "The hryvnia side expanded. Broad money M3 rose by UAH 49 billion to UAH 4.10 trillion. Loans added UAH 22.8 billion, or 1.8%, while deposits were almost flat at plus 0.04%. Credit moving faster than deposits for one month is worth monitoring, but one observation cannot establish a new banking cycle.",
      "Year-on-year inflation slowed from 8.6% in May to 8.2% in June. This is a change in speed, not a fall in the overall price level: prices can keep rising, only more slowly than a year earlier. For a household, the basket does not become cheaper merely because inflation decelerates.",
      "Together the figures describe easing price pressure, expanding bank credit and a smaller monthly foreign-currency buffer. The next forecast check is July reserves, the sector composition of credit growth, and whether core inflation continues to slow.",
      "The release calendar matters as much as the values. On 30 July, June is the latest complete comparable month for this set. Some July daily rates are already available, while monthly banking and external-sector series arrive later. Mixing those frequencies without a label would be misleading.",
    ],
    chart: {
      titleUa: "Міжнародні резерви, травень–червень 2026",
      titleEn: "International reserves, May–June 2026",
      noteUa: "Запас на звітну дату, а не сума за місяць.",
      noteEn: "Stock at the reporting date, not a monthly sum.",
      unit: "USD bn",
      color: "#00bfe9",
      view: "column",
      points: [
        { date: "2026-05-01", value: 48.22147 },
        { date: "2026-06-01", value: 45.73252 },
      ],
    },
    figures: [
      { labelUa: "Резерви", labelEn: "Reserves", value: "$45.73bn", noteUa: "−5,2% м/м", noteEn: "−5.2% m/m" },
      { labelUa: "Грошова маса М3", labelEn: "Broad money M3", value: "+1.2%", noteUa: "за червень", noteEn: "in June" },
      { labelUa: "Кредити", labelEn: "Loans", value: "+1.8%", noteUa: "за червень", noteEn: "in June" },
    ],
    related: [
      { labelUa: "Повний місячний звіт НБУ", labelEn: "Full NBU monthly report", href: "/corner/nbu/report/monthly-2026-06" },
      { labelUa: "Календар публікацій НБУ", labelEn: "NBU release calendar", href: "https://bank.gov.ua/en/statistic/calendar-dissemin-statist" },
    ],
    sources: [
      { labelUa: "Календар статистичних публікацій", labelEn: "Statistics release calendar", publisher: "NBU", url: "https://bank.gov.ua/en/statistic/calendar-dissemin-statist" },
      { labelUa: "Резерви та валютна ліквідність", labelEn: "Reserves and foreign-currency liquidity", publisher: "NBU", url: "https://bank.gov.ua/en/markets/international-reserves-allinfo" },
      { labelUa: "Макроекономічний контекст", labelEn: "Macroeconomic context", publisher: "World Bank", url: "https://www.worldbank.org/en/country/ukraine/overview" },
    ],
  },
  {
    slug: "july-week-three-against-week-two",
    number: "PFM-004",
    publishedAt: "2026-07-30",
    periodUa: "Тижневий сигнал",
    periodEn: "Weekly signal",
    titleUa: "Третій тиждень липня проти другого: короткі ставки стабільні, курс трохи вищий",
    titleEn: "Third week of July versus the second: stable overnight rates, a slightly higher exchange rate",
    standfirstUa:
      "Середня UONIA змінилася лише на −0,005 в. п. Середній офіційний USD/UAH у робочі дні зріс приблизно на 0,35%. Своп-індекс був надто розрідженим для сильного висновку.",
    standfirstEn:
      "Average UONIA changed by only −0.005 percentage points. The weekday official USD/UAH average rose about 0.35%. Swap observations were too sparse for a strong conclusion.",
    paragraphsUa: [
      "Для раннього сигналу ми порівнюємо два повні календарні тижні: 6–12 та 13–19 липня. UONIA — індекс одноденних незабезпечених операцій між банками — у середньому становив 14,979% на другому тижні та 14,974% на третьому. Різниця близько пів сотих відсоткового пункту практично означає стабільність короткої ціни гривні.",
      "Офіційний курс долара в робочі дні змістився з середніх 44,53 до 44,68 грн за долар, приблизно на 0,35%. Це невеликий рух, а не самостійний доказ нового валютного тренду. Для такого висновку потрібні довший горизонт, обсяги інтервенцій, попит клієнтів банків і міжнародні потоки.",
      "Довідковий своп-індекс поводився помітніше, але даних було мало. На другому тижні опубліковано лише одне числове значення — 13,00%; на третьому два — 11,13% і 11,70%. Середні 13,00% та 11,42% виглядають як велика різниця, проте порівняння одного спостереження з двома не є надійною тижневою оцінкою. У статті це позначено як прогалина, а не як падіння ринку.",
      "Облікова ставка залишалася на рівні 15%. Близькість UONIA до ставки НБУ говорить, що короткий міжбанківський ринок працював біля монетарного орієнтира. Це корисний оперативний індикатор, але він описує вартість грошей між банками, а не процентну ставку, яку бачить конкретний позичальник.",
      "Тижневий монітор потрібен не для гучного висновку, а для дисципліни уваги. На цьому відрізку немає різкого сигналу в UONIA; є помірний рух курсу і недостатня щільність своп-даних. Наступна перевірка — чи зберігається валютний рух четвертого тижня і чи з’являється більше своп-угод.",
    ],
    paragraphsEn: [
      "For an early signal, we compare two complete calendar weeks: 6–12 and 13–19 July. UONIA, the index of unsecured overnight interbank transactions, averaged 14.979% in the second week and 14.974% in the third. A difference of about half a hundredth of a percentage point is practical stability in the short price of hryvnia money.",
      "The official dollar rate on working days moved from an average UAH 44.53 to UAH 44.68 per dollar, about 0.35%. This is a small move, not evidence of a new currency trend on its own. A stronger conclusion needs a longer window, intervention volumes, bank-client demand and international flows.",
      "The reference swap index moved more, but the data were sparse. The second week had only one numeric observation, 13.00%; the third had two, 11.13% and 11.70%. Averages of 13.00% and 11.42% look different, but comparing one observation with two is not a reliable weekly estimate. The article labels this as a gap rather than a market fall.",
      "The key policy rate remained 15%. UONIA’s proximity to that rate suggests that the overnight interbank market operated near the monetary-policy anchor. It is a useful high-frequency indicator, but it is not the lending rate paid by a particular household or company.",
      "A weekly monitor exists for disciplined attention, not a dramatic headline. In this window UONIA has no sharp signal; the exchange rate moves moderately and swap data lack density. The next check is whether the currency move persists and whether more swap observations appear.",
    ],
    chart: {
      titleUa: "UONIA, робочі дні 6–17 липня 2026",
      titleEn: "UONIA, working days 6–17 July 2026",
      noteUa: "Тиждень 2: 14,979%; тиждень 3: 14,974%.",
      noteEn: "Week two: 14.979%; week three: 14.974%.",
      unit: "%",
      color: "#76e000",
      view: "line",
      points: [
        ["2026-07-06", 14.9817], ["2026-07-07", 14.9832],
        ["2026-07-08", 14.973], ["2026-07-09", 14.9717],
        ["2026-07-10", 14.9842], ["2026-07-13", 14.9672],
        ["2026-07-14", 14.9659], ["2026-07-15", 14.9678],
        ["2026-07-16", 14.9838], ["2026-07-17", 14.985],
      ].map(([date, value]) => ({ date: String(date), value: Number(value) })),
    },
    figures: [
      { labelUa: "UONIA", labelEn: "UONIA", value: "14.974%", noteUa: "середня тижня 3", noteEn: "week-three average" },
      { labelUa: "USD/UAH", labelEn: "USD/UAH", value: "44.68", noteUa: "+0,35% до тижня 2", noteEn: "+0.35% vs week two" },
      { labelUa: "Облікова ставка", labelEn: "Policy rate", value: "15.0%", noteUa: "без зміни", noteEn: "unchanged" },
    ],
    related: [
      { labelUa: "UONIA: повний набір", labelEn: "UONIA: full dataset", href: "/corner/nbu/dataset/uonia" },
      { labelUa: "Курси валют: повний набір", labelEn: "Exchange rates: full dataset", href: "/corner/nbu/dataset/exchange-rates" },
      { labelUa: "Своп-індекс: повний набір", labelEn: "Swap index: full dataset", href: "/corner/nbu/dataset/swap-index" },
    ],
    sources: [
      { labelUa: "Український індекс UONIA", labelEn: "UONIA index", publisher: "NBU", url: "https://bank.gov.ua/ua/markets/uonia" },
      { labelUa: "Архів рішень щодо ставки", labelEn: "Policy-rate decision archive", publisher: "NBU", url: "https://bank.gov.ua/en/monetary/archive-rish" },
      { labelUa: "Графік монетарних рішень", labelEn: "Monetary decision schedule", publisher: "NBU", url: "https://bank.gov.ua/en/monetary/schedule" },
    ],
  },
  {
    slug: "ukraine-labour-1991-2025",
    number: "PFM-005",
    publishedAt: "2026-07-30",
    periodUa: "Історична серія",
    periodEn: "Historical series",
    titleUa: "Ринок праці 1991–2025: що показує довга крива безробіття і де вона замовкає",
    titleEn: "Labour market 1991–2025: what the long unemployment curve shows, and where it falls silent",
    standfirstUa:
      "Змодельований ряд МОП зростає від 1,9% у 1991 році до піку 11,9% у 1999-му, реагує на кризу 2009 року, війну з 2014-го та COVID-19. Після 2021 року зіставна серія має прогалину.",
    standfirstEn:
      "The ILO-modelled series rises from 1.9% in 1991 to 11.9% in 1999, reacts to the 2009 crisis, the war from 2014 and COVID-19. The comparable series has a gap after 2021.",
    paragraphsUa: [
      "На початку незалежності офіційно виміряне безробіття виглядає низьким: 1,9% у 1991–1992 роках і 2% у 1993–1994-х. Цю цифру не варто читати як здоровий ринок праці. Перехід від планової до ринкової економіки часто проявлявся не лише відкритим звільненням, а скороченим робочим часом, затримками зарплат, неформальною зайнятістю та виходом людей із робочої сили. Світовий банк пізніше описував ринок як депресивний навіть за відносно невисокого безробіття.",
      "З 1995 року крива швидко підіймається: 5,6%, 7,7%, 8,9%, 11,3%, а в 1999 році — 11,9%. Це збігається з найболючішою фазою пострадянської перебудови виробництва, інституцій та торгівлі, а наприкінці десятиліття — з наслідками російської фінансової кризи 1998 року. Дані показують час і масштаб зміни, але не дозволяють приписати її одному уряду, одній реформі чи одній групі людей.",
      "У 2000–2007 роках безробіття знижується з 11,7% до 6,35%. Період швидшого економічного зростання, експорту та відновлення попиту створював більше роботи, хоча Світовий банк застерігав про слабку продуктивність, повільну структурну перебудову й залежність від сировинних галузей. У 2008 році ряд майже не змінюється, але 2009-го підскакує до 8,84% після глобальної фінансової кризи.",
      "До 2013 року показник знову спадає до 7,17%. Після Революції Гідності, незаконної анексії Криму Росією та початку війни на Донбасі у 2014 році він зростає до 9,27% і залишається близько 9% до 2018-го. Це період втрати підприємств і територій, внутрішнього переміщення та переорієнтації торгівлі. Водночас один національний показник приховує великі регіональні й професійні відмінності.",
      "У 2019 році безробіття знизилося до 8,19%, а пандемія повернула його до 9,48% у 2020-му і 9,83% у 2021-му. На цьому довга зіставна лінія Світового банку завершується. Після повномасштабного вторгнення 2022 року традиційне обстеження робочої сили було порушене; оцінки різних установ мають іншу методику і не повинні механічно продовжувати старий ряд.",
      "Отже, історія 1991–2025 у цьому матеріалі має чесну межу: графік фактично показує 1991–2021 роки, а 2022–2025 позначені як період без прямо зіставного спостереження в цьому наборі. Для сучасної оцінки треба додавати вакансії, опитування бізнесу, дані про міграцію, зарплати й окремо модельні прогнози. Прогалина є інформацією про якість вимірювання, а не нулем.",
    ],
    paragraphsEn: [
      "At the start of independence, measured unemployment looks low: 1.9% in 1991–1992 and 2% in 1993–1994. That should not be read as a healthy labour market. The shift from planning to markets appeared not only through open dismissal but also reduced hours, wage arrears, informal work and people leaving the labour force. The World Bank later described a depressed labour market despite relatively low unemployment.",
      "From 1995 the curve rises quickly: 5.6%, 7.7%, 8.9%, 11.3%, then 11.9% in 1999. The timing overlaps with the hardest phase of restructuring production, institutions and trade, and later the effects of the 1998 Russian financial crisis. The data show timing and scale; they cannot assign the movement to one government, reform or social group.",
      "Between 2000 and 2007 unemployment fell from 11.7% to 6.35%. Faster output, exports and demand created more work, while World Bank studies still warned about weak productivity, slow structural change and commodity dependence. The series was nearly flat in 2008, then jumped to 8.84% in 2009 after the global financial crisis.",
      "The rate declined again to 7.17% by 2013. After the Revolution of Dignity, Russia’s illegal annexation of Crimea and the start of the war in Donbas, it rose to 9.27% in 2014 and stayed near 9% through 2018. Enterprises and territory were lost, people were displaced, and trade was redirected. A single national rate nevertheless hides large regional and occupational differences.",
      "Unemployment fell to 8.19% in 2019 before the pandemic lifted it to 9.48% in 2020 and 9.83% in 2021. The comparable World Bank line ends there. The full-scale invasion disrupted the traditional labour-force survey; estimates from other institutions use different methods and should not be spliced mechanically onto the old series.",
      "The honest boundary of a 1991–2025 account is therefore visible: this chart contains comparable observations for 1991–2021 and marks 2022–2025 as a data gap. A current assessment needs vacancies, business surveys, migration, wages and explicitly modelled estimates. Missing data are information about measurement quality, not a zero.",
    ],
    chart: {
      titleUa: "Безробіття, змодельована оцінка МОП, 1991–2021",
      titleEn: "Unemployment, modelled ILO estimate, 1991–2021",
      noteUa: "Частка робочої сили. Після 2021 року цей зіставний ряд не має опублікованих точок.",
      noteEn: "Share of the labour force. This comparable series has no published observations after 2021.",
      unit: "%",
      color: "#ff312e",
      view: "area",
      points: unemployment,
    },
    figures: [
      { labelUa: "Початок ряду", labelEn: "Series start", value: "1.9%", noteUa: "1991", noteEn: "1991" },
      { labelUa: "Історичний пік", labelEn: "Historical peak", value: "11.9%", noteUa: "1999", noteEn: "1999" },
      { labelUa: "Остання точка", labelEn: "Latest point", value: "9.8%", noteUa: "2021; далі прогалина", noteEn: "2021; gap follows" },
    ],
    related: [
      { labelUa: "Повний ряд безробіття", labelEn: "Full unemployment series", href: "/corner/wb/dataset/sl-uem-totl-zs" },
      { labelUa: "Каталог ринку праці ILOSTAT", labelEn: "ILOSTAT labour catalogue", href: "/corner/ilostat" },
    ],
    sources: [
      { labelUa: "Ряд безробіття України", labelEn: "Ukraine unemployment series", publisher: "World Bank", url: "https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS?locations=UA" },
      { labelUa: "Дослідження робочих місць в Україні", labelEn: "Ukraine jobs study", publisher: "World Bank", url: "https://documents.worldbank.org/en/publication/documents-reports/documentdetail/351021468308654708" },
      { labelUa: "Економічний розвиток у 1990-х", labelEn: "Economic developments in the 1990s", publisher: "IMF", url: "https://www.imf.org/en/publications/cr/issues/2016/12/30/ukraine-recent-economic-developments-2425" },
      { labelUa: "Вплив війни на світ праці", labelEn: "War impact on the world of work", publisher: "ILO", url: "https://www.ilo.org/sites/default/files/wcmsp5/groups/public/%40dgreports/%40dcomm/%40publ/documents/briefingnote/wcms_859255.pdf" },
    ],
  },
  {
    slug: "foresight-frames-gate-1",
    number: "PFM-006",
    publishedAt: "2026-09-06",
    periodUa: "Кадр форсайту",
    periodEn: "Foresight frame",
    titleUa: "Gate 1: одна рамка для восьми груп економічних даних",
    titleEn: "Gate 1: one frame for eight groups of economic data",
    standfirstUa: "F1 зводить промисловість, послуги, людей, фінанси, відбудову та інституції на одну GDP-equivalent шкалу 2025–2040.",
    standfirstEn: "F1 brings industry, services, people, finance, reconstruction and institutions onto one GDP-equivalent scale for 2025–2040.",
    paragraphsUa: [
      "Кадр F1 потрібен не для того, щоб замінити офіційні ряди одним індексом. Його роль інша: показати, як вісім груп даних можуть разом формувати спроможність економічної системи. Спільна база 2025 року дорівнює 214,2 млрд доларів у поточній доларовій шкалі. Далі модель розгортає шість траєкторій до 2040 року.",
      "Нижня межа S1 доходить до 271,0 млрд доларів, тоді як S5 — до встановленої верхньої межі 1 трлн доларів. Між ними лежать S2, S3 і S4. Це не п’ять незалежних прогнозів і не обіцянки. Це однакова модельна форма для перевірки різних припущень про безпеку, енергію, працю, капітал, експорт і якість виконання політики.",
      "У 2026 році всі лінії ще близькі до спільної бази: фактичні дані та ранні сигнали мають більшу вагу, ніж далека траєкторія. Після 2030 року відмінності накопичуються. Тому читати кадр варто разом із базовими рядами: виробництвом сталі, реальним ВВП, боргом, робочою силою та зовнішнім фінансуванням. Сам по собі кадр описує простір можливостей, а не доводить, яка з них настане.",
      "Важливо також розрізняти масштаб і причинність. Якщо траєкторія швидше піднімається, це означає, що набір умов у моделі є сприятливішим: наприклад, довше фінансування поєднується з енергетичною стійкістю та кращим доступом до ринків. Це не доводить, що один інструмент сам створить такий результат. Фактичний ряд залишається окремим рівнем перевірки.",
    ],
    paragraphsEn: [
      "The F1 frame is not meant to replace official series with one index. Its role is different: to show how eight groups of data can combine into the capacity of one economic system. The common 2025 base is USD 214.2 billion on a current-dollar scale. The model then expands six trajectories to 2040.",
      "The lower S1 boundary reaches USD 271.0 billion, while S5 reaches a fixed upper boundary of USD 1 trillion. S2, S3 and S4 sit between them. These are not five independent forecasts or promises. They are one model form for testing assumptions about security, energy, labour, capital, exports and policy execution.",
      "In 2026 the lines remain close to the common base: observed data and early signals matter more than a distant trajectory. After 2030 the differences accumulate. Read the frame with the baseline series: steel output, real GDP, debt, labour force and external financing. The frame describes a space of possibilities; it does not prove which one will occur.",
      "Scale and causality also need to be kept separate. A faster-rising trajectory means that the model combines more favourable conditions, such as long-term finance, energy resilience and better market access. It does not prove that one policy instrument will create that result by itself. The observed baseline remains a separate level of verification.",
    ],
    chart: {
      titleUa: "Траєкторія S3: GDP-equivalent шкала, 2025–2040",
      titleEn: "S3 trajectory: GDP-equivalent scale, 2025–2040",
      noteUa: "2025 — спільна база; 2026–2040 — модельний горизонт.",
      noteEn: "2025 is the shared base; 2026–2040 is the model horizon.",
      unit: "млрд дол. США",
      color: "#0057b8",
      view: "line",
      points: [214.2333128, 225.9285382, 238.2622184, 251.2692074, 264.9862618, 279.4521448, 294.7077359, 310.796146, 327.7628395, 345.655763, 364.5254803, 384.4253156, 405.4115042, 427.5433512, 450.8833994, 475.4976058].map((value, index) => ({ date: `${2025 + index}-12-31`, year: 2025 + index, value })),
    },
    figures: [
      { labelUa: "База", labelEn: "Base", value: "214,2", noteUa: "2025 · млрд дол. США", noteEn: "2025 · USD bn" },
      { labelUa: "S3 у 2040", labelEn: "S3 in 2040", value: "475,5", noteUa: "модельна точка", noteEn: "modelled point" },
      { labelUa: "Траєкторій", labelEn: "Trajectories", value: "6", noteUa: "S1–S5 + Expert", noteEn: "S1–S5 + Expert" },
    ],
    related: [
      { labelUa: "Corner 15: кадри", labelEn: "Corner 15: frames", href: "/corner/frames" },
      { labelUa: "Базові ряди", labelEn: "Baseline series", href: "/id/frames-0002" },
    ],
    sources: [
      { labelUa: "Модель F1", labelEn: "F1 model", publisher: "Uconomics 0.1", url: "https://docs.google.com/spreadsheets/d/1ztBQGIJc6Qwc-PvO5ee6WQewZA6MVcJLCWYv1zhePZM/edit#gid=1012" },
      { labelUa: "Базовий реєстр 2021–2026", labelEn: "2021–2026 baseline register", publisher: "Uconomics 0.1", url: "https://docs.google.com/spreadsheets/d/1ztBQGIJc6Qwc-PvO5ee6WQewZA6MVcJLCWYv1zhePZM/edit#gid=1002" },
      { labelUa: "Публічні графіки", labelEn: "Public charts", publisher: "Uconomics 0.1", url: "https://docs.google.com/spreadsheets/d/1ztBQGIJc6Qwc-PvO5ee6WQewZA6MVcJLCWYv1zhePZM/edit#gid=1017" },
    ],
  },
  {
    slug: "foresight-scenarios-gate-2",
    number: "PFM-007",
    publishedAt: "2026-09-06",
    periodUa: "Сценарний конверт",
    periodEn: "Scenario envelope",
    titleUa: "Gate 2: п’ять шляхів відновлення, а не один прогноз",
    titleEn: "Gate 2: five recovery paths, not one forecast",
    standfirstUa: "Сценарний конверт відділяє спостережувану базу від модельних меж і показує, які умови розводять траєкторії після 2026 року.",
    standfirstEn: "The scenario envelope separates the observed baseline from modelled boundaries and shows which conditions pull paths apart after 2026.",
    paragraphsUa: [
      "У Gate 2 сценарій — це не прикрашена назва для одного числа. Кожен шлях має роль, межу і набір сигналів. S1 описує довгий тиск війни та фінансів; S2 — стабілізацію за умови зовнішньої підтримки; S3 — центральну траєкторію нерівномірної відбудови; S4 — виробниче зближення з ЄС; S5 — верхню межу трансформації з цивільним поширенням оборонних технологій.",
      "Розбіжність між шляхами виникає не в базовій точці 2025 року, а через накопичення умов. Безпека впливає на страхування й інвестиції, енергія — на безперервність виробництва, праця — на здатність розширювати випуск, а інституції — на те, чи перетворюються гроші й плани на завершені проєкти. Саме тому однаковий початок не означає однаковий результат.",
      "Користувацька Expert trajectory за замовчуванням повторює S3, але її параметри можна змінювати в конструкторі. Це корисно для перевірки політичних пакетів: читач змінює не результат заднім числом, а прозорі входи моделі. У публічному каталозі всі шість ліній мають однакову шкалу, позначені як модельні після 2025 року і можуть бути перевірені через вихідні дані.",
      "Таким чином, сценарний графік зручний як карта для розмови про вибір. Він показує, які результати стають ближчими за різних комбінацій ризиків і політик, але не підміняє рішення та моніторинг. Коли надходить нове спостереження, його можна зіставити з конвертом і перевірити, чи змінилася відстань між фактом та робочими траєкторіями.",
    ],
    paragraphsEn: [
      "In Gate 2, a scenario is not a decorated label for one number. Each path has a role, a boundary and a set of signals. S1 describes prolonged war and fiscal pressure; S2 stabilisation with external support; S3 an uneven recovery reference path; S4 EU production convergence; and S5 an upper transformation boundary with civilian defence-technology spillovers.",
      "The paths diverge through accumulated conditions, not at the 2025 base. Security affects insurance and investment, energy affects production continuity, labour affects the ability to expand output, and institutions determine whether money and plans become completed projects. The same starting point therefore does not imply the same result.",
      "The Expert trajectory starts by matching S3, but its parameters can be changed in the constructor. This supports policy-package testing: the reader changes transparent inputs rather than rewriting the result. In the public catalogue all six lines use the same scale, are marked modelled after 2025 and can be checked against the source data.",
      "The scenario chart is therefore a map for discussing choices. It shows which outcomes become more plausible under different combinations of risks and policies, but it does not replace decisions or monitoring. When a new observation arrives, it can be compared with the envelope to see whether the distance between evidence and working trajectories has changed.",
    ],
    chart: {
      titleUa: "П’ять сценаріїв і Expert, 2025–2040",
      titleEn: "Five scenarios and Expert, 2025–2040",
      noteUa: "Спільна база 2025 року; усі точки після неї модельні.",
      noteEn: "Shared 2025 base; all points after it are modelled.",
      unit: "млрд дол. США",
      color: "#ff312e",
      view: "line",
      points: [214.2333128, 225.9285382, 238.2622184, 251.2692074, 264.9862618, 279.4521448, 294.7077359, 310.796146, 327.7628395, 345.655763, 364.5254803, 384.4253156, 405.4115042, 427.5433512, 450.8833994, 475.4976058].map((value, index) => ({ date: `${2025 + index}-12-31`, year: 2025 + index, value })),
    },
    figures: [
      { labelUa: "S1 у 2040", labelEn: "S1 in 2040", value: "271,0", noteUa: "нижня межа", noteEn: "lower boundary" },
      { labelUa: "S3 у 2040", labelEn: "S3 in 2040", value: "475,5", noteUa: "центральна траєкторія", noteEn: "reference path" },
      { labelUa: "S5 у 2040", labelEn: "S5 in 2040", value: "1 000", noteUa: "верхня межа", noteEn: "upper boundary" },
    ],
    related: [
      { labelUa: "Corner 16: сценарії", labelEn: "Corner 16: scenarios", href: "/corner/scenarios" },
      { labelUa: "Межі на 2040 рік", labelEn: "2040 boundaries", href: "/id/scen-0002" },
    ],
    sources: [
      { labelUa: "Сценарний контракт", labelEn: "Scenario contract", publisher: "Uconomics 0.1", url: "https://docs.google.com/spreadsheets/d/1ztBQGIJc6Qwc-PvO5ee6WQewZA6MVcJLCWYv1zhePZM/edit#gid=1003" },
      { labelUa: "Публічні графіки", labelEn: "Public charts", publisher: "Uconomics 0.1", url: "https://docs.google.com/spreadsheets/d/1ztBQGIJc6Qwc-PvO5ee6WQewZA6MVcJLCWYv1zhePZM/edit#gid=1017" },
      { labelUa: "Параметри конструктора", labelEn: "Constructor parameters", publisher: "Uconomics 0.1", url: "https://docs.google.com/spreadsheets/d/1ztBQGIJc6Qwc-PvO5ee6WQewZA6MVcJLCWYv1zhePZM/edit#gid=1013" },
    ],
  },
];

export function magazineArticle(slug: string) {
  return magazineArticles.find((article) => article.slug === slug);
}
