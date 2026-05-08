import { Language } from '../types';

export type ShowcaseAuthor = {
  id: string;
  nameMain: string;
  nameAccent: string;
  initial: string;
  bio: string;
  tags: string[];
};

export const AUTHOR_SHOWCASE: Record<Language, ShowcaseAuthor[]> = {
  ru: [
    {
      id: 'mark-twain',
      nameMain: 'Марк',
      nameAccent: 'Твен',
      initial: 'M',
      bio: 'Классик приключенческой и социальной прозы. Для визуальной презентации раздела мы используем образ автора, мгновенно считываемого даже без лишних пояснений.',
      tags: ['классика', 'приключения', 'американская проза', 'editorial mock'],
    },
    {
      id: 'virginia-woolf',
      nameMain: 'Вирджиния',
      nameAccent: 'Вулф',
      initial: 'V',
      bio: 'Икона модернистской литературы и тихой психологической глубины. Этот блок показывает, как могут выглядеть карточки авторов издательства в более премиальной подаче.',
      tags: ['модернизм', 'эссе', 'психология', 'editorial mock'],
    },
    {
      id: 'franz-kafka',
      nameMain: 'Франц',
      nameAccent: 'Кафка',
      initial: 'K',
      bio: 'Лаконичный, узнаваемый, почти архитектурный образ автора. Подходит для витринной секции, где важны имя, тон и ощущение литературного веса.',
      tags: ['экзистенциализм', 'европейская проза', 'канон', 'editorial mock'],
    },
  ],
  en: [
    {
      id: 'mark-twain',
      nameMain: 'Mark',
      nameAccent: 'Twain',
      initial: 'M',
      bio: 'A classic of adventurous and socially observant prose. This showcase uses instantly recognizable authors as a visual stand-in for the future publishing roster.',
      tags: ['classics', 'adventure', 'american prose', 'editorial mock'],
    },
    {
      id: 'virginia-woolf',
      nameMain: 'Virginia',
      nameAccent: 'Woolf',
      initial: 'V',
      bio: 'An icon of literary modernism and psychological nuance. The section is meant to demonstrate how author presentation can feel elegant and editorial rather than generic.',
      tags: ['modernism', 'essay', 'psychology', 'editorial mock'],
    },
    {
      id: 'franz-kafka',
      nameMain: 'Franz',
      nameAccent: 'Kafka',
      initial: 'K',
      bio: 'Spare, unmistakable, almost architectural as an authorial image. Well suited to a premium showcase where name, tone, and literary gravity matter most.',
      tags: ['existentialism', 'european prose', 'canon', 'editorial mock'],
    },
  ],
  de: [
    {
      id: 'mark-twain',
      nameMain: 'Mark',
      nameAccent: 'Twain',
      initial: 'M',
      bio: 'Ein Klassiker der Abenteuer- und Gesellschaftsprosa. Diese Sektion nutzt bekannte Autor:innen als visuelle Platzhalter für die spätere Verlagspräsentation.',
      tags: ['klassik', 'abenteuer', 'amerikanische prosa', 'editorial mock'],
    },
    {
      id: 'virginia-woolf',
      nameMain: 'Virginia',
      nameAccent: 'Woolf',
      initial: 'V',
      bio: 'Eine Ikone der literarischen Moderne und psychologischen Feinzeichnung. Die Gestaltung zeigt, wie elegant eine Autor:innen-Sektion des Verlags wirken kann.',
      tags: ['moderne', 'essay', 'psychologie', 'editorial mock'],
    },
    {
      id: 'franz-kafka',
      nameMain: 'Franz',
      nameAccent: 'Kafka',
      initial: 'K',
      bio: 'Reduziert, unverwechselbar und fast architektonisch in seiner Wirkung. Ideal für eine literarische Vitrine mit Haltung und Gewicht.',
      tags: ['existenzialismus', 'europäische prosa', 'kanon', 'editorial mock'],
    },
  ],
};
