
import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Send } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t, isAdmin } = useApp();

  return (
    <footer className="bg-primary text-white border-t border-white/20">
      <div className="grid grid-cols-1 md:grid-cols-4 md:min-h-[400px]">
         
         {/* 1. BRAND BLOCK */}
         <div className="p-6 md:p-10 border-b md:border-b-0 md:border-r border-white/20 flex flex-col justify-between">
            <div>
               <h2 className="text-4xl md:text-6xl font-serif mb-6 leading-none">AM Publishing</h2>
               <p className="font-mono text-xs max-w-[260px] opacity-60">
                  {t('footer.desc')}
               </p>
            </div>
            <div className="mt-12">
               <span className="block text-[10px] uppercase tracking-widest opacity-40 mb-2">{t('footer.social_index')}</span>
               <div className="flex flex-col gap-2 font-mono text-xs">
                  <a href="https://t.me/ampublishingberlin" target="_blank" rel="noopener noreferrer" className="hover:text-accent flex items-center gap-2">
                     <Send size={12} /> Telegram {'->'}
                  </a>
                  <a href="https://www.instagram.com/am.publishing?igsh=b2JoMDZqdDJzMXdj" target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                     Instagram {'->'}
                  </a>
               </div>
            </div>
         </div>

         {/* 2. LINKS */}
         <div className="p-6 md:p-10 border-b md:border-b-0 md:border-r border-white/20">
            <h3 className="font-bold text-xs uppercase tracking-widest mb-8 text-accent">{t('footer.directory')}</h3>
            <ul className="space-y-4 font-serif text-2xl">
               <li><Link to="/catalog" className="hover:text-accent transition-all">{t('nav.catalog')}</Link></li>
               <li><Link to="/our-authors" className="hover:text-accent transition-all">{t('nav.our_authors')}</Link></li>
               <li><Link to="/authors" className="hover:text-accent transition-all">{t('nav.authors')}</Link></li>
               <li><Link to="/about" className="hover:text-accent transition-all">{t('nav.about')}</Link></li>
               <li><Link to="/media" className="hover:text-accent transition-all">{t('nav.media')}</Link></li>
            </ul>
         </div>

         {/* 3. TELEGRAM CTA */}
         <div className="col-span-1 md:col-span-2 p-6 md:p-10 flex flex-col justify-center bg-[#061426]">
            <h3 className="text-3xl md:text-5xl font-serif mb-8 max-w-lg leading-tight">
               {t('footer.subscribe_title')}<br/> <span className="text-accent italic">{t('footer.subscribe_span')}</span>
            </h3>
            <a
               href="https://t.me/ampublishingberlin"
               target="_blank"
               rel="noopener noreferrer"
               className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-6 border-b border-white/40 pb-3 hover:text-accent transition-colors group max-w-lg"
            >
               <span className="text-base md:text-xl font-mono uppercase break-all">{t('footer.subscribe_handle')}</span>
               <span className="uppercase font-bold text-xs tracking-widest whitespace-nowrap inline-flex items-center gap-2 sm:justify-end">
                  {t('footer.submit')} <Send size={12} className="group-hover:translate-x-1 transition-transform" />
               </span>
            </a>
         </div>
      </div>
      
      {/* COPYRIGHT STRIP */}
      <div className="border-t border-white/20 p-4 flex flex-col md:flex-row justify-between items-start md:items-center text-[9px] uppercase tracking-widest font-mono opacity-50 gap-4 md:gap-0">
         <span>© 2026 AM Publishing Berlin</span>
         <div className="flex flex-wrap gap-4">
            <Link to="/impressum" className="hover:text-white hover:opacity-100 transition-opacity">{t('footer.links.impressum')}</Link>
            <Link to="/privacy" className="hover:text-white hover:opacity-100 transition-opacity">{t('footer.links.privacy')}</Link>
            <Link to="/terms" className="hover:text-white hover:opacity-100 transition-opacity">{t('footer.links.terms')}</Link>
            <Link to={isAdmin ? '/admin' : '/login'} className="hover:text-accent hover:opacity-100 transition-opacity">{isAdmin ? 'Admin Panel' : 'Admin'}</Link>
         </div>
      </div>
    </footer>
  );
};
