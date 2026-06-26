
import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Send } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t, isAdmin } = useApp();

  return (
    <footer className="bg-primary text-white border-t border-white/20">

      {/* ── Mobile layout (< sm) ─────────────────────────────────────────── */}
      <div className="sm:hidden">

        {/* Logo + desc */}
        <div className="px-6 pt-10 pb-8 border-b border-white/10">
          <img src="/logo-white.png" alt="AM Publishing" className="w-16 h-16 object-contain mb-5" draggable={false} />
          <p className="font-mono text-xs text-white/50 leading-relaxed mb-6">
            {t('footer.desc')}
          </p>
          <div className="flex gap-6 font-mono text-xs">
            <a href="https://t.me/ampublishingberlin" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-accent transition-colors">Telegram</a>
            <a href="https://www.instagram.com/am.publishing?igsh=b2JoMDZqdDJzMXdj" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-accent transition-colors">Instagram</a>
          </div>
        </div>

        {/* Telegram CTA — mobile */}
        <div className="px-6 py-10 bg-gradient-to-br from-[#061426] to-[#0a1f3a] border-b border-white/10">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-4 flex items-center gap-3">
            <span className="inline-block w-6 h-px bg-accent opacity-70" />
            {t('footer.subscribe_label')}
          </p>
          <h3 className="font-serif text-3xl leading-tight mb-1">
            {t('footer.subscribe_title')}
          </h3>
          <h3 className="font-serif text-3xl italic text-accent leading-tight mb-5">
            {t('footer.subscribe_span')}
          </h3>
          <p className="font-mono text-xs text-white/45 leading-relaxed mb-7">
            {t('footer.subscribe_desc')}
          </p>
          <a
            href="https://t.me/ampublishingberlin"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-3 border border-accent/50 hover:bg-accent hover:border-accent transition-all duration-300 px-6 py-4 w-full"
          >
            <Send size={14} className="text-accent group-hover:text-primary transition-colors flex-shrink-0" />
            <span className="font-mono text-xs uppercase tracking-[0.18em] group-hover:text-primary transition-colors">
              {t('footer.submit')}
            </span>
          </a>
        </div>

        {/* Copyright strip — mobile */}
        <div className="px-6 py-5 flex flex-col gap-3 text-[10px] font-mono uppercase tracking-widest opacity-40">
          <span>© 2026 AM Publishing Berlin</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link to="/impressum" className="hover:opacity-100 transition-opacity">{t('footer.links.impressum')}</Link>
            <Link to="/privacy" className="hover:opacity-100 transition-opacity">{t('footer.links.privacy')}</Link>
            <Link to="/terms" className="hover:opacity-100 transition-opacity">{t('footer.links.terms')}</Link>
            <Link to={isAdmin ? '/admin' : '/login'} className="hover:text-accent hover:opacity-100 transition-opacity opacity-60">{isAdmin ? 'Admin' : 'Admin'}</Link>
          </div>
        </div>
      </div>

      {/* ── Desktop layout (≥ sm) ─────────────────────────────────────────── */}
      <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 md:min-h-[400px]">

        {/* 1. BRAND BLOCK */}
        <div className="p-8 md:p-10 border-b sm:border-b-0 sm:border-r md:border-r border-white/20 flex flex-col justify-between">
          <div>
            <img src="/logo-white.png" alt="AM Publishing" className="w-20 h-20 object-contain mb-5 -ml-1" draggable={false} />
            <p className="font-mono text-xs max-w-[260px] opacity-60 leading-relaxed">
              {t('footer.desc')}
            </p>
          </div>
          <div className="mt-10">
            <span className="block text-[10px] uppercase tracking-widest opacity-40 mb-3">{t('footer.social_index')}</span>
            <div className="flex flex-col gap-2.5 font-mono text-xs">
              <a href="https://t.me/ampublishingberlin" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors opacity-70 hover:opacity-100">Telegram</a>
              <a href="https://www.instagram.com/am.publishing?igsh=b2JoMDZqdDJzMXdj" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors opacity-70 hover:opacity-100">Instagram</a>
            </div>
          </div>
        </div>

        {/* 2. NAV LINKS */}
        <div className="p-8 md:p-10 border-b sm:border-b-0 md:border-r border-white/20">
          <h3 className="font-bold text-[10px] uppercase tracking-widest mb-6 md:mb-8 text-accent">{t('footer.directory')}</h3>
          <ul className="space-y-3 md:space-y-4 font-serif text-xl md:text-2xl">
            <li><Link to="/catalog" className="hover:text-accent transition-all">{t('nav.catalog')}</Link></li>
            <li><Link to="/our-authors" className="hover:text-accent transition-all">{t('nav.our_authors')}</Link></li>
            <li><Link to="/authors" className="hover:text-accent transition-all">{t('nav.authors')}</Link></li>
            <li><Link to="/about" className="hover:text-accent transition-all">{t('nav.about')}</Link></li>
            <li><Link to="/media" className="hover:text-accent transition-all">{t('nav.media')}</Link></li>
          </ul>
        </div>

        {/* 3. TELEGRAM CTA */}
        <div className="sm:col-span-2 relative overflow-hidden bg-gradient-to-br from-[#061426] via-[#0a1f3a] to-[#061426] p-8 md:p-12 flex flex-col justify-center items-start">
          <Send size={520} strokeWidth={0.6} className="pointer-events-none absolute -right-24 -bottom-32 text-accent/[0.05] rotate-12 hidden md:block" />
          <div className="relative z-10 max-w-xl w-full">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-5 flex items-center gap-3">
              <span className="inline-block w-8 h-px bg-accent" />
              {t('footer.subscribe_label')}
            </p>
            <h3 className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-serif leading-[0.95]">
              {t('footer.subscribe_title')}
            </h3>
            <h3 className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-serif italic text-accent leading-[0.95] mt-1">
              {t('footer.subscribe_span')}
            </h3>
            <p className="font-mono text-xs text-white/55 mt-6 md:mt-7 max-w-md leading-relaxed">
              {t('footer.subscribe_desc')}
            </p>
            <a
              href="https://t.me/ampublishingberlin"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-3 mt-7 md:mt-8 border border-accent/50 hover:border-accent hover:bg-accent transition-all duration-300 w-full max-w-sm px-6 py-4"
            >
              <Send size={14} className="text-accent group-hover:text-primary flex-shrink-0 transition-colors" />
              <span className="font-mono text-xs uppercase tracking-[0.18em] group-hover:text-primary transition-colors">
                {t('footer.submit')}
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* COPYRIGHT STRIP — desktop only (mobile has its own above) */}
      <div className="hidden sm:flex border-t border-white/20 px-6 py-3 flex-col sm:flex-row justify-between items-start sm:items-center text-[9px] uppercase tracking-widest font-mono opacity-50 gap-3 sm:gap-0">
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
