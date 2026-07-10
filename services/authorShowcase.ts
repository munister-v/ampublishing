import { Language } from '../types';

export type ShowcaseAuthor = {
  id: string;
  nameMain: string;
  nameAccent: string;
  initial: string;
  years: string;
  knownFor: string;
  bio: string;
  tags: string[];
  imageUrl: string;
};

export type FeaturedAuthor = {
  nameMain: string;
  nameAccent: string;
  label: string;
  intro: string;
  body: string[];
  tags: string[];
};

const isFeaturedAuthor = (value: any): value is FeaturedAuthor =>
  value &&
  typeof value === 'object' &&
  typeof value.nameMain === 'string' &&
  typeof value.nameAccent === 'string' &&
  typeof value.label === 'string' &&
  typeof value.intro === 'string' &&
  Array.isArray(value.body) &&
  Array.isArray(value.tags);

const isShowcaseAuthor = (value: any): value is ShowcaseAuthor =>
  value &&
  typeof value === 'object' &&
  typeof value.id === 'string' &&
  typeof value.nameMain === 'string' &&
  typeof value.nameAccent === 'string' &&
  typeof value.initial === 'string' &&
  typeof value.years === 'string' &&
  typeof value.knownFor === 'string' &&
  typeof value.bio === 'string' &&
  Array.isArray(value.tags) &&
  typeof value.imageUrl === 'string';

export const FEATURED_PUBLISHER_AUTHOR: Record<Language, FeaturedAuthor> = {
  ru: {
    nameMain: 'Сергей',
    nameAccent: 'Калинин',
    label: 'Главный автор каталога',
    intro: 'Прозаик, в чьих текстах психологическая точность соединяется с атмосферной плотностью и медленной внутренней драматургией.',
    body: [
      'Сергей Калинин пишет о людях в переломные моменты: когда привычное рушится, а новое ещё не обрело форму. Его проза внимательна к паузам, к скрытому напряжению, к тому, что остаётся за кадром, но определяет всё остальное.',
      'Именно этот авторский регистр задаёт тон первой книге каталога AM Publishing. В нём есть и внутренняя тишина, и культурная память, и редкое ощущение литературного достоинства без лишней декларативности.',
    ],
    tags: ['психологическая проза', 'современная литература', 'русскоязычный автор', 'AM Publishing'],
  },
  en: {
    nameMain: 'Sergey',
    nameAccent: 'Kalinin',
    label: 'Featured catalog author',
    intro: 'A prose writer whose work combines psychological precision, atmospheric density, and a slow-burning inner dramaturgy.',
    body: [
      'Sergey Kalinin writes about people at turning points, when the familiar collapses and the new has not yet taken shape. His prose is attentive to pauses, hidden tension, and everything that remains just outside the frame while determining what matters most.',
      'This is the register that sets the tone for the first book in the AM Publishing catalog: interior quiet, cultural memory, and a rare sense of literary dignity without excess declaration.',
    ],
    tags: ['psychological prose', 'contemporary literature', 'russian-language author', 'AM Publishing'],
  },
  de: {
    nameMain: 'Sergey',
    nameAccent: 'Kalinin',
    label: 'Prägender Autor des Katalogs',
    intro: 'Ein Prosaautor, dessen Texte psychologische Genauigkeit, atmosphärische Dichte und eine langsame innere Dramaturgie verbinden.',
    body: [
      'Sergey Kalinin schreibt über Menschen in Momenten des Umbruchs, wenn das Gewohnte zerbricht und das Neue noch keine Form gefunden hat. Seine Prosa achtet auf Pausen, auf verborgene Spannung und auf alles, was außerhalb des Bildes bleibt und doch das Wesentliche bestimmt.',
      'Genau dieser Ton prägt das erste Buch im Katalog von AM Publishing: innere Ruhe, kulturelle Erinnerung und ein seltenes Gefühl literarischer Würde ohne überflüssige Deklamation.',
    ],
    tags: ['psychologische prose', 'zeitgenössische literatur', 'russischsprachiger autor', 'AM Publishing'],
  },
};

