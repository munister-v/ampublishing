import { Book, NewsItem, Region, Language, BookVariant, Order, BookStory, LocalizedCatalogData } from './types';

export const REGIONS: Region[] = [
  { id: 'de', name: 'Германия (Deutschland)', currency: '€' },
  { id: 'eu', name: 'Европейский Союз', currency: '€' },
  { id: 'world', name: 'Весь мир (Other)', currency: '€' },
];

export const FREE_SHIPPING_THRESHOLD = 50;

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

const mkVariant = (
  id: string,
  format: 'paperback' | 'hardcover' | 'digital' | 'special_edition',
  lang: string,
  price: number,
  stock: number,
  isbn: string
): BookVariant => ({
  id,
  format,
  language: lang,
  price,
  stock,
  isbn,
});

const coverUrl = asset('images/ambook-cover.jpg');
const featureImageUrl = asset('images/ambook-object.jpg');
const detailPageUrl = 'https://munister.com.ua/ambook.html';

const baseThemes = [
  {
    title: 'Память как бремя',
    text: 'Прошлое не отпускает - оно меняет форму. Воспоминания искажаются, но никуда не уходят.',
  },
  {
    title: 'Три поколения',
    text: 'Послевоенная провинция, девяностые и сегодняшний день - три эпохи, одна судьба.',
  },
  {
    title: 'Возвращение домой',
    text: 'Что значит вернуться туда, где тебя больше не ждут? Роман не дает удобных ответов.',
  },
  {
    title: 'Молчание как язык',
    text: 'То, о чем не говорят, говорит громче всего. Калинин работает с паузами и пустотами.',
  },
];

const baseReviews = [
  {
    quote: '«Калинин превращает обыденное в невыносимо точное. Я читала и узнавала людей, места, молчание.»',
    author: 'Читательница из Москвы',
  },
  {
    quote: '«Роман держит не сюжетом - он держит воздухом. Той особой атмосферой, от которой не можешь оторваться.»',
    author: 'Читатель из Берлина',
  },
  {
    quote: '«Это книга о том, как больно возвращаться. И как еще больнее не возвращаться.»',
    author: 'Читатель из Тель-Авива',
  },
];

