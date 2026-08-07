
import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ArrowUpRight, Send } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useApp();

  return (
    <footer className="overflow-hidden border-t border-white/20 bg-primary text-white">

      {/* ── Mobile layout (< sm) ─────────────────────────────────────────── */}
      <div className="relative sm:hidden bg-[radial-gradient(circle_at_85%_12%,rgba(201,162,90,0.12),transparent_34%),linear-gradient(180deg,#061422_0%,#071827_100%)]">

        {/* Telegram CTA — mobile */}
        <div className="relative overflow-hidden border-b border-white/10 px-6 py-12">
          <Send size={240} strokeWidth={0.55} aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 rotate-12 text-accent/[0.055]" />
          <div className="relative z-10">
            <p className="mb-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              <span className="inline-block h-px w-7 bg-accent/70" />
              {t('footer.subscribe_label')}
            </p>
            <h3 className="max-w-sm font-serif text-[2rem] leading-[1.05]">
              {t('footer.subscribe_title')}
              <span className="mt-1 block italic text-accent">{t('footer.subscribe_span')}</span>
            </h3>
            <p className="mb-7 mt-6 max-w-sm text-[13px] leading-6 text-white/65">
              {t('footer.subscribe_desc')}
            </p>
            <a
              href="https://t.me/ampublishingberlin"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-13 w-full items-center justify-center gap-3 bg-accent px-5 py-4 text-primary transition-colors duration-200 hover:bg-[#e1bd75] active:bg-[#b9924d]"
            >
              <Send size={16} strokeWidth={1.7} className="flex-shrink-0" aria-hidden />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                {t('footer.submit')}
              </span>
            </a>
          </div>
        </div>

        {/* Copyright strip — mobile */}
        <div className="px-6 pb-7 pt-6 font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
          <a
            href="https://www.instagram.com/am.publishing?igsh=b2JoMDZqdDJzMXdj"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 flex min-h-12 items-center justify-between border border-white/15 px-4 text-[10px] text-white/70 transition-colors hover:border-accent/70 hover:text-accent active:bg-white/5"
          >
            Instagram
            <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden />
          </a>
          <span className="block pb-5 text-center">© 2026 AM Publishing · Berlin</span>
          <div className="grid border-y border-white/10 text-center">
            <Link to="/impressum" className="flex min-h-11 items-center justify-center border-b border-white/10 transition-colors hover:text-white">{t('footer.links.impressum')}</Link>
            <Link to="/privacy" className="flex min-h-11 items-center justify-center border-b border-white/10 transition-colors hover:text-white">{t('footer.links.privacy')}</Link>
            <Link to="/terms" className="flex min-h-11 items-center justify-center transition-colors hover:text-white">{t('footer.links.terms')}</Link>
          </div>
        </div>
      </div>

      {/* ── Desktop layout (≥ sm) ─────────────────────────────────────────── */}
      <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 md:min-h-[360px]">

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
            <li><Link to="/services" className="hover:text-accent transition-all">{t('nav.services')}</Link></li>
            <li><Link to="/tracking" className="hover:text-accent transition-all">{t('tracking.title')}</Link></li>
            <li><Link to="/about" className="hover:text-accent transition-all">{t('nav.about')}</Link></li>
            <li><Link to="/media" className="hover:text-accent transition-all">{t('nav.media')}</Link></li>
          </ul>
        </div>

        {/* 3. TELEGRAM CTA */}
        <div className="sm:col-span-2 relative overflow-hidden bg-gradient-to-br from-[#061426] via-[#0a1f3a] to-[#061426] p-8 md:p-12 flex flex-col justify-center items-start">
          <Send size={420} strokeWidth={0.6} className="pointer-events-none absolute -right-20 -bottom-28 text-accent/[0.045] rotate-12 hidden md:block" />
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
        </div>
      </div>
    </footer>
  );
};
