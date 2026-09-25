
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { EuropeGlyph, DHLBadge } from '../components/BrandGlyphs';
import { useApp } from '../AppContext';
import { formatNewsDate } from '../utils/newsDate';

export const HomePage: React.FC = () => {
  const { t, books, news, language } = useApp();
  const newBooks = books.filter(b => b.badges.includes('new') || b.isPreorder).slice(0, 4);
  const heroLine2 = t('home.hero_title_2');
  const heroImageUrl = t('home.hero_image') as string;
  const featureImageUrl = t('home.feature_image') as string;

  // Плитки региона и партнёра по доставке задаются через переопределения в
  // админке (сейчас RU/EN/DE читают «Европа» и «DHL»). Когда там стоит именно
  // такое значение, вместо жирного текста показываем знак — логотип DHL и
  // глиф Европы. Любое другое значение выводится обычным текстом.
  const countriesValue = String(t('home.stats_countries_value') ?? '').trim();
  const deliveryValue = String(t('home.stats_delivery_value') ?? '').trim();
  const isEuropeTile = /^(европа|europe|europa)$/i.test(countriesValue);
  const isDHLTile = /^dhl$/i.test(deliveryValue);

  // Marquee content repeated to ensure seamless loop
  const marqueeContent = Array(20).fill(t('home.marquee_v'));

  return (
    <div className="bg-[#F4F4F0] pt-[58px] md:pt-[76px]">
      
      {/* 1. HERO - BRUTAL TYPOGRAPHY */}
      <section className="border-b border-primary relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[85vh]">
           
           {/* Left: Text */}
           <div className="lg:col-span-8 px-5 py-8 sm:p-6 md:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-primary relative">
              <div className="flex justify-between items-start animate-fade-in gpu-accelerated">
                 <span className="inline-flex items-center gap-3 border border-primary/15 bg-white/65 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/70 shadow-[0_8px_28px_-20px_rgba(4,15,30,0.45)] backdrop-blur-sm md:text-[11px]">
                   <span aria-hidden className="h-px w-6 bg-accent" />
                   {t('home.established')}
                 </span>
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
                 <p className="max-w-sm text-[13px] md:text-sm font-mono leading-snug text-primary/80">
                    {t('home.hero_subtitle')}
                 </p>
                 <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
                    <Link to="/our-authors" className="min-h-[52px] whitespace-nowrap bg-primary text-white px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-accent hover:text-primary transition-colors border border-primary duration-300 flex items-center justify-center text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                       {t('nav.our_authors')}
                    </Link>
                    <Link
                       to="/about"
                       className="min-h-[52px] whitespace-nowrap bg-transparent text-primary px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-white transition-colors border border-primary duration-300 flex items-center justify-center gap-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                       {t('nav.about')} <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                 </div>
              </div>
           </div>

           {/* Right: Visual */}
           <div className="lg:col-span-4 bg-primary relative group border-l border-primary -ml-[1px] overflow-hidden min-h-[360px] sm:min-h-[440px] lg:min-h-auto">
              {/*
                absolute inset-0, не w-full h-full: внутри CSS grid высота строки
                считается ДО того, как h-full картинки может её унаследовать, поэтому
                при первом проходе браузер берёт "auto"-высоту img, то есть её
                собственное соотношение сторон. У портретных обложек это раздувает
                всю строку сетки далеко за реальную высоту левой колонки. Absolute
                убирает картинку из расчёта intrinsic-размера — высоту строки задаёт
                только текстовая колонка и min-h.
              */}
              <div className="absolute inset-0 overflow-hidden">
                <img
                   src={heroImageUrl}
                   alt="Всё, что останется - обложка книги"
                   fetchPriority="high"
                   decoding="async"
                   className="w-full h-full object-cover opacity-85 saturate-100 transition-transform duration-[1200ms] ease-out-quart group-hover:scale-105 gpu-accelerated"
                />
              </div>
              {/* Vertical Marquee */}
              <div className="absolute inset-y-0 right-0 w-12 border-l border-white/20 overflow-hidden flex justify-center py-4 bg-black/20 backdrop-blur-sm">
                 <div className="writing-vertical text-xs font-mono text-white motion-safe:animate-marquee uppercase tracking-widest whitespace-nowrap gpu-accelerated" style={{ height: '200%' }}>
                    {marqueeContent.join('')}
                 </div>
                 <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/40 to-transparent"></div>
                 <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent"></div>
              </div>
           </div>
        </div>
      </section>

      {/* 2. CATALOG GRID */}
      {newBooks.length > 0 && <section>
         <div className="grid grid-cols-1 md:grid-cols-12">
            {/* Sidebar Title */}
            <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-primary flex items-center justify-between md:justify-center gap-4 px-5 py-6 md:p-0 bg-white">
               <h2 className="md:-rotate-90 text-lg md:text-2xl font-bold uppercase tracking-[0.3em] whitespace-nowrap">
                  {t('home.new_arrivals')}
               </h2>
               <Link to="/catalog" className="md:hidden inline-flex min-h-[44px] items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary/60 hover:text-accent">
                  {t('home.view_all')} <ArrowRight size={13} aria-hidden="true" />
               </Link>
            </div>

            {/* Products */}
            <div className="md:col-span-11">
               {/* Phones: a swipeable row (the next cover peeks in as a hint)
                   instead of four full-screen cards stacked ~3000px tall. */}
               <div className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 border-b border-primary">
                  {newBooks.map((book) => (
                     <div key={book.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
                        <ProductCard book={book} />
                     </div>
                  ))}
               </div>
               <div className="hidden md:flex border-b border-primary justify-end">
                  <Link to="/catalog" className="group inline-flex min-h-[52px] items-center gap-2 border-l border-primary px-6 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-primary hover:text-white transition-colors duration-300">
                     {t('home.view_all')} <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
               </div>
            </div>
         </div>
      </section>}

      {/* 4. EDITORIAL / CONCEPT */}
      <section className="grid grid-cols-1 md:grid-cols-2 border-b border-primary min-h-[600px]">
         <div className="px-5 py-14 sm:p-12 md:p-20 flex flex-col justify-center border-b md:border-b-0 md:border-r border-primary bg-[#E8EDF2]">
            <BookOpen className="mb-8 md:mb-12 text-primary" size={56} strokeWidth={0.5} />
            <h2 className="text-6xl md:text-8xl font-serif leading-[0.85] mb-6 md:mb-8">
               {t('home.global_reach').split(' ')[0]} <br/> {t('home.global_reach').split(' ')[1]}
            </h2>
            <p className="font-mono text-sm max-w-sm mb-10 md:mb-12">
               {t('home.global_desc')}
            </p>
            <div className="grid grid-cols-2 gap-px bg-primary border border-primary">
               <div className="bg-[#E8EDF2] p-4 flex flex-col items-center justify-center gap-1.5 text-center hover:bg-white transition-colors duration-500">
                  {isEuropeTile && <EuropeGlyph className="w-7 h-7 text-primary" />}
                  <span className="block text-3xl font-bold">{countriesValue}</span>
                  <span className="text-[9px] uppercase">{t('home.stats_countries')}</span>
               </div>
               <div className="bg-[#E8EDF2] p-4 flex flex-col items-center justify-center gap-1.5 text-center hover:bg-white transition-colors duration-500">
                  {isDHLTile ? <DHLBadge className="text-2xl" /> : <span className="block text-3xl font-bold">{deliveryValue}</span>}
                  <span className="text-[9px] uppercase">{t('home.stats_delivery')}</span>
               </div>
            </div>
         </div>
         <div className="relative group overflow-hidden min-h-[420px] md:min-h-0">
            {/* absolute inset-0: см. комментарий у hero-картинки выше — то же самое
                исправление. Здесь эффект был заметнее всего: редактор время от
                времени меняет featureImageUrl на обложку другой книги (портретную),
                и при w-full h-full вся секция "Без границ" раздувалась до ~1000px
                вместо 600, оставляя текстовую колонку слева наполовину пустой. */}
            <div className="absolute inset-0 overflow-hidden">
               <img
                  src={featureImageUrl}
                  alt="AM Publishing — предметная фотография книги"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover saturate-100 contrast-110 group-hover:scale-105 transition-transform duration-[1200ms] ease-out-quart gpu-accelerated"
               />
            </div>
            <div className="absolute inset-0 bg-primary/20 mix-blend-multiply transition-opacity duration-700 group-hover:opacity-0"></div>
            <div className="absolute top-16 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-primary px-4 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-transform duration-700 ease-out-quart group-hover:-translate-y-1">
               <Sparkles size={14} className="text-accent shrink-0" strokeWidth={1.5} />
               <span className="font-mono text-xs uppercase tracking-wide whitespace-nowrap">{t('home.feature_kicker')}</span>
            </div>
         </div>
      </section>

      {/* 5. JOURNAL LIST */}
      {news.length > 0 && <section className="bg-white" aria-labelledby="home-news-title">
         <div className="flex items-end justify-between gap-6 border-b border-primary px-5 pb-6 pt-12 md:px-12 md:pt-16">
            <div>
               <p className="mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                  <span aria-hidden className="h-px w-7 bg-accent" />AM Publishing
               </p>
               <h2 id="home-news-title" className="font-serif text-4xl leading-none md:text-6xl">{t('nav.media')}</h2>
            </div>
            <Link to="/media" className="group inline-flex min-h-[44px] shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary/60 hover:text-accent md:text-[11px]">
               {t('home.view_all')} <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
         </div>
         {news.slice(0, 4).map((n, idx) => (
            <Link
               key={n.id}
               to={`/news/${n.id}`}
               className="block group cursor-pointer"
            >
               {/*
                 Раньше строка показывала только огромный заголовок (60px) и дату
                 в том виде, в каком её сохранил редактор — соседние новости шли
                 в разных форматах («2026-07-12» и «May 03, 2026»). Подводка при
                 этом лежала в данных, но не выводилась, и читатель не понимал,
                 о чём новость, пока не откроет её.
               */}
               <div className="border-b border-primary px-5 py-8 md:px-12 md:py-12 flex flex-col md:flex-row md:items-start gap-4 md:gap-10 transition-colors duration-500 ease-out group-hover:bg-primary/[0.03]">
                  <div className="md:w-40 shrink-0 flex items-center gap-3 md:block">
                     <span className="font-mono text-[10px] tabular-nums text-primary/30">{String(idx + 1).padStart(2, '0')}</span>
                     <time
                        dateTime={n.date}
                        className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/50 group-hover:text-accent transition-colors duration-500 md:mt-2 md:block"
                     >
                        {formatNewsDate(n.date, language)}
                     </time>
                  </div>

                  <div className="flex-1 min-w-0">
                     {n.category ? (
                        <span className="inline-block mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                           {n.category}
                        </span>
                     ) : null}
                     <h3 className="font-serif text-[1.75rem] md:text-[2.6rem] leading-[1.12] text-balance transition-transform duration-300 group-hover:translate-x-1">
                        {n.title}
                     </h3>
                     {n.preview ? (
                        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-primary/60 line-clamp-2">
                           {n.preview}
                        </p>
                     ) : null}
                  </div>

                  <ArrowRight className="hidden md:block shrink-0 mt-2 text-primary/30 transform group-hover:translate-x-3 group-hover:text-accent transition-all duration-500 ease-out-quart" />
               </div>
            </Link>
         ))}
      </section>}


    </div>
  );
};