const storyByLanguage: Record<Language, BookStory> = {
  ru: {
    quote: 'Он не знал, зачем вернулся. Только - что иначе было нельзя.',
    quoteSource: 'Из романа, глава III',
    about: [
      'Это история о человеке, который возвращается в город своего детства после долгих лет отсутствия и обнаруживает, что прошлое не исчезло. Оно лишь ждало.',
      'Роман Калинина движется сквозь три временных пласта с редкой уверенностью: послевоенная провинция, распад Советского Союза, наши дни. Память здесь не ностальгия, а улика. Каждая деталь свидетель.',
      '«Всё, что останется» - это книга о том, что мы несем с собой и чего не можем оставить, даже когда очень хотим.',
    ],
    excerpt: [
      'Город встретил его тем же запахом - мокрым асфальтом и чем-то горелым, что всегда висело над промышленным районом по утрам.',
      'Дома стояли на месте. Деревья выросли. Магазин на углу стал аптекой. Но что-то главное исчезло. Или, может быть, это он перестал ему принадлежать.',
      'Переулок Садовый, 14. Дом, в котором он не был двадцать три года.',
    ],
    authorBio: [
      'Сергей Калинин - прозаик, чьи тексты отличает редкое сочетание психологической точности и атмосферной плотности. Он пишет о людях в переломные моменты: когда привычное рушится, а новое еще не обрело форму.',
      'Его проза не торопится - она живет в деталях, в паузах, в том, что остается за кадром. «Всё, что останется» - его первый роман в AM Publishing. Берлин, 2026.',
    ],
    themes: baseThemes,
    reviews: baseReviews,
    orderNote: 'Малый тираж. Твёрдая обложка. Офсетная печать. Доставка в 59 стран мира.',
    featureImageUrl,
    detailPageUrl,
  },
  en: {
    quote: 'He did not know why he had come back. Only that there had been no other way.',
    quoteSource: 'From the novel, Chapter III',
    about: [
      'This is the story of a man who returns to the city of his childhood after many years away and discovers that the past never vanished. It was simply waiting.',
      'Kalinin moves through three time layers with unusual assurance: the post-war province, the collapse of the Soviet Union, and the present day. Memory is not nostalgia here, but evidence. Every detail becomes testimony.',
      'Everything That Will Remain is a novel about what we carry within us and what we cannot leave behind, even when we want to.',
    ],
    excerpt: [
      'The city met him with the same smell - wet asphalt and something burnt - that always hung over the industrial district in the mornings.',
      'The houses were still there. The trees had grown. The corner shop had become a pharmacy. But something essential had disappeared. Or perhaps he was no longer part of it.',
      'Sadovy Lane, 14. The house he had not entered for twenty-three years.',
    ],
    authorBio: [
      'Sergey Kalinin is a prose writer whose work combines psychological precision with a dense, immersive atmosphere. He writes about people at breaking points, when the familiar collapses and the new has not yet taken shape.',
      'His prose is unhurried. It lives in detail, in pauses, in everything that remains just outside the frame. Everything That Will Remain is his first novel with AM Publishing. Berlin, 2026.',
    ],
    themes: [
      { title: 'Memory as burden', text: 'The past never lets go. It changes shape, but it does not disappear.' },
      { title: 'Three generations', text: 'Post-war life, the nineties, and the present intertwine inside one family history.' },
      { title: 'Returning home', text: 'What does it mean to return to a place where no one is waiting for you anymore?' },
      { title: 'Silence as language', text: 'What is never said becomes louder than any confession.' },
    ],
    reviews: [
      { quote: '“Kalinin turns the ordinary into something unbearably precise.”', author: 'Reader from Moscow' },
      { quote: '“The novel holds you not by plot, but by atmosphere.”', author: 'Reader from Berlin' },
      { quote: '“It hurts to return. It hurts even more not to.”', author: 'Reader from Tel Aviv' },
    ],
    orderNote: 'Limited print run. Hardcover edition. Offset printing. Shipping to 59 countries.',
    featureImageUrl,
    detailPageUrl,
  },
  de: {
    quote: 'Er wusste nicht, warum er zurückgekehrt war. Nur, dass es keine andere Möglichkeit gab.',
    quoteSource: 'Aus dem Roman, Kapitel III',
    about: [
      'Dies ist die Geschichte eines Mannes, der nach vielen Jahren in die Stadt seiner Kindheit zurückkehrt und entdeckt, dass die Vergangenheit nie verschwunden ist. Sie hat nur gewartet.',
      'Kalinin bewegt sich mit seltener Sicherheit durch drei Zeitebenen: die Nachkriegsprovinz, den Zerfall der Sowjetunion und die Gegenwart. Erinnerung ist hier keine Nostalgie, sondern Beweismaterial. Jedes Detail legt Zeugnis ab.',
      'Alles, was bleibt, ist ein Roman über das, was wir mit uns tragen und was wir nicht zurücklassen können, selbst wenn wir es wollen.',
    ],
    excerpt: [
      'Die Stadt empfing ihn mit demselben Geruch - nassem Asphalt und etwas Verbranntem -, der morgens immer über dem Industrieviertel hing.',
      'Die Häuser standen noch. Die Bäume waren gewachsen. Der Laden an der Ecke war jetzt eine Apotheke. Doch etwas Wesentliches war verschwunden.',
      'Sadovy-Gasse 14. Das Haus, in dem er seit dreiundzwanzig Jahren nicht mehr gewesen war.',
    ],
    authorBio: [
      'Sergey Kalinin ist ein Prosaautor, dessen Texte psychologische Genauigkeit mit dichter Atmosphäre verbinden. Er schreibt über Menschen in Übergangsmomenten, wenn das Gewohnte zerbricht und das Neue noch keine Form hat.',
      'Seine Prosa eilt nicht. Sie lebt in Details, in Pausen und in dem, was außerhalb des Bildes bleibt. Alles, was bleibt ist sein erster Roman bei AM Publishing. Berlin, 2026.',
    ],
    themes: [
      { title: 'Erinnerung als Last', text: 'Die Vergangenheit lässt nicht los. Sie verändert nur ihre Gestalt.' },
      { title: 'Drei Generationen', text: 'Nachkriegszeit, die Neunziger und die Gegenwart treffen in einer Familiengeschichte aufeinander.' },
      { title: 'Heimkehr', text: 'Was bedeutet es, an einen Ort zurückzukehren, an dem niemand mehr auf dich wartet?' },
      { title: 'Schweigen als Sprache', text: 'Das Ungesagte spricht oft lauter als jedes Geständnis.' },
    ],
    reviews: [
      { quote: '„Kalinin macht das Alltägliche schmerzhaft präzise.“', author: 'Leserin aus Moskau' },
      { quote: '„Der Roman hält dich mit Atmosphäre fest, nicht mit Plot.“', author: 'Leser aus Berlin' },
      { quote: '„Es tut weh zurückzukehren. Noch mehr tut es weh, es nicht zu tun.“', author: 'Leser aus Tel Aviv' },
    ],
    orderNote: 'Kleine Auflage. Hardcover. Offsetdruck. Versand in 59 Länder.',
    featureImageUrl,
    detailPageUrl,
  },
};

