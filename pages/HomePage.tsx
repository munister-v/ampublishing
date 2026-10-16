import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { DHLBadge } from '../components/BrandGlyphs';
import { EuropeMap } from '../components/EuropeMap';
import { PhoneFrame } from '../components/PhoneFrame';
import { Reveal } from '../components/Reveal';
import { CtaButton } from '../components/CtaButton';
import { FoundedSeal } from '../components/FoundedSeal';
import { useApp } from '../AppContext';
import { formatNewsDate } from '../utils/newsDate';
import { getAuthorShowcaseContent } from '../services/authorShowcase';
import { HeroBooks } from '../components/HeroBooks';
import { rotate, useBookRotation } from '../utils/useBookRotation';

const APP_STORE_URL = 'https://apps.apple.com/us/app/am-publishing/id6820372256?itscg=30200&itsct=apps_box_link&mttnsubad=6820372256';
const DATE_LOCALE: Record<string, string> = { ru: 'ru-RU', en: 'en-GB', de: 'de-DE' };

const APP_SHOTS = ['workshop', 'library', 'events', 'cabinet'];
const APP_STEP_MS = 5200;

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const HomePage: React.FC = () => {
  const { t, books, news, language } = useApp();
  const freshBooks = books.filter(b => b.badges.includes('new') || b.isPreorder).slice(0, 4);
  // Ряд новинок тоже перетасовывается раз в три минуты (см. useBookRotation).
  const shelf = useBookRotation(freshBooks.length);
  const newBooks: typeof freshBooks = rotate(freshBooks, shelf.offset);
  const heroBooks = freshBooks.filter(b => b.coverUrl).slice(0, 3);
  const base = import.meta.env.BASE_URL;

  // Ближайшая премьера: книга с датой выхода не раньше сегодняшнего дня.
  const today = new Date().toISOString().slice(0, 10);
  const premiere = books
    .filter(b => b.releaseDate && b.releaseDate >= today)
    .sort((a, b) => String(a.releaseDate).localeCompare(String(b.releaseDate)))[0];
  const premiereDate = premiere?.releaseDate
    ? new Date(premiere.releaseDate).toLocaleDateString(DATE_LOCALE[language] ?? 'en-GB', { day: 'numeric', month: 'long' })
    : '';

  // Авторы берём из той же витрины, что и страница «Наши авторы»: имя, фото, жанр.
  const showcase = getAuthorShowcaseContent(language, t('static.our_authors.showcase_items')).slice(0, 4);

  const heroLine2 = t('home.hero_title_2');
  const heroImageUrl = t('home.hero_image') as string;

  // Плитки региона и партнёра по доставке задаются через переопределения в
  // админке (сейчас RU/EN/DE читают «Европа» и «DHL»). Когда там стоит именно
  // такое значение, вместо жирного текста показываем знак: логотип DHL.
  const countriesValue = String(t('home.stats_countries_value') ?? '').trim();
  const deliveryValue = String(t('home.stats_delivery_value') ?? '').trim();
  const isDHLTile = /^dhl$/i.test(deliveryValue);

  // Marquee content repeated to ensure seamless loop
  const marqueeContent = Array(20).fill(t('home.marquee_v'));

  // Полоса прогресса прокрутки и параллакс телефонов: обновляем CSS-переменные
  // в requestAnimationFrame, без перерисовок React. При reduced-motion всё стоит на месте.
  const progressRef = useRef<HTMLDivElement>(null);
  const phonesRef = useRef<HTMLDivElement>(null);

  // Блок приложения: четыре возможности по очереди показываются на одном экране
  // телефона. Листается сам, пока над блоком нет курсора и фокуса.
  const [appStep, setAppStep] = useState(0);
  const appHold = useRef(false);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      if (!appHold.current && !document.hidden) setAppStep(i => (i + 1) % APP_SHOTS.length);
    }, APP_STEP_MS);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      progressRef.current?.style.setProperty('--sp', max > 0 ? String(Math.min(1, window.scrollY / max)) : '0');
      const ph = phonesRef.current;
      if (ph) {
        const r = ph.getBoundingClientRect();
        const p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        ph.style.setProperty('--p', Math.max(-1.2, Math.min(1.2, p)).toFixed(3));
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="bg-[#F4F4F0] pt-[58px] md:pt-[76px]">
      {/* Тонкая золотая полоса прогресса под шапкой */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-[58px] z-40 h-[2px] md:top-[76px]">
        <div ref={progressRef} className="h-full origin-left bg-accent will-change-transform" style={{ transform: 'scaleX(var(--sp, 0))' }} />
      </div>

      {/* 1. HERO */}
      <section className="border-b border-primary relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[85vh]">

           {/* Left: Text */}
           <div className="lg:col-span-8 px-5 py-8 sm:p-6 md:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-primary relative">
              <div className="flex justify-between items-start animate-fade-in gpu-accelerated">
                 <FoundedSeal text={t('home.established') as string} className="h-[138px] w-[138px] md:h-[164px] md:w-[164px]" />
              </div>

              <div className="z-10 mt-12 md:mt-0 overflow-hidden">
                <h1 className="text-6xl md:text-8xl lg:text-[8vw] xl:text-[7vw] leading-[0.85] font-serif text-primary uppercase mix-blend-darken break-words hyphens-auto">
                  <div className="animate-fade-up gpu-accelerated">{t('home.hero_title_1')}</div>
                  {heroLine2 ? (
                    <div className="animate-fade-up delay-200 gpu-accelerated">
                      {heroLine2}
                    </div>
                  ) : null}
                </h1>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-stretch md:items-end justify-between mt-10 md:mt-12 animate-fade-up delay-300 gpu-accelerated">
                 <p className="max-w-md text-[15px] md:text-base font-mono leading-snug text-primary/85">
                    {t('home.hero_subtitle')}
                 </p>
                 <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
                    <CtaButton to="/our-authors">{t('nav.our_authors')}</CtaButton>
                    <CtaButton variant="outline" href={APP_STORE_URL}>{t('home.hero_app_cta')}</CtaButton>
                 </div>
              </div>
           </div>

           {/* Right: Visual */}
           <div className="lg:col-span-4 bg-primary relative group border-l border-primary -ml-[1px] overflow-hidden min-h-[500px] sm:min-h-[520px] lg:min-h-auto">
              {/*
                absolute inset-0, не w-full h-full: внутри CSS grid высота строки
                считается ДО того, как h-full картинки может её унаследовать, поэтому
                при первом проходе браузер берёт "auto"-высоту img, то есть её
                собственное соотношение сторон. У портретных обложек это раздувает
                всю строку сетки далеко за реальную высоту левой колонки. Absolute
                убирает картинку из расчёта intrinsic-размера: высоту строки задаёт
                только текстовая колонка и min-h.
              */}
              {heroBooks.length > 0 ? (
                <HeroBooks books={heroBooks} label={(b) => `${b.title} - ${b.author}`} />
              ) : (
              <div className="absolute inset-0 overflow-hidden">
                <img
                   src={heroImageUrl}
                   alt="Всё, что останется - обложка книги"
                   fetchPriority="high"
                   decoding="async"
                   className="w-full h-full object-cover opacity-85 saturate-100 transition-transform duration-[1200ms] ease-out-quart group-hover:scale-105 gpu-accelerated"
                />
              </div>
              )}
              {/* Vertical Marquee */}
              <div className="absolute inset-y-0 right-0 w-12 border-l border-white/20 overflow-hidden flex justify-center py-4 bg-black/20 backdrop-blur-sm">
                 <div className="writing-vertical text-[13px] font-mono text-white motion-safe:animate-marquee uppercase tracking-widest whitespace-nowrap gpu-accelerated" style={{ height: '200%' }}>
                    {marqueeContent.join('')}
                 </div>
                 <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/40 to-transparent"></div>
                 <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent"></div>
              </div>
           </div>
        </div>
      </section>

      {/* Премьера: золотая полоса под первым экраном, ведёт на страницу книги */}
      {premiere && (
        <Link
          to={`/product/${premiere.id}`}
          className="group flex items-center justify-between gap-4 border-b border-primary bg-accent px-5 py-4 text-primary transition-colors duration-300 hover:bg-[#d8b87f] md:px-12"
        >
          <span className="flex min-w-0 items-center gap-3 md:gap-4">
            <Sparkles size={17} strokeWidth={1.6} className="shrink-0" aria-hidden="true" />
            <span className="truncate font-mono text-[12.5px] uppercase tracking-[0.12em] md:text-[13px]">
              <b className="font-bold">{t('home.premiere_label')}</b> «{premiere.title}» · {premiereDate} · {t('home.premiere_open')}
            </span>
          </span>
          <ArrowRight size={17} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      )}

      {/* 2. CATALOG GRID */}
      {newBooks.length > 0 && <section>
         <div className="grid grid-cols-1 md:grid-cols-12">
            {/* Sidebar Title */}
            <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-primary flex items-center justify-between md:justify-center gap-4 px-5 py-6 md:p-0 bg-white">
               <h2 className="md:-rotate-90 text-lg md:text-2xl font-bold uppercase tracking-[0.3em] whitespace-nowrap">
                  {t('home.new_arrivals')}
               </h2>
               <Link to="/catalog" className="md:hidden inline-flex min-h-[44px] items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.14em] text-primary/70 hover:text-accent">
                  {t('home.view_all')} <ArrowRight size={14} aria-hidden="true" />
               </Link>
            </div>

            {/* Products */}
            <div className="md:col-span-11" {...shelf.hold}>
               {/* Phones: a swipeable row (the next cover peeks in as a hint)
                   instead of four full-screen cards stacked ~3000px tall. */}
               <div className={`flex overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 border-b border-primary transition-opacity duration-500 ${shelf.fading ? 'opacity-0' : 'opacity-100'}`}>
                  {newBooks.map((book, i) => (
                     <Reveal key={book.id} delay={i * 90} className="w-[78%] shrink-0 snap-start sm:w-auto">
                        <ProductCard book={book} />
                     </Reveal>
                  ))}
               </div>
               <div className="hidden md:flex border-b border-primary justify-end">
                  <Link to="/catalog" className="group inline-flex min-h-[52px] items-center gap-2 border-l border-primary px-6 font-mono text-[13px] uppercase tracking-[0.14em] hover:bg-primary hover:text-white transition-colors duration-300">
                     {t('home.view_all')} <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
               </div>
            </div>
         </div>
      </section>}

      {/* 3. АВТОРЫ */}
      {showcase.length > 0 && <section className="bg-white border-b border-primary" aria-labelledby="home-authors-title">
         <div className="flex items-end justify-between gap-6 border-b border-primary px-5 pb-6 pt-12 md:px-12 md:pt-16">
            <Reveal>
               <p className="mb-3 font-sans text-[12px] font-bold uppercase tracking-[0.26em] text-accent">{t('home.authors_kicker')}</p>
               <h2 id="home-authors-title" className="font-serif text-5xl leading-none md:text-7xl">{t('home.authors_title')}</h2>
            </Reveal>
            <Link to="/our-authors" className="group inline-flex min-h-[44px] shrink-0 items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-primary/70 hover:text-accent md:text-[13px]">
               {t('home.authors_cta')} <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
         </div>
         <div className="grid grid-cols-2 lg:grid-cols-4">
            {showcase.map((a, i) => {
               const name = `${a.nameMain} ${a.nameAccent}`;
               return (
                  <Reveal key={a.id} delay={i * 80} className={`${i % 2 === 0 ? 'border-r border-primary/15' : ''} ${i < 2 ? 'border-b border-primary/15 lg:border-b-0' : ''} ${i < 3 ? 'lg:border-r lg:border-primary/15' : 'lg:border-r-0'}`}>
                     <Link
                        to="/our-authors"
                        className="group flex h-full flex-col items-center gap-5 px-4 py-10 text-center transition-colors duration-500 hover:bg-primary/[0.03] md:py-14"
                     >
                        {a.imageUrl ? (
                           <img
                              src={a.imageUrl.startsWith('/') ? `${base}${a.imageUrl.slice(1)}` : a.imageUrl}
                              alt={name}
                              loading="lazy"
                              decoding="async"
                              className="h-28 w-28 rounded-full object-cover object-top grayscale transition duration-700 group-hover:grayscale-0 md:h-40 md:w-40"
                           />
                        ) : (
                           <span aria-hidden="true" className="flex h-28 w-28 items-center justify-center rounded-full bg-primary font-serif text-4xl text-accent md:h-40 md:w-40 md:text-5xl">{a.initial}{a.nameAccent[0]}</span>
                        )}
                        <div>
                           <p className="font-serif text-[1.65rem] leading-tight md:text-[2rem]">{name}</p>
                           {a.tags[0] && <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-primary/65 transition-colors group-hover:text-accent">{a.tags[0]}</p>}
                        </div>
                     </Link>
                  </Reveal>
               );
            })}
         </div>
      </section>}

      {/* 4. ПРИЛОЖЕНИЕ: один телефон, четыре возможности по очереди */}
      <section
        className="relative overflow-hidden border-b border-primary bg-primary text-white"
        aria-labelledby="home-app-title"
        onPointerEnter={() => { appHold.current = true; }}
        onPointerLeave={() => { appHold.current = false; }}
        onFocusCapture={() => { appHold.current = true; }}
        onBlurCapture={() => { appHold.current = false; }}
      >
         <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: 'radial-gradient(circle at 76% 50%, rgba(34,66,120,.6) 0%, rgba(10,27,54,0) 60%)' }} />
         <div className="relative grid grid-cols-1 lg:grid-cols-12">
            <Reveal className="lg:col-span-6 px-5 py-14 sm:px-12 md:py-20 lg:pl-12 lg:pr-8 xl:pl-20">
               <p className="mb-5 font-sans text-[12px] font-bold uppercase tracking-[0.26em] text-accent">{t('home.app_kicker')}</p>
               <h2 id="home-app-title" className="font-serif text-5xl leading-[0.95] md:text-7xl text-balance">{t('home.app_title')}</h2>

               <ul className="mt-10 border-t border-white/15">
                  {[1, 2, 3, 4].map((n, i) => {
                     const active = appStep === i;
                     return (
                        <li key={n} className="relative border-b border-white/15">
                           <button type="button" onClick={() => setAppStep(i)} aria-pressed={active} className="flex w-full items-start gap-4 py-5 text-left">
                              <span aria-hidden className={`mt-[7px] h-2 w-2 shrink-0 rounded-full transition-colors duration-500 ${active ? 'bg-accent' : 'bg-white/25'}`} />
                              <span className="min-w-0">
                                 <span className={`block font-mono text-[13px] uppercase tracking-[0.16em] transition-colors duration-500 ${active ? 'text-accent' : 'text-white/70'}`}>{t(`home.app_f${n}_title`)}</span>
                                 <span className={`block overflow-hidden text-[15px] leading-relaxed text-white/80 transition-all duration-500 ${active ? 'mt-2 max-h-28 opacity-100' : 'max-h-0 opacity-0'}`}>{t(`home.app_f${n}_text`)}</span>
                              </span>
                           </button>
                           <span aria-hidden className="pointer-events-none absolute -bottom-px left-0 h-px bg-accent" style={{ width: active ? '100%' : '0%', transition: active && !prefersReducedMotion() ? `width ${APP_STEP_MS}ms linear` : 'none' }} />
                        </li>
                     );
                  })}
               </ul>

               <div className="mt-10 flex justify-center sm:justify-start">
                  <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t('footer.app_alt')} className="inline-block leading-none transition-transform hover:-translate-y-0.5">
                     <img src={`${base}app/app-store-badge-white.svg`} alt={t('footer.app_alt')} width={160} height={53} className="h-[53px] w-auto" loading="lazy" />
                  </a>
               </div>
            </Reveal>

            <div ref={phonesRef} className="relative flex items-center justify-center overflow-hidden px-5 pb-16 pt-4 lg:col-span-6 lg:min-h-[720px] lg:py-16" aria-hidden="true">
               <div className="hb-rays pointer-events-none absolute inset-0 opacity-80" style={{ background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(201,162,90,.10) 0deg 2deg, transparent 2deg 9deg)', WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 0, #000 22%, transparent 66%)', maskImage: 'radial-gradient(circle at 50% 50%, #000 0, #000 22%, transparent 66%)' }} />
               <div className="relative" style={{ transform: 'translate3d(0, calc(var(--p, 0) * -22px), 0)' }}>
                  <PhoneFrame src={`${base}images/app/${APP_SHOTS[0]}.jpg`} className="w-[230px] sm:w-[290px] lg:w-[320px]">
                     {APP_SHOTS.map((shot, i) => (
                        <img
                           key={shot}
                           src={`${base}images/app/${shot}.jpg`}
                           alt=""
                           decoding="async"
                           className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
                           style={{ opacity: appStep === i ? 1 : 0 }}
                        />
                     ))}
                  </PhoneFrame>
                  <div className="rx pointer-events-none absolute -bottom-6 left-[10%] right-[10%] h-6 bg-black/55 blur-xl" style={{ ["--rx" as string]: "50%" }} />
               </div>
            </div>
         </div>
      </section>

      {/* 5. АВТОРАМ */}
      <section className="grid grid-cols-1 border-b border-primary bg-secondary text-white md:grid-cols-12" aria-labelledby="home-manuscript-title">
         <Reveal className="md:col-span-8 px-5 py-14 sm:px-12 md:py-20 xl:pl-20">
            <p className="mb-5 font-sans text-[12px] font-bold uppercase tracking-[0.26em] text-accent">{t('home.manuscript_kicker')}</p>
            <h2 id="home-manuscript-title" className="font-serif text-5xl leading-[1] md:text-7xl text-balance">{t('home.manuscript_title')}</h2>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/75">{t('home.manuscript_text')}</p>
         </Reveal>
         <div className="md:col-span-4 flex items-center px-5 pb-14 sm:px-12 md:pb-0 md:pr-12">
            <CtaButton variant="gold" to="/services">{t('home.manuscript_cta')}</CtaButton>
         </div>
      </section>

      {/* 6. БЕЗ ГРАНИЦ: карта Европы с маршрутами из Берлина */}
      <section className="relative overflow-hidden border-b border-primary bg-primary text-white" aria-labelledby="home-borders-title">
         <div className="grid grid-cols-1 lg:grid-cols-12">
            <Reveal className="relative z-10 flex flex-col justify-center px-5 py-14 sm:px-12 md:py-20 lg:col-span-5 xl:pl-20">
               <p className="mb-5 font-sans text-[12px] font-bold uppercase tracking-[0.26em] text-accent">{t('home.borders_from')}</p>
               <h2 id="home-borders-title" className="font-serif text-6xl leading-[0.88] md:text-8xl">
                  {t('home.global_reach').split(' ')[0]} <br /> {t('home.global_reach').split(' ')[1]}
               </h2>
               <p className="mt-6 max-w-sm text-[17px] leading-relaxed text-white/75">{t('home.global_desc')}</p>

               <div className="mt-10 grid grid-cols-2 gap-px border border-white/15 bg-white/15">
                  <div className="flex flex-col items-center justify-center gap-3 bg-primary px-4 py-6 text-center">
                     <EuropeMap mini label="" className="h-16 w-20" />
                     <span className="block font-serif text-3xl leading-none">{countriesValue}</span>
                     <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-white/65">{t('home.stats_countries')}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-3 bg-primary px-4 py-6 text-center">
                     {isDHLTile ? <DHLBadge className="h-12 w-auto" /> : <span className="block font-serif text-3xl leading-none">{deliveryValue}</span>}
                     <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-white/65">{t('home.stats_delivery')}</span>
                  </div>
               </div>

               <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px] uppercase tracking-[0.12em] text-white/75">
                  <li className="flex items-center gap-2"><span aria-hidden className="h-3 w-3 bg-accent" />{t('home.borders_eu')}</li>
                  <li className="flex items-center gap-2"><span aria-hidden className="h-3 w-3 bg-[#f4e2b0] shadow-[0_0_10px_rgba(244,226,176,.7)]" />{t('home.borders_by')}</li>
                  <li className="flex items-center gap-2"><span aria-hidden className="h-3 w-3 border border-white/30 bg-white/10" />{t('home.borders_other')}</li>
               </ul>
            </Reveal>

            <div className="relative min-h-[440px] sm:min-h-[540px] lg:col-span-7 lg:min-h-[660px]">
               <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: 'radial-gradient(circle at 55% 50%, rgba(34,66,120,.55) 0%, rgba(4,15,30,0) 70%)' }} />
               <EuropeMap label={t('home.map_alt') as string} className="absolute inset-0 h-full w-full scale-[1.14] sm:scale-100 sm:p-8 lg:p-10" />
            </div>
         </div>
      </section>

      {/* 7. НОВОСТИ */}
      {news.length > 0 && <section className="bg-white" aria-labelledby="home-news-title">
         <div className="flex items-end justify-between gap-6 border-b border-primary px-5 pb-6 pt-12 md:px-12 md:pt-16">
            <div>
               <p className="mb-3 font-sans text-[12px] font-bold uppercase tracking-[0.26em] text-accent">AM Publishing</p>
               <h2 id="home-news-title" className="font-serif text-5xl leading-none md:text-7xl">{t('nav.media')}</h2>
            </div>
            <Link to="/media" className="group inline-flex min-h-[44px] shrink-0 items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-primary/70 hover:text-accent md:text-[13px]">
               {t('home.view_all')} <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
         </div>
         {news.slice(0, 3).map((n, idx) => (
            <Reveal key={n.id}>
            <Link
               to={`/news/${n.id}`}
               className="block group cursor-pointer"
            >
               {/*
                 Раньше строка показывала только огромный заголовок (60px) и дату
                 в том виде, в каком её сохранил редактор: соседние новости шли
                 в разных форматах («2026-07-12» и «May 03, 2026»). Подводка при
                 этом лежала в данных, но не выводилась, и читатель не понимал,
                 о чём новость, пока не откроет её.
               */}
               <div className="border-b border-primary px-5 py-8 md:px-12 md:py-12 flex flex-col md:flex-row md:items-start gap-4 md:gap-10 transition-colors duration-500 ease-out group-hover:bg-primary/[0.03]">
                  <div className="md:w-40 shrink-0 flex items-center gap-3 md:block">
                     <span className="font-mono text-[12px] tabular-nums text-primary/40">{String(idx + 1).padStart(2, '0')}</span>
                     <time
                        dateTime={n.date}
                        className="font-mono text-[13px] uppercase tracking-[0.14em] text-primary/65 group-hover:text-accent transition-colors duration-500 md:mt-2 md:block"
                     >
                        {formatNewsDate(n.date, language)}
                     </time>
                  </div>

                  <div className="flex-1 min-w-0">
                     {n.category ? (
                        <span className="inline-block mb-3 font-mono text-[12px] uppercase tracking-[0.18em] text-accent">
                           {n.category}
                        </span>
                     ) : null}
                     <h3 className="font-serif text-[1.75rem] md:text-[2.6rem] leading-[1.12] text-balance transition-transform duration-300 group-hover:translate-x-1">
                        {n.title}
                     </h3>
                     {n.preview ? (
                        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-primary/70 line-clamp-2">
                           {n.preview}
                        </p>
                     ) : null}
                  </div>

                  <ArrowRight className="hidden md:block shrink-0 mt-2 text-primary/30 transform group-hover:translate-x-3 group-hover:text-accent transition-all duration-500 ease-out-quart" />
               </div>
            </Link>
            </Reveal>
         ))}
      </section>}

    </div>
  );
};
