import React, { useLayoutEffect, useRef } from 'react';

/**
 * Плавное появление при прокрутке. Блок виден по умолчанию (без JS и на сервере),
 * а скрывается только если в момент монтирования он ниже экрана; тогда он
 * выплывает, когда доходит до зоны видимости. При `prefers-reduced-motion`
 * ничего не скрываем и не двигаем.
 */
export const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number; y?: number }> = ({ children, className, delay = 0, y = 28 }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    el.style.opacity = '0';
    el.style.transform = `translate3d(0,${y}px,0)`;
    el.style.transition = `opacity .9s cubic-bezier(.16,1,.3,1) ${delay}ms, transform .9s cubic-bezier(.16,1,.3,1) ${delay}ms`;
    el.style.willChange = 'opacity, transform';

    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      el.style.opacity = '1';
      el.style.transform = 'translate3d(0,0,0)';
      const done = window.setTimeout(() => { el.style.willChange = ''; }, 1200 + delay);
      io.disconnect();
      return () => window.clearTimeout(done);
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [delay, y]);

  return <div ref={ref} className={className}>{children}</div>;
};
