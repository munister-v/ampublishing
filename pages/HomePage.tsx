
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Globe } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { useApp } from '../AppContext';
import { AUTHOR_SHOWCASE, FEATURED_PUBLISHER_AUTHOR } from '../services/authorShowcase';

export const HomePage: React.FC = () => {
  const { t, books, news, language, showToast } = useApp();
  const newBooks = books.filter(b => b.badges.includes('new')).slice(0, 4);
  const heroLine2 = t('home.hero_title_2');
  const heroImageUrl = t('home.hero_image') as string;
  const featureImageUrl = t('home.feature_image') as string;
  const authorShowcase = AUTHOR_SHOWCASE[language];
  const featuredAuthor = FEATURED_PUBLISHER_AUTHOR[language];

  // Marquee content repeated to ensure seamless loop
  const marqueeContent = Array(20).fill(t('home.marquee_v'));
  const tickerContent = Array(12).fill(t('home.marquee_h'));

  return (
    <div className="bg-[#F4F4F0] pt-[60px] md:pt-[80px]">
      
      {/* 1. HERO - BRUTAL TYPOGRAPHY */}
      <section className="border-b border-primary relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[85vh]">
           
           {/* Left: Text */}
           <div className="lg:col-span-8 p-6 md:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-primary relative">
              <div className="flex justify-between items-start animate-fade-in gpu-accelerated">
                 <span className="font-mono text-xs uppercase border border-primary px-2 py-1 rounded-none">Est. 2026 Berlin</span>
                 <Star className="text-primary animate-spin-slow" size={40} strokeWidth={1} />
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

              <div className="flex flex-col md:flex-row gap-8 items-end justify-between mt-12 animate-fade-up delay-300 gpu-accelerated">
                 <p className="max-w-xs text-sm font-mono leading-tight">
                    {t('home.hero_subtitle')}
                 </p>
                 <Link to="/catalog" className="bg-primary text-white px-10 py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-accent hover:text-primary transition-colors border border-transparent hover:border-primary duration-500">
                    {t('home.hero_cta')}
                 </Link>
              </div>
           </div>

           {/* Right: Visual */}
           <div className="lg:col-span-4 bg-primary relative group border-l border-primary -ml-[1px] overflow-hidden min-h-[300px] lg:min-h-auto">
              <div className="w-full h-full overflow-hidden">
                <img 
                   src={heroImageUrl}
                   alt="Всё, что останется — обложка книги"
                   className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-[2000ms] ease-out-quart mix-blend-luminosity group-hover:scale-105 gpu-accelerated"
                />
              </div>
              {/* Vertical Marquee */}
              <div className="absolute inset-y-0 right-0 w-12 border-l border-white/20 overflow-hidden flex justify-center py-4 bg-black/20 backdrop-blur-sm">
                 <div className="writing-vertical text-xs font-mono text-white animate-marquee uppercase tracking-widest whitespace-nowrap gpu-accelerated" style={{ height: '200%' }}>
                    {marqueeContent.join('')}
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* 2. TICKER TAPE (Horizontal) */}
      <div className="border-b border-primary bg-accent text-primary py-3 overflow-hidden">
         {/* Container width must be large enough to hold double content for smooth loop */}
         <div className="flex whitespace-nowrap animate-marquee gpu-accelerated w-max">
            {tickerContent.map((text, i) => (
               <span key={i} className="mx-8 text-2xl font-serif italic">
                  {text}
               </span>
            ))}
            {/* Duplicate content visually if needed for perfect loop, but here array is long enough */}
         </div>
      </div>

      {/* 3. CATALOG GRID */}
      <section>
         <div className="grid grid-cols-1 md:grid-cols-12">
            {/* Sidebar Title */}
            <div className="md:col-span-1 border-r border-primary flex items-center justify-center py-12 md:py-0 bg-white">
               <h2 className="md:-rotate-90 text-2xl font-bold uppercase tracking-[0.3em] whitespace-nowrap">
                  {t('home.new_arrivals')}
               </h2>
            </div>

            {/* Products */}
            <div className="md:col-span-11">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b border-primary">
                  {newBooks.map((book) => (
                     <ProductCard key={book.id} book={book} />
                  ))}
               </div>
               <div className="border-b border-primary p-4 flex justify-end">
                  <Link to="/catalog" className="text-xs font-mono uppercase underline hover:text-accent transition-colors duration-300">
                     {t('home.view_all')} &rarr;
                  </Link>
               </div>
            </div>
         </div>
      </section>

      {/* 4. EDITORIAL / CONCEPT */}
      <section className="grid grid-cols-1 md:grid-cols-2 border-b border-primary min-h-[600px]">
         <div className="p-12 md:p-20 flex flex-col justify-center border-b md:border-b-0 md:border-r border-primary bg-[#E8EDF2]">
            <Globe className="mb-12 text-primary animate-spin-slow" size={64} strokeWidth={0.5} />
            <h2 className="text-6xl md:text-8xl font-serif leading-[0.8] mb-8">
               {t('home.global_reach').split(' ')[0]} <br/> {t('home.global_reach').split(' ')[1]}
            </h2>
            <p className="font-mono text-sm max-w-sm mb-12">
               {t('home.global_desc')}
            </p>
            <div className="grid grid-cols-2 gap-px bg-primary border border-primary">
               <div className="bg-[#E8EDF2] p-4 text-center hover:bg-white transition-colors duration-500">
                  <span className="block text-3xl font-bold">{t('home.stats_countries_value')}</span>
                  <span className="text-[9px] uppercase">{t('home.stats_countries')}</span>
               </div>
               <div className="bg-[#E8EDF2] p-4 text-center hover:bg-white transition-colors duration-500">
                  <span className="block text-3xl font-bold">{t('home.stats_delivery_value')}</span>
                  <span className="text-[9px] uppercase">{t('home.stats_delivery')}</span>
               </div>
            </div>
         </div>
         <div className="relative group overflow-hidden">
            <div className="w-full h-full overflow-hidden">
               <img 
                  src={featureImageUrl}
                  alt="Всё, что останется — предметное фото книги"
                  className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform duration-[2000ms] ease-out-quart gpu-accelerated"
               />
            </div>
            <div className="absolute inset-0 bg-primary/20 mix-blend-multiply transition-opacity duration-700 group-hover:opacity-0"></div>
            <div className="absolute bottom-0 left-0 bg-white border-t border-r border-primary p-6 transition-transform duration-700 ease-out-quart group-hover:-translate-y-2">
               <span className="font-mono text-xs block mb-2">{t('home.feature_kicker')}</span>
               <span className="font-serif text-2xl">{t('home.feature_title')}</span>
            </div>
         </div>
      </section>

      {/* 5. JOURNAL LIST */}
      <section className="bg-white">
         {news.map((n, idx) => (
            <div 
               key={n.id} 
               onClick={() => showToast("Access Restricted: Archive 2026", 'info')} 
               className="block group cursor-pointer"
            >
               <div className="border-b border-primary p-8 md:p-12 flex flex-col md:flex-row items-baseline gap-6 hover:bg-primary hover:text-white transition-colors duration-500 ease-out">
                  <span className="font-mono text-xs w-32 shrink-0">0{idx+1} / {n.date}</span>
                  <div className="flex-1">
                     <h3 className="text-4xl md:text-6xl font-serif mb-2 transition-all duration-300">{n.title}</h3>
                  </div>
                  <ArrowRight className="hidden md:block transform group-hover:translate-x-4 transition-transform duration-500 ease-out-quart" />
               </div>
            </div>
         ))}
      </section>

      {/* 6. OUR AUTHORS */}
      <section className="border-t border-primary bg-[#F4F4F0]">
        <div className="border-b border-primary px-6 md:px-10 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-2">{t('home.authors_kicker')}</p>
            <h2 className="text-3xl md:text-5xl font-serif leading-none">{t('home.authors_title')}</h2>
          </div>
          <Link to="/our-authors" className="text-xs font-mono uppercase underline hover:text-accent transition-colors">
            {t('home.authors_cta')}
          </Link>
        </div>

        <div className="px-4 md:px-8 py-10 md:py-16 border-b border-primary">
          <article className="grid grid-cols-1 lg:grid-cols-[300px_1fr] border border-primary bg-[#F7F1E6] overflow-hidden mb-8">
            <div className="bg-primary min-h-[220px] md:min-h-[320px] flex items-center justify-center relative overflow-hidden">
              <span className="text-[6rem] md:text-[9rem] font-serif text-white/10 leading-none">S</span>
            </div>

            <div className="p-8 md:p-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent mb-4">
                {featuredAuthor.label}
              </p>
              <h3 className="text-4xl md:text-6xl font-serif leading-[0.9] text-primary">
                {featuredAuthor.nameMain}
              </h3>
              <p className="text-3xl md:text-5xl font-serif italic text-primary/60 leading-[0.92] mt-2">
                {featuredAuthor.nameAccent}
              </p>
              <p className="mt-6 text-lg md:text-2xl font-serif leading-[1.2] text-primary/80 max-w-4xl">
                {featuredAuthor.intro}
              </p>
            </div>
          </article>

          <div className="space-y-8">
          {authorShowcase.map((item) => (
            <article key={item.id} className="grid grid-cols-1 lg:grid-cols-[340px_1fr] border border-primary bg-[#F7F1E6] overflow-hidden">
              <div className="bg-primary min-h-[260px] md:min-h-[360px] relative overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={`${item.nameMain} ${item.nameAccent}`}
                  className="w-full h-full object-cover grayscale opacity-90"
                />
                <div className="absolute inset-0 bg-primary/35 mix-blend-multiply" />
                <div className="absolute top-4 left-4 border border-white/20 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-white/80">
                  {item.years}
                </div>
                <div className="absolute bottom-4 left-4 text-[6rem] md:text-[8rem] font-serif text-white/10 leading-none">
                  {item.initial}
                </div>
              </div>

              <div className="p-8 md:p-12 lg:p-16">
                <div className="flex items-center gap-4 mb-8">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent whitespace-nowrap">
                    {t('home.authors_kicker')}
                  </p>
                  <div className="h-px flex-1 bg-primary/15" />
                </div>

                <h3 className="text-5xl md:text-7xl font-serif leading-[0.9] text-primary">
                  {item.nameMain}
                </h3>
                <p className="text-4xl md:text-6xl font-serif italic text-primary/60 leading-[0.95] mt-2">
                  {item.nameAccent}
                </p>

                <div className="mt-8 space-y-6 max-w-4xl text-lg md:text-[1.85rem] leading-relaxed text-primary/70">
                  <p className="text-sm md:text-base font-mono uppercase tracking-[0.16em] text-accent">
                    {item.knownFor}
                  </p>
                  <p>{item.bio}</p>
                </div>

                <div className="mt-10 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="border border-primary/15 bg-white/50 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-primary/75">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
          </div>
        </div>
      </section>

    </div>
  );
};