export const AUTHOR_SHOWCASE: Record<Language, ShowcaseAuthor[]> = {
  ru: [
    {
      id: 'aleksa-dragan',
      nameMain: 'Алекса',
      nameAccent: 'Драган',
      initial: 'А',
      years: 'наши дни',
      knownFor: 'Мистический реализм, малая форма, психологическая проза',
      bio: 'Первая повесть Алексы вышла в «толстом» журнале, вторая — в лонг-листе «Лицея». Её творчество — исследование человеческой души: отношения между людьми, разные зависимости, грань между нормой и патологией. Жанр для Алексы вторичен — она работает в хорроре, научной фантастике, фэнтези, но особенно близки ей мистический реализм, готика и семейная сага.',
      tags: ['мистический реализм', 'готика', 'психологическая проза', 'малая форма'],
      imageUrl: '/images/authors/aleksa-dragan.jpg',
    },
    {
      id: 'sergey-kalinin',
      nameMain: 'Сергей',
      nameAccent: 'Калинин',
      initial: 'С',
      years: 'наши дни',
      knownFor: 'Современная проза о свободе, выборе и мечте',
      bio: 'Родился в Беларуси, в Гомеле. Свою первую книгу Сергей написал двенадцать лет назад — и с тех пор продолжает искать, пробовать, идти дальше. Его тексты — о выборе, свободе, мечте; о том, как непросто бывает научиться жить свою жизнь и как важно не сдаваться. Среди любимых авторов — Довлатов, Булгаков, Лермонтов.',
      tags: ['современная проза', 'психологическая точность', 'русскоязычный автор', 'AM Publishing'],
      imageUrl: '/images/authors/sergey-kalinin.jpg',
    },
    {
      id: 'nadia-hedvig',
      nameMain: 'Надя',
      nameAccent: 'Хедвиг',
      initial: 'Н',
      years: 'наши дни',
      knownFor: 'Филолог, литконсультант, проза о травме и горевании',
      bio: 'Филолог-литературовед, литературный консультант и преподаватель литмастерства. Автор трилогии «Великие Девы» (Чёрным Бело), романа «Темнота в тебе» (шорт-лист «Электронной буквы», 2025; «Стеклограф»), составитель сборника «Трав(мы)». В своём творчестве сосредоточена на изображении психологической травмы, проживания горя и потери, исследует природу насилия и читает об этом лекции.',
      tags: ['психологическая травма', 'современная проза', 'литмастерство', 'женская оптика'],
      imageUrl: '/images/authors/nadia-hedvig.jpg',
    },
    {
      id: 'nikolai-pokusch',
      nameMain: 'Николай',
      nameAccent: 'Покуш',
      initial: 'Н',
      years: 'наши дни',
      knownFor: 'Книга "Серый Дол"',
      bio: 'Работает на производственном предприятии испытателем. Большой фанат видеоигр, настольных игр, но главным своим хобби считает НРИ - настольные ролевые игры. Более двадцати лет ведёт игры как мастер, разработал собственную систему и мир. Пишет с восемнадцати лет; первый рассказ появился после знакомства с Говардом Лавкрафтом. Среди любимых авторов - Анджей Сапковский, Джо Аберкромби и Брендон Сандерсон.',
      tags: ['фэнтези', 'настольные ролевые игры', 'приключенческая проза'],
      imageUrl: 'https://raw.githubusercontent.com/munister-v/ampublishing/main/public/images/uploads/upload-1781434449332.webp',
    },
    {
      id: 'lina-vleschu',
      nameMain: 'Лина',
      nameAccent: 'Влежу',
      initial: 'Л',
      years: 'наши дни',
      knownFor: 'Книга "Вдох. Исповедь провинциальной актрисы"',
      bio: 'Актриса театра по профессии, десять лет работала на сценах театров Советского Союза. В её прозе личный опыт становится материалом для разговора о гармонии между личным счастьем и профессиональным ростом: о жизни актёров, эпохе, закулисье, запретах и противоречиях позднего СССР.',
      tags: ['автофикшн', 'театральная проза', 'женская судьба'],
      imageUrl: 'https://raw.githubusercontent.com/munister-v/ampublishing/main/public/images/uploads/upload-1782205768945.webp',
    },
  ],
  en: [
    {
      id: 'aleksa-dragan',
      nameMain: 'Aleksa',
      nameAccent: 'Dragan',
      initial: 'A',
      years: 'contemporary',
      knownFor: 'Magic realism, short prose, psychological fiction',
      bio: 'Aleksa’s first novella appeared in a leading literary journal; her second was longlisted for the Litsey prize. Her work is an inquiry into the human soul: relationships, addictions of every kind, and the line between norm and pathology. Genre is secondary for her — she writes horror, science fiction and fantasy, but feels closest to magic realism, gothic and the family saga.',
      tags: ['magic realism', 'gothic', 'psychological prose', 'short form'],
      imageUrl: '/images/authors/aleksa-dragan.jpg',
    },
    {
      id: 'sergey-kalinin',
      nameMain: 'Sergey',
      nameAccent: 'Kalinin',
      initial: 'S',
      years: 'contemporary',
      knownFor: 'Contemporary prose on freedom, choice and dreaming',
      bio: 'Born in Gomel, Belarus. Sergey published his first book twelve years ago and has been searching, trying and moving forward ever since. His texts are about choice, freedom, and the dream — about how hard it can be to learn to live your own life and how important it is not to give up. Favourite authors: Dovlatov, Bulgakov, Lermontov.',
      tags: ['contemporary prose', 'psychological precision', 'russian-language author', 'AM Publishing'],
      imageUrl: '/images/authors/sergey-kalinin.jpg',
    },
    {
      id: 'nadia-hedvig',
      nameMain: 'Nadia',
      nameAccent: 'Hedwig',
      initial: 'N',
      years: 'contemporary',
      knownFor: 'Philologist, literary consultant, prose on trauma and grief',
      bio: 'Literary scholar, consultant and teacher of creative writing. Author of the Great Maidens trilogy (Chernym Belo), of the novel Darkness Inside You (Electronic Letter prize shortlist, 2025; Steklograph), and editor of the anthology Tra(uma). Her work centres on the depiction of psychological trauma, grief and loss, and the nature of violence — she also lectures on these subjects.',
      tags: ['psychological trauma', 'contemporary prose', 'creative writing', 'female gaze'],
      imageUrl: '/images/authors/nadia-hedvig.jpg',
    },
    {
      id: 'nikolai-pokusch',
      nameMain: 'Nikolai',
      nameAccent: 'Pokusch',
      initial: 'N',
      years: 'contemporary',
      knownFor: 'Author of Grey Dol',
      bio: 'Nikolai works as a tester at a manufacturing enterprise. He is a devoted fan of video games and board games, but considers tabletop role-playing games his main creative field. For more than twenty years he has been a game master, building his own system and fictional world. He has written since the age of eighteen; his first story followed his encounter with H. P. Lovecraft. Among his favourite authors are Andrzej Sapkowski, Joe Abercrombie and Brandon Sanderson.',
      tags: ['fantasy', 'tabletop role-playing', 'adventure prose'],
      imageUrl: 'https://raw.githubusercontent.com/munister-v/ampublishing/main/public/images/uploads/upload-1781434449332.webp',
    },
    {
      id: 'lina-vleschu',
      nameMain: 'Lina',
      nameAccent: 'Vleschu',
      initial: 'L',
      years: 'contemporary',
      knownFor: 'Author of Inhale. Confession of a Provincial Actress',
      bio: 'Lina is a theatre actress by profession and spent ten years on stages across the Soviet Union. Her prose draws on personal experience to explore the search for harmony between private happiness and professional growth: actors’ lives, an era of contradictions, backstage intrigues, everyday restrictions and the emotional texture of the late Soviet period.',
      tags: ['autofiction', 'theatre prose', 'female fate'],
      imageUrl: 'https://raw.githubusercontent.com/munister-v/ampublishing/main/public/images/uploads/upload-1782205768945.webp',
    },
  ],
  de: [
    {
      id: 'aleksa-dragan',
      nameMain: 'Aleksa',
      nameAccent: 'Dragan',
      initial: 'A',
      years: 'Gegenwart',
      knownFor: 'Magischer Realismus, kurze Prosa, psychologische Literatur',
      bio: 'Aleksas erste Novelle erschien in einer angesehenen Literaturzeitschrift, ihre zweite stand auf der Longlist des Lizei-Preises. Im Zentrum ihres Schreibens steht die Erforschung der menschlichen Seele: Beziehungen, Abhängigkeiten, der Grat zwischen Norm und Pathologie. Genres sind ihr zweitrangig — sie schreibt Horror, Science-Fiction und Fantasy, am nächsten stehen ihr magischer Realismus, Gotik und die Familiensaga.',
      tags: ['magischer realismus', 'gotik', 'psychologische prose', 'kurze form'],
      imageUrl: '/images/authors/aleksa-dragan.jpg',
    },
    {
      id: 'sergey-kalinin',
      nameMain: 'Sergey',
      nameAccent: 'Kalinin',
      initial: 'S',
      years: 'Gegenwart',
      knownFor: 'Zeitgenössische Prosa über Freiheit, Entscheidung und Traum',
      bio: 'Geboren in Gomel, Belarus. Sein erstes Buch veröffentlichte Sergey vor zwölf Jahren — seitdem sucht, probiert und geht er weiter. Seine Texte handeln von Entscheidung, Freiheit und Traum, davon, wie schwer es ist, das eigene Leben zu lernen, und wie wichtig es ist, nicht aufzugeben. Lieblingsautoren: Dowlatow, Bulgakow, Lermontow.',
      tags: ['zeitgenössische prose', 'psychologische präzision', 'russischsprachiger autor', 'AM Publishing'],
      imageUrl: '/images/authors/sergey-kalinin.jpg',
    },
    {
      id: 'nadia-hedvig',
      nameMain: 'Nadia',
      nameAccent: 'Hedwig',
      initial: 'N',
      years: 'Gegenwart',
      knownFor: 'Philologin, Literaturberaterin, Prosa über Trauma und Trauer',
      bio: 'Literaturwissenschaftlerin, Beraterin und Dozentin für literarisches Schreiben. Autorin der Trilogie Große Mädchen (Chernym Belo), des Romans Dunkelheit in dir (Shortlist des Elektronischer-Buchstabe-Preises 2025; Steklograph) und Herausgeberin der Anthologie Tra(uma). Ihre Texte widmen sich der Darstellung psychischer Verletzungen, des Trauerns und Verlustes; sie hält Vorträge über die Natur von Gewalt.',
      tags: ['psychisches trauma', 'zeitgenössische prose', 'kreatives schreiben', 'weiblicher blick'],
      imageUrl: '/images/authors/nadia-hedvig.jpg',
    },
    {
      id: 'nikolai-pokusch',
      nameMain: 'Nikolai',
      nameAccent: 'Pokusch',
      initial: 'N',
      years: 'Gegenwart',
      knownFor: 'Autor von Grauer Dol',
      bio: 'Nikolai arbeitet als Prüfer in einem Produktionsbetrieb. Er ist ein großer Fan von Videospielen und Brettspielen, doch sein wichtigstes kreatives Feld sind Pen-and-Paper-Rollenspiele. Seit mehr als zwanzig Jahren leitet er Spielrunden als Master und hat ein eigenes System sowie eine eigene Welt entwickelt. Er schreibt seit seinem achtzehnten Lebensjahr; seine erste Erzählung entstand nach der Begegnung mit H. P. Lovecraft. Zu seinen Lieblingsautoren zählen Andrzej Sapkowski, Joe Abercrombie und Brandon Sanderson.',
      tags: ['fantasy', 'rollenspiel', 'abenteuerprosa'],
      imageUrl: 'https://raw.githubusercontent.com/munister-v/ampublishing/main/public/images/uploads/upload-1781434449332.webp',
    },
    {
      id: 'lina-vleschu',
      nameMain: 'Lina',
      nameAccent: 'Vleschu',
      initial: 'L',
      years: 'Gegenwart',
      knownFor: 'Autorin von Einatmen. Bekenntnis einer Provinzschauspielerin',
      bio: 'Lina ist ausgebildete Theaterschauspielerin und stand zehn Jahre lang auf Bühnen in der Sowjetunion. Ihre Prosa schöpft aus persönlicher Erfahrung und erzählt von der Suche nach Harmonie zwischen privatem Glück und beruflichem Wachstum: vom Leben der Schauspieler, von einer widersprüchlichen Epoche, von Intrigen hinter den Kulissen, Alltag und Verboten der späten Sowjetzeit.',
      tags: ['autofiktion', 'theaterprosa', 'weibliche biografie'],
      imageUrl: 'https://raw.githubusercontent.com/munister-v/ampublishing/main/public/images/uploads/upload-1782205768945.webp',
    },
  ],
};

export const getFeaturedAuthorContent = (language: Language, override?: unknown): FeaturedAuthor =>
  isFeaturedAuthor(override) ? override : FEATURED_PUBLISHER_AUTHOR[language];

export const getAuthorShowcaseContent = (language: Language, override?: unknown): ShowcaseAuthor[] =>
  Array.isArray(override) && override.every(isShowcaseAuthor) ? override : AUTHOR_SHOWCASE[language];
