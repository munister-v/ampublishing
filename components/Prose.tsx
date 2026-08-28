import React from 'react';

/**
 * Рендер простого тексту в справжню типографіку.
 *
 * Редактори пишуть по-різному: хтось відбиває абзаци порожнім рядком, хтось
 * просто тисне Enter один раз. Раніше тіло новини виводилось одним <div> з
 * whitespace-pre-wrap, тож у другому випадку абзаци злипались в суцільну
 * простирадло без відступів. Тут обидва стилі дають однаковий результат.
 *
 * Додатково розуміються прості маркери на початку рядка:
 *   ##  заголовок      >  цитата      - – — •  пункт списку
 */

type Kind = 'p' | 'h' | 'quote' | 'li';
export type ProseBlock = { kind: Kind; lines: string[] };

const HEADING = /^#{2,3}\s+/;
const QUOTE = /^>\s+/;
const BULLET = /^[-–—•]\s+/;

export function parseProse(raw: string): ProseBlock[] {
  const text = (raw || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];

  // Порожній рядок як роздільник абзаців — лише якщо він у тексті взагалі є.
  // Інакше абзацом вважається кожен рядок.
  const hasBlankLines = /\n[ \t]*\n/.test(text);
  const chunks = hasBlankLines
    ? text.split(/\n[ \t]*\n+/)
    : text.split(/\n+/);

  const blocks: ProseBlock[] = [];
  for (const chunk of chunks) {
    const body = chunk.trim();
    if (!body) continue;

    if (HEADING.test(body)) {
      blocks.push({ kind: 'h', lines: [body.replace(HEADING, '').trim()] });
      continue;
    }
    if (QUOTE.test(body)) {
      blocks.push({ kind: 'quote', lines: [body.split('\n').map(l => l.replace(QUOTE, '').trim()).join(' ')] });
      continue;
    }
    if (BULLET.test(body)) {
      const items = body.split('\n').map(l => l.replace(BULLET, '').trim()).filter(Boolean);
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === 'li') prev.lines.push(...items);
      else blocks.push({ kind: 'li', lines: items });
      continue;
    }
    blocks.push({ kind: 'p', lines: body.split('\n').map(l => l.trim()).filter(Boolean) });
  }
  return blocks;
}

const withBreaks = (lines: string[]) =>
  lines.map((line, i) => (
    <React.Fragment key={i}>
      {i > 0 ? <br /> : null}
      {line}
    </React.Fragment>
  ));

export const Prose: React.FC<{ text?: string | null; className?: string }> = ({ text, className = '' }) => {
  const blocks = React.useMemo(() => parseProse(text || ''), [text]);
  if (!blocks.length) return null;

  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === 'h')
          return (
            <h2 key={i} className="mt-10 mb-4 font-serif text-2xl md:text-3xl leading-snug text-primary first:mt-0">
              {b.lines[0]}
            </h2>
          );
        if (b.kind === 'quote')
          return (
            <blockquote key={i} className="my-8 border-l-2 border-accent pl-5 italic text-primary first:mt-0">
              {b.lines[0]}
            </blockquote>
          );
        if (b.kind === 'li')
          return (
            <ul key={i} className="my-6 list-disc space-y-2 pl-6 marker:text-accent first:mt-0">
              {b.lines.map((li, j) => <li key={j}>{li}</li>)}
            </ul>
          );
        return (
          <p key={i} className="mb-6 last:mb-0">
            {withBreaks(b.lines)}
          </p>
        );
      })}
    </div>
  );
};

export default Prose;
