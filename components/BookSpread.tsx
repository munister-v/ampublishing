import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Отрывок как книжный разворот: две страницы, перелистывание.
 *
 * Почему не «просто две колонки во всю высоту»: на скроллящейся странице это
 * ломает чтение — читатель уходит вниз по левой колонке и должен вернуться
 * наверх к правой. Разворот имеет смысл только вместе с фиксированной высотой,
 * то есть с перелистыванием.
 *
 * Разбивку на страницы не считаем сами: контейнеру заданы `column-fill: auto` и
 * фиксированная высота, и браузер сам льёт текст в колонки, переносит абзацы
 * посередине и уводит лишние колонки вправо за границу видимой области. Нам
 * остаётся сдвигать ленту на ширину разворота. Это надёжнее ручного замера
 * высот: не надо угадывать, где резать абзац, и вёрстка не разъедется, когда
 * подгрузится шрифт или сменится размер окна.
 *
 * Разворот включается только на широком экране. На узком текст остаётся единой
 * лентой — две колонки в 400 px не читаются, а рвать их «под книгу» ради вида
 * было бы ухудшением. До монтирования тоже рендерится лента: так текст лежит в
 * разметке целиком, и поисковику достаётся весь отрывок, а не первый разворот.
 */

const GAP_REM = 5;

export function BookSpread({
  paragraphs,
  footer,
  paragraphClass,
  labels,
}: {
  paragraphs: string[];
  footer: React.ReactNode;
  /** (i) => классы абзаца: у первого буквица, у остальных красная строка. */
  paragraphClass: (i: number) => string;
  labels: { prev: string; next: string; of: string };
}) {
  const [spreadMode, setSpreadMode] = useState(false);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  /** Текст занял нечётное число колонок — последняя правая страница пустая. */
  const [oddTail, setOddTail] = useState(false);

  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setSpreadMode(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    // Дублируем обычным resize: событие `change` у медиазапроса приходит не во
    // всех окружениях, и без этого при смене размера окна режим застревал.
    window.addEventListener('resize', apply);
    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('resize', apply);
    };
  }, []);

  /**
   * Сколько получилось разворотов — узнаём по метке в самом конце текста:
   * её смещение говорит, в какую по счёту колонку её унесло. Считать по
   * scrollWidth ненадёжно — он по-разному ведёт себя с overflow: hidden.
   */
  const measure = useCallback(() => {
    const view = viewRef.current;
    const end = endRef.current;
    const track = trackRef.current;
    if (!view || !end || !track) return;

    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const colStep = (view.clientWidth - gap) / 2 + gap;
    if (colStep <= 0) return;

    const columns = Math.max(1, Math.round(end.offsetLeft / colStep) + 1);
    const total = Math.ceil(columns / 2);

    setPages(total);
    // При нечётном числе колонок последний разворот недокручивается: прокрутка
    // упирается в конец содержимого и показывает слева колонку, которую
    // читатель уже видел справа на предыдущем развороте. Добираем пустой
    // колонкой, чтобы последний разворот вставал ровно на своё место.
    setOddTail(columns % 2 === 1);
    setPage((p) => Math.min(p, total - 1));
  }, []);

  useEffect(() => {
    if (!spreadMode) return;
    measure();

    const ro = new ResizeObserver(measure);
    if (viewRef.current) ro.observe(viewRef.current);
    // Пока грузится Cormorant, текст меряется метрикой запасного шрифта и
    // страниц выходит больше или меньше — пересчитываем, когда шрифт готов.
    document.fonts?.ready.then(measure).catch(() => {});

    return () => ro.disconnect();
  }, [spreadMode, measure, paragraphs]);

  /**
   * Листаем прокруткой самого контейнера — он и так обрезает лишние колонки.
   *
   * Переворот мгновенный, без плавной анимации, и это осознанно: и CSS-переход
   * трансформа, и `scroll-behavior: smooth` — движение, которое может не
   * доехать до конца (в части окружений оно просто не выполняется, и тогда
   * кнопка «Далее» молча ничего не делает). Присвоение scrollLeft срабатывает
   * всегда. Страница в книге и переворачивается сразу.
   */
  useEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!spreadMode || !view || !track) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    view.scrollLeft = page * (view.clientWidth + gap);
  }, [page, pages, spreadMode]);

  const body = paragraphs.map((para, i) => (
    <p key={i} className={paragraphClass(i)}>
      {para}
    </p>
  ));

  if (!spreadMode) {
    return (
      <>
        {body}
        {footer}
      </>
    );
  }

  const turn = (delta: number) => setPage((p) => Math.min(pages - 1, Math.max(0, p + delta)));

  return (
    <>
      <div
        ref={viewRef}
        tabIndex={0}
        role="group"
        aria-roledescription="book spread"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
          if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
        }}
        className="relative overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-accent/40"
        style={{ height: 'min(74vh, 780px)' }}
      >
        <div
          ref={trackRef}
          className="h-full"
          style={{
            columnCount: 2,
            columnGap: `${GAP_REM}rem`,
            columnFill: 'auto',
          }}
        >
          {body}
          {footer}
          {/* Метка конца текста — до добивки, иначе замер поплывёт от неё самой. */}
          <span ref={endRef} aria-hidden className="block h-px" />
          {oddTail && <span aria-hidden className="block h-full" style={{ breakBefore: 'column' }} />}
        </div>

        {/* Корешок: к сгибу бумага уходит в тень, иначе две колонки читаются
            как газета, а не как раскрытая книга. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-24 -translate-x-1/2"
          style={{
            background:
              'linear-gradient(90deg, rgba(4,15,30,0) 0%, rgba(4,15,30,0.05) 45%, rgba(4,15,30,0.09) 50%, rgba(4,15,30,0.05) 55%, rgba(4,15,30,0) 100%)',
          }}
        />
      </div>

      {pages > 1 && (
        <div className="mt-10 flex items-center justify-between border-t border-primary/10 pt-6">
          <button
            type="button"
            onClick={() => turn(-1)}
            disabled={page === 0}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60 transition-colors hover:text-accent disabled:opacity-25 disabled:hover:text-primary/60"
          >
            ← {labels.prev}
          </button>

          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 tabular-nums">
            {page + 1} {labels.of} {pages}
          </span>

          <button
            type="button"
            onClick={() => turn(1)}
            disabled={page >= pages - 1}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60 transition-colors hover:text-accent disabled:opacity-25 disabled:hover:text-primary/60"
          >
            {labels.next} →
          </button>
        </div>
      )}
    </>
  );
}
