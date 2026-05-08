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
      id: 'mark-twain',
      nameMain: 'Марк',
      nameAccent: 'Твен',
      initial: 'M',
      years: '1835–1910',
      knownFor: 'Приключенческая проза, сатирический роман, американская классика',
      bio: 'Марк Твен остаётся одним из самых узнаваемых голосов мировой литературы: ироничным, живым, наблюдательным. В визуальной витрине издательства такой автор задаёт нужный масштаб, достоинство и ощущение литературной традиции.',
      tags: ['классика', 'сатирическая проза', 'американский канон', 'литературное наследие'],
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mark_Twain_by_AF_Bradley.jpg',
    },
    {
      id: 'virginia-woolf',
      nameMain: 'Вирджиния',
      nameAccent: 'Вулф',
      initial: 'V',
      years: '1882–1941',
      knownFor: 'Модернистский роман, эссе, психологическая проза',
      bio: 'Вирджиния Вулф ассоциируется с тонкостью внутреннего взгляда, текучей формой и вниманием к сознанию. Её образ помогает показать, как раздел авторов может выглядеть интеллектуально, спокойно и по-настоящему редакционно.',
      tags: ['модернизм', 'эссеистика', 'психологическая глубина', 'интеллектуальная проза'],
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Virginia_Woolf_1927.jpg',
    },
    {
      id: 'franz-kafka',
      nameMain: 'Франц',
      nameAccent: 'Кафка',
      initial: 'K',
      years: '1883–1924',
      knownFor: 'Европейская проза, экзистенциальная литература, короткая форма',
      bio: 'Франц Кафка даёт другому полюсу авторской витрины строгую, почти архитектурную интонацию. Его присутствие в такой подборке подчёркивает серьёзность тона, графичность образа и литературный вес.',
      tags: ['европейский канон', 'экзистенциальная проза', 'лаконичная форма', 'литературный символ'],
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Franz_Kafka,_1923.jpg',
    },
  ],
  en: [
    {
      id: 'mark-twain',
      nameMain: 'Mark',
      nameAccent: 'Twain',
      initial: 'M',
      years: '1835–1910',
      knownFor: 'Adventure fiction, satirical novel, American classics',
      bio: 'Mark Twain remains one of the most recognizable voices in world literature: witty, vivid, and socially observant. In an editorial showcase like this, his image provides scale, dignity, and a sense of literary inheritance.',
      tags: ['classics', 'satirical prose', 'american canon', 'literary heritage'],
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mark_Twain_by_AF_Bradley.jpg',
    },
    {
      id: 'virginia-woolf',
      nameMain: 'Virginia',
      nameAccent: 'Woolf',
      initial: 'V',
      years: '1882–1941',
      knownFor: 'Modernist novel, essays, psychological prose',
      bio: 'Virginia Woolf stands for inward precision, fluid form, and intellectual atmosphere. Her presence helps the section feel literary, calm, and deeply editorial rather than generic.',
      tags: ['modernism', 'essay writing', 'psychological depth', 'intellectual fiction'],
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Virginia_Woolf_1927.jpg',
    },
    {
      id: 'franz-kafka',
      nameMain: 'Franz',
      nameAccent: 'Kafka',
      initial: 'K',
      years: '1883–1924',
      knownFor: 'European prose, existential literature, short form',
      bio: 'Franz Kafka gives the other pole of the showcase a severe, almost architectural tone. His image underlines seriousness, graphic clarity, and literary gravity.',
      tags: ['european canon', 'existential prose', 'compressed form', 'literary symbol'],
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Franz_Kafka,_1923.jpg',
    },
  ],
  de: [
    {
      id: 'mark-twain',
      nameMain: 'Mark',
      nameAccent: 'Twain',
      initial: 'M',
      years: '1835–1910',
      knownFor: 'Abenteuerroman, satirische Prosa, amerikanische Klassik',
      bio: 'Mark Twain bleibt eine der markantesten Stimmen der Weltliteratur: ironisch, lebendig und gesellschaftlich hellwach. In einer solchen Editorial-Vitrine verleiht er dem Auftritt Maßstab, Würde und literarische Herkunft.',
      tags: ['klassik', 'satirische prose', 'amerikanischer kanon', 'literarisches erbe'],
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mark_Twain_by_AF_Bradley.jpg',
    },
    {
      id: 'virginia-woolf',
      nameMain: 'Virginia',
      nameAccent: 'Woolf',
      initial: 'V',
      years: '1882–1941',
      knownFor: 'Moderner Roman, Essayistik, psychologische Prosa',
      bio: 'Virginia Woolf steht für innere Präzision, fließende Form und intellektuelle Atmosphäre. Mit ihr wirkt die Autor:innen-Sektion literarisch, ruhig und deutlich editorial.',
      tags: ['moderne', 'essayistik', 'psychologische tiefe', 'intellektuelle literatur'],
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Virginia_Woolf_1927.jpg',
    },
    {
      id: 'franz-kafka',
      nameMain: 'Franz',
      nameAccent: 'Kafka',
      initial: 'K',
      years: '1883–1924',
      knownFor: 'Europäische Prosa, existenzielle Literatur, kurze Form',
      bio: 'Franz Kafka gibt dem anderen Pol der Vitrine eine strenge, beinahe architektonische Tonlage. Sein Bild betont Ernst, grafische Klarheit und literarisches Gewicht.',
      tags: ['europäischer kanon', 'existenzielle prose', 'verdichtete form', 'literarisches symbol'],
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Franz_Kafka,_1923.jpg',
    },
  ],
};
