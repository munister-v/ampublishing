import React, { useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Book } from '../types';
import { rotate, useBookRotation } from '../utils/useBookRotation';

/**
 * Главная витрина: веер обложек новинок на тёмно-синем фоне с золотыми лучами.
 *
 * Передняя обложка живая: на широком экране она поворачивается за курсором (3D),
 * по ней скользит блик, а корешок и торец дают объём. Остальные стоят за ней веером.
 * Анимацию ведём через CSS-переменные и requestAnimationFrame, без перерисовок React.
 * При `prefers-reduced-motion` и на экранах без курсора книга просто стоит и слегка
 * «дышит» только вне reduced-motion.
 */

const STYLE = `
.hb-stage{perspective:1500px}
.hb-float{animation:hbFloat 7s ease-in-out infinite}
.hb-float.d1{animation-delay:-2.3s}
.hb-float.d2{animation-delay:-4.6s}
@keyframes hbFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-10px,0)}}
.hb-rays{background:repeating-conic-gradient(from 0deg at 50% 46%,rgba(201,162,90,.10) 0deg 2deg,transparent 2deg 9deg);
  -webkit-mask-image:radial-gradient(circle at 50% 46%,#000 0,#000 28%,transparent 72%);mask-image:radial-gradient(circle at 50% 46%,#000 0,#000 28%,transparent 72%)}
.hb-main{transform:rotateY(var(--ry,-14deg)) rotateX(var(--rx,4deg));transition:transform .5s cubic-bezier(.16,1,.3,1);transform-style:preserve-3d;will-change:transform}
.hb-live .hb-main{transition:transform .08s linear}
.hb-sheen{background:linear-gradient(105deg,transparent calc(var(--sx,30%) - 22%),rgba(255,255,255,.28) var(--sx,30%),transparent calc(var(--sx,30%) + 22%));mix-blend-mode:soft-light;opacity:var(--so,.55);transition:opacity .4s}
@media (prefers-reduced-motion:reduce){.hb-float{animation:none}.hb-main{transition:none}}
`;

interface Props {
  books: Book[];
  label: (book: Book) => string;
}

export const HeroBooks: React.FC<Props> = ({ books, label }) => {
  const stage = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !stage.current) return;
    const el = stage.current, r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.classList.add('hb-live');
      el.style.setProperty('--ry', `${((px - 0.5) * 34).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((0.5 - py) * 18).toFixed(2)}deg`);
      el.style.setProperty('--sx', `${(px * 100).toFixed(0)}%`);
      el.style.setProperty('--so', '.8');
    });
  }, []);

  const onLeave = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    el.classList.remove('hb-live');
    ['--ry', '--rx', '--sx', '--so'].forEach(p => el.style.removeProperty(p));
  }, []);

  // Раз в три минуты веер перетасовывается: на передний план выходит следующая книга.
  const { offset, fading, hold } = useBookRotation(books.length);
  const ordered: Book[] = rotate<Book>(books, offset);
  const [main, ...rest] = ordered;
  const back = rest.slice(0, 2);
  if (!main) return null;

  return (
    <div {...hold} className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_44%,#16305a_0%,#0a1b36_55%,#050e19_100%)]">
      <style>{STYLE}</style>
      <div className="hb-rays absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-3 border border-[#c9a25a]/25 sm:inset-4" aria-hidden />

      <div ref={stage} onPointerMove={onMove} onPointerLeave={onLeave}
        className={`hb-stage absolute inset-0 flex items-center justify-center px-8 pb-24 pt-10 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="relative h-full w-full max-w-[420px]">
          {back.map((b, i) => (
            <Link key={b.id} to={`/product/${b.id}`} aria-label={label(b)}
              className={`absolute top-1/2 block aspect-[2/3] w-[46%] -translate-y-1/2 overflow-hidden shadow-[0_24px_50px_-18px_rgba(0,0,0,.8)] transition-transform duration-500 hover:scale-[1.04] ${i === 0 ? 'left-[-2%] -rotate-[7deg]' : 'right-[-2%] rotate-[7deg]'}`}
              style={{ zIndex: 1 }}>
              <span className={`hb-float block h-full w-full ${i === 0 ? 'd1' : 'd2'}`}>
                <img src={b.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80" />
                <span className="absolute inset-0 bg-[#050e19]/35" />
              </span>
            </Link>
          ))}

          <Link to={`/product/${main.id}`} aria-label={label(main)}
            className="absolute left-1/2 top-1/2 z-10 block aspect-[2/3] w-[54%] sm:w-[58%] lg:w-[62%] -translate-x-1/2 -translate-y-1/2">
            <span className="hb-float block h-full w-full">
              <span className="hb-main relative block h-full w-full">
                <span className="absolute inset-0 translate-x-[7px] translate-y-[7px] bg-[#f4efe4]/85 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]" aria-hidden />
                <span className="absolute inset-0 translate-x-[3px] translate-y-[3px] bg-[#e7dfce]" aria-hidden />
                <span className="absolute inset-0 overflow-hidden bg-[#0a1b36]">
                  <img src={main.coverUrl} alt={label(main)} fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
                  <span className="absolute inset-y-0 left-0 w-[9%] bg-gradient-to-r from-black/45 via-white/10 to-transparent" aria-hidden />
                  <span className="hb-sheen absolute inset-0" aria-hidden />
                </span>
              </span>
            </span>
          </Link>
        </div>
      </div>

      <div className={`absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 px-8 pb-7 pr-16 text-white transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="min-w-0">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[#c9a25a]">
            {main.isPreorder ? 'Pre-order · Предзаказ' : 'New · Новинка'}
          </p>
          <p className="truncate font-serif text-2xl leading-tight">{main.title}</p>
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">{main.author}</p>
        </div>
      </div>
    </div>
  );
};