const bookByLanguage = (lang: Language): Book => {
  const localizedTitle = lang === 'ru' ? 'Всё, что останется' : lang === 'en' ? 'Everything That Will Remain' : 'Alles, was bleibt';
  const localizedAuthor = lang === 'ru' ? 'Сергей Калинин' : 'Sergey Kalinin';

  return {
    id: 'ambook-001',
    aliases: ['ambook-001-copy'],
    title: localizedTitle,
    author: localizedAuthor,
    price: 24,
    coverUrl,
    badges: ['new'],
    type: 'publisher',
    isPreorder: false,
    stock: 24,
    description:
      lang === 'ru'
        ? 'Роман о возвращении, памяти и том, что прошлое может ждать нас дольше, чем мы готовы признать.'
        : lang === 'en'
          ? 'A novel about return, memory, and the way the past can wait longer than we are willing to admit.'
          : 'Ein Roman über Rückkehr, Erinnerung und darüber, wie lange die Vergangenheit auf uns warten kann.',
    details: {
      pages: 368,
      year: 2026,
      publisher: 'AM Publishing Berlin',
      weight: 'Hardcover',
      dimensions: 'Small print run',
    },
    genre:
      lang === 'ru'
        ? ['Современная проза', 'Психологическая литература']
        : lang === 'en'
          ? ['Contemporary Fiction', 'Psychological Prose']
          : ['Zeitgenössische Prosa', 'Psychologische Literatur'],
    series: 'AM Publishing',
    ageRating: '16+',
    releaseDate: '2026-05-01',
    variants: [
      mkVariant('ambook-001-hc', 'hardcover', lang === 'ru' ? 'Русский' : lang === 'en' ? 'Russian' : 'Russisch', 24, 24, 'AM-BOOK-HC-001'),
      mkVariant('ambook-001-se', 'special_edition', lang === 'ru' ? 'Русский' : lang === 'en' ? 'Russian' : 'Russisch', 39, 8, 'AM-BOOK-GIFT-001'),
      mkVariant('ambook-001-dg', 'digital', lang === 'ru' ? 'Русский' : lang === 'en' ? 'Russian' : 'Russisch', 0, 999, 'AM-BOOK-EXCERPT-001'),
    ],
    story: storyByLanguage[lang],
    purchaseLinks: [
      { id: 'shopify', label: 'Shopify', url: '' },
      { id: 'mnogoknig', label: 'Mnogoknig', url: '' },
      { id: 'mostik', label: 'Mostik.de', url: '' },
    ],
  };
};

const newsByLanguage: Record<Language, NewsItem[]> = {
  ru: [
    {
      id: 'news-1',
      date: '08 Май 2026',
      title: 'Открыт каталог первой книги',
      preview: 'В каталоге AM Publishing появилась первая книга: «Всё, что останется» Сергея Калинина.',
    },
    {
      id: 'news-2',
      date: '03 Май 2026',
      title: 'AM Publishing запускает малый тираж',
      preview: 'Небольшой стартовый тираж и международная доставка в 59 стран мира.',
    },
  ],
  en: [
    {
      id: 'news-1',
      date: 'May 08, 2026',
      title: 'The first book is now in the catalog',
      preview: 'AM Publishing opens its catalog with Sergey Kalinin’s novel Everything That Will Remain.',
    },
    {
      id: 'news-2',
      date: 'May 03, 2026',
      title: 'Limited-print launch announced',
      preview: 'The first AM Publishing edition ships worldwide in a small, carefully produced run.',
    },
  ],
  de: [
    {
      id: 'news-1',
      date: '08. Mai 2026',
      title: 'Das erste Buch ist jetzt im Katalog',
      preview: 'AM Publishing startet den Katalog mit Sergey Kalinins Roman Alles, was bleibt.',
    },
    {
      id: 'news-2',
      date: '03. Mai 2026',
      title: 'Kleine Auflage zum Start',
      preview: 'Die erste Ausgabe erscheint in kleiner Auflage und wird weltweit versendet.',
    },
  ],
};

export const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-2026-9001',
    date: '2026-05-08T09:00:00Z',
    customer: { name: 'Alex Meyer', email: 'alex@example.com', location: 'Berlin, DE' },
    items: [{ variantId: 'ambook-001-hc', bookTitle: 'Всё, что останется', quantity: 1, priceAtPurchase: 24.0 }],
    total: 29.0,
    currency: '€',
    status: 'processing',
    paymentStatus: 'paid',
  },
];

export const DATABASE: Record<Language, LocalizedCatalogData> = {
  ru: {
    genres: ['Современная проза', 'Психологическая литература'],
    authors: ['Сергей Калинин'],
    series: ['AM Publishing'],
    news: newsByLanguage.ru,
    books: [bookByLanguage('ru')],
  },
  en: {
    genres: ['Contemporary Fiction', 'Psychological Prose'],
    authors: ['Sergey Kalinin'],
    series: ['AM Publishing'],
    news: newsByLanguage.en,
    books: [bookByLanguage('en')],
  },
  de: {
    genres: ['Zeitgenössische Prosa', 'Psychologische Literatur'],
    authors: ['Sergey Kalinin'],
    series: ['AM Publishing'],
    news: newsByLanguage.de,
    books: [bookByLanguage('de')],
  },
};
