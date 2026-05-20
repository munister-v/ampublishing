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
  ],
};

export const getAuthorShowcaseContent = (language: Language, override?: unknown): ShowcaseAuthor[] =>
  Array.isArray(override) && override.every(isShowcaseAuthor) ? override : AUTHOR_SHOWCASE[language];
