
import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Send } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t, isAdmin } = useApp();

  return (
    <footer className="bg-primary text-white border-t border-white/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 md:min-h-[400px]">

         {/* 1. BRAND BLOCK */}
         <div className="p-6 md:p-10 border-b sm:border-r md:border-b-0 md:border-r border-white/20 flex flex-col justify-between">
            <div>
               <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif mb-4 md:mb-6 leading-none">AM Publishing</h2>
               <p className="font-mono text-xs max-w-[260px] opacity-60">
                  {t('footer.desc')}
               </p>
            </div>
            <div className="mt-8 md:mt-12">
               <span className="block text-[10px] uppercase tracking-widest opacity-40 mb-2">{t('footer.social_index')}</span>
               <div className="flex flex-col gap-2 font-mono text-xs">
                  <a href="https://t.me/ampublishingberlin" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                     Telegram
                  </a>
                  <a href="https://www.instagram.com/am.publishing?igsh=b2JoMDZqdDJzMXdj" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                     Instagram
                  </a>
               </div>
            </div>
         </div>

         {/* 2. LINKS — hidden on mobile, visible from sm */}
         <div className="hidden sm:block p-6 md:p-10 border-b md:border-b-0 md:border-r border-white/20">
            <h3 className="font-bold text-xs uppercase tracking-widest mb-6 md:mb-8 text-accent">{t('footer.directory')}</h3>
            <ul className="space-y-3 md:space-y-4 font-serif text-xl md:text-2xl">
               <li><Link to="/catalog" className="hover:text-accent transition-all">{t('nav.catalog')}</Link></li>
               <li><Link to="/our-authors" className="hover:text-accent transition-all">{t('nav.our_authors')}</Link></li>
               <li><Link to="/authors" className="hover:text-accent transition-all">{t('nav.authors')}</Link></li>
               <li><Link to="/about" className="hover:text-accent transition-all">{t('nav.about')}</Link></li>
               <li><Link to="/media" className="hover:text-accent transition-all">{t('nav.media')}</Link></li>
            </ul>
         </div>

         {/* 3. TELEGRAM CTA */}
         <div className="col-span-1 sm:col-span-1 md:col-span-2 relative overflow-hidden bg-gradient-to-br from-[#061426] via-[#0a1f3a] to-[#061426] p-8 md:p-12 flex flex-col justify-center items-center sm:items-start">
            {/* Background watermark */}
            <Send
               size={520}
               strokeWidth={0.6}
               className="pointer-events-none absolute -right-24 -bottom-32 text-accent/[0.05] rotate-12 hidden md:block"
            />

            <div className="relative z-10 max-w-xl w-full text-center sm:text-left">
               <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-5 flex items-center gap-3">
                  <span className="inline-block w-8 h-px bg-accent" />
                  {t('footer.subscribe_label')}
               </p>

               <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-serif leading-[0.95]">
                  {t('footer.subscribe_title')}
               </h3>
               <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-serif italic text-accent leading-[0.95] mt-1">
                  {t('footer.subscribe_span')}
               </h3>

               <p className="font-mono text-xs text-white/55 mt-5 md:mt-7 max-w-md leading-relaxed">
                  {t('footer.subscribe_desc')}
               </p>

               <a
                  href="https://t.me/ampublishingberlin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-3 mt-6 md:mt-8 border border-accent/50 hover:border-accent hover:bg-accent transition-all duration-300 w-full max-w-sm mx-auto sm:mx-0 px-6 py-4"
               >
                  <Send size={14} className="text-accent group-hover:text-primary flex-shrink-0 transition-colors" />
                  <span className="font-mono text-xs uppercase tracking-[0.18em] group-hover:text-primary transition-colors">
                     {t('footer.submit')}
                  </span>
               </a>
            </div>
         </div>
      </div>
      
      {/* COPYRIGHT STRIP */}
      <div className="border-t border-white/20 px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[9px] uppercase tracking-widest font-mono opacity-50 gap-3 sm:gap-0">
         <span>© 2026 AM Publishing Berlin</span>
         <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link to="/impressum" className="hover:text-white hover:opacity-100 transition-opacity">{t('footer.links.impressum')}</Link>
            <Link to="/privacy" className="hover:text-white hover:opacity-100 transition-opacity">{t('footer.links.privacy')}</Link>
            <Link to="/terms" className="hover:text-white hover:opacity-100 transition-opacity">{t('footer.links.terms')}</Link>
            <Link to={isAdmin ? '/admin' : '/login'} className="hover:text-accent hover:opacity-100 transition-opacity">{isAdmin ? 'Admin Panel' : 'Admin'}</Link>
         </div>
      </div>
    </footer>
  );
};
