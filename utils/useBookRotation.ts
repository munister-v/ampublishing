import { useEffect, useRef, useState } from 'react';

/**
 * Витрина «перетасовывается» раз в несколько минут: книги по кругу меняются
 * местами, чтобы на главном месте побывала каждая. Смена идёт через короткое
 * затухание, а не рывком. Не трогаем витрину, пока над ней курсор или фокус,
 * пока вкладка скрыта и при `prefers-reduced-motion`.
 */
export const useBookRotation = (count: number, intervalMs = 180_000) => {
  const [offset, setOffset] = useState(0);
  const [fading, setFading] = useState(false);
  const paused = useRef(false);

  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let swap = 0;
    const id = window.setInterval(() => {
      if (document.hidden || paused.current) return;
      setFading(true);
      swap = window.setTimeout(() => {
        setOffset(o => (o + 1) % count);
        setFading(false);
      }, 450);
    }, intervalMs);
    return () => { window.clearInterval(id); window.clearTimeout(swap); };
  }, [count, intervalMs]);

  const hold = {
    onPointerEnter: () => { paused.current = true; },
    onPointerLeave: () => { paused.current = false; },
    onFocusCapture: () => { paused.current = true; },
    onBlurCapture: () => { paused.current = false; },
  };

  return { offset, fading, hold };
};

export function rotate<T>(items: T[], offset: number): T[] {
  return items.map((_, i) => items[(i + offset) % items.length]);
}
