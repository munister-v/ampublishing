
import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ArrowUpRight, Instagram, Send } from 'lucide-react';
import { PhoneFrame } from './PhoneFrame';

/* Официальный бейдж Apple (public/app/app-store-badge-white.svg), без изменений.
   Параметры itscg/itsct – метка перехода с сайта в App Store Connect. */
const APP_STORE_URL = 'https://apps.apple.com/us/app/am-publishing/id6820372256?itscg=30200&itsct=apps_box_link&mttnsubad=6820372256';

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
            <p className="mb-5 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-accent">
              <span className="inline-block h-px w-7 bg-accent/70" />
              {t('footer.subscribe_label')}
            </p>
            <h3 className="max-w-sm font-serif text-[2rem] leading-[1.05]">
              {t('footer.subscribe_title')}
              <span className="mt-1 block italic text-accent">{t('footer.subscribe_span')}</span>
            </h3>
            <p className="mb-7 mt-6 max-w-sm text-[15px] leading-7 text-white/80">
              {t('footer.subscribe_desc')}
            </p>
            <a
              href="https://t.me/ampublishingberlin"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-13 w-full items-center justify-center gap-3 bg-accent px-5 py-4 text-primary transition-colors duration-200 hover:bg-[#e1bd75] active:bg-[#b9924d]"
            >
              <Send size={16} strokeWidth={1.7} className="flex-shrink-0" aria-hidden />
              <span className="font-mono text-[13px] uppercase tracking-[0.2em]">
                {t('footer.submit')}
              </span>
            </a>
          </div>
        </div>

        {/* Navigation — mobile (used to be desktop-only) */}
        <nav className="border-b border-white/10 px-6 py-8" aria-label={t('footer.directory')}>
          <img src="/logo-white.svg" alt="AM Publishing" className="mb-7 h-11 w-auto" draggable={false} />
          <ul className="grid grid-cols-2 gap-x-6 font-serif text-xl">
            {([
              ['/catalog', t('nav.catalog')],
              ['/our-authors', t('nav.our_authors')],
              ['/authors', t('nav.authors')],
              ['/services', t('nav.services')],
              ['/about', t('nav.about')],
              ['/media', t('nav.media')],
              ['/radio', t('nav.radio')],
              ['/tracking', t('tracking.title')],
            ] as [string, string][]).map(([to, label]) => (
              <li key={to}>
                <Link to={to} className="flex min-h-11 items-center border-b border-white/[0.07] transition-colors hover:text-accent">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* App Store — mobile */}
        <div className="border-b border-white/10 px-6 py-9">
          <p className="mb-4 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-accent">
            <span className="inline-block h-px w-7 bg-accent/70" />
            {t('footer.app_label')}
          </p>
          <p className="font-serif text-2xl leading-tight">{t('footer.app_title')}</p>
          <p className="mb-6 mt-3 max-w-sm text-[15px] leading-7 text-white/80">{t('footer.app_desc')}</p>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t('footer.app_alt')} className="inline-block leading-none active:opacity-80">
            <img src="/app/app-store-badge-white.svg" alt={t('footer.app_alt')} width={160} height={53} className="h-[53px] w-auto" loading="lazy" />
          </a>
        </div>

        {/* Copyright strip — mobile */}
        <div className="px-6 pb-7 pt-6 font-mono text-[12px] uppercase tracking-[0.16em] text-white/70">
          <a
            href="https://www.instagram.com/am.publishing?igsh=b2JoMDZqdDJzMXdj"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 flex min-h-12 items-center justify-between border border-white/15 px-4 text-[12px] text-white/70 transition-colors hover:border-accent/70 hover:text-accent active:bg-white/5"
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
            <img src="/logo-white.svg" alt="AM Publishing" className="h-14 w-auto mb-6" draggable={false} />
            <p className="font-mono text-[14px] max-w-[300px] opacity-80 leading-relaxed">
              {t('footer.desc')}
            </p>
          </div>
          <div className="mt-10">
            <span className="block text-[12px] uppercase tracking-widest opacity-70 mb-3">{t('footer.social_index')}</span>
            <div className="flex flex-wrap gap-3 font-mono text-[13px] uppercase tracking-[0.12em]">
              <a href="https://t.me/ampublishingberlin" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 rounded-full border border-white/30 px-4 py-2.5 transition-colors hover:border-accent hover:bg-accent hover:text-primary"><Send size={15} strokeWidth={1.8} aria-hidden />Telegram</a>
              <a href="https://www.instagram.com/am.publishing?igsh=b2JoMDZqdDJzMXdj" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 rounded-full border border-white/30 px-4 py-2.5 transition-colors hover:border-accent hover:bg-accent hover:text-primary"><Instagram size={15} strokeWidth={1.8} aria-hidden />Instagram</a>
            </div>
          </div>
        </div>

        {/* 2. NAV LINKS */}
        <div className="p-8 md:p-10 border-b sm:border-b-0 md:border-r border-white/20">
          <h3 className="font-bold text-[12px] uppercase tracking-widest mb-6 md:mb-8 text-accent">{t('footer.directory')}</h3>
          <ul className="space-y-3 md:space-y-3.5 font-serif text-2xl md:text-[1.7rem]">
            <li><Link to="/catalog" className="hover:text-accent transition-all">{t('nav.catalog')}</Link></li>
            <li><Link to="/our-authors" className="hover:text-accent transition-all">{t('nav.our_authors')}</Link></li>
            <li><Link to="/authors" className="hover:text-accent transition-all">{t('nav.authors')}</Link></li>
            <li><Link to="/services" className="hover:text-accent transition-all">{t('nav.services')}</Link></li>
            <li><Link to="/tracking" className="hover:text-accent transition-all">{t('tracking.title')}</Link></li>
            <li><Link to="/about" className="hover:text-accent transition-all">{t('nav.about')}</Link></li>
            <li><Link to="/media" className="hover:text-accent transition-all">{t('nav.media')}</Link></li>
            <li><Link to="/radio" className="hover:text-accent transition-all">{t('nav.radio')}</Link></li>
          </ul>
        </div>

        {/* 3. TELEGRAM CTA */}
        <div className="sm:col-span-2 relative overflow-hidden bg-gradient-to-br from-[#061426] via-[#0a1f3a] to-[#061426] p-8 md:p-12 flex flex-col justify-center items-start">
          <Send size={420} strokeWidth={0.6} className="pointer-events-none absolute -right-20 -bottom-28 text-accent/[0.045] rotate-12 hidden md:block" />
          <div className="relative z-10 max-w-xl w-full">
            <p className="font-mono text-[12px] uppercase tracking-[0.28em] text-accent mb-5 flex items-center gap-3">
              <span className="inline-block w-8 h-px bg-accent" />
              {t('footer.subscribe_label')}
            </p>
            <h3 className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-serif leading-[0.95]">
              {t('footer.subscribe_title')}
            </h3>
            <h3 className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-serif italic text-accent leading-[0.95] mt-1">
              {t('footer.subscribe_span')}
            </h3>
            <p className="font-mono text-[14px] text-white/80 mt-6 md:mt-7 max-w-md leading-relaxed">
              {t('footer.subscribe_desc')}
            </p>
            <a
              href="https://t.me/ampublishingberlin"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-3 mt-7 md:mt-8 border border-accent/50 hover:border-accent hover:bg-accent transition-all duration-300 w-full max-w-sm px-6 py-4"
            >
              <Send size={14} className="text-accent group-hover:text-primary flex-shrink-0 transition-colors" />
              <span className="font-mono text-[13px] uppercase tracking-[0.16em] group-hover:text-primary transition-colors">
                {t('footer.submit')}
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* APP STORE BAND — desktop: the app's home screen peeks in from the bottom edge */}
      <div className="relative hidden overflow-hidden border-t border-white/20 sm:block">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: 'radial-gradient(circle at 88% 100%, rgba(34,66,120,.6) 0%, rgba(4,15,30,0) 55%)' }} />
        <div className="relative flex items-center justify-between gap-8 px-8 py-9 md:px-10">
          <div className="min-w-0">
            <p className="mb-3 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.24em] text-accent">
              <span className="inline-block h-px w-8 bg-accent" />
              {t('footer.app_label')}
            </p>
            <p className="font-serif text-3xl md:text-4xl leading-tight">{t('footer.app_title')}</p>
            <p className="mt-3 max-w-xl font-mono text-[14px] leading-relaxed text-white/80">{t('footer.app_desc')}</p>
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t('footer.app_alt')}
              className="mt-6 inline-block leading-none transition-transform duration-200 hover:-translate-y-0.5">
              <img src="/app/app-store-badge-white.svg" alt={t('footer.app_alt')} width={160} height={53} className="h-[53px] w-auto" loading="lazy" />
            </a>
          </div>
          <div aria-hidden="true" className="relative mr-4 hidden h-[190px] w-[150px] shrink-0 overflow-hidden md:mr-16 md:block">
            <PhoneFrame src="/images/app/home.jpg" className="absolute left-0 top-6 w-[150px]" />
          </div>
        </div>
      </div>

      {/* COPYRIGHT STRIP — desktop only (mobile has its own above) */}
      <div className="hidden sm:flex border-t border-white/20 px-8 py-5 md:px-10 flex-col sm:flex-row sm:flex-wrap justify-between items-start sm:items-center text-[12px] uppercase tracking-widest font-mono opacity-80 gap-3 sm:gap-x-8">
        <span className="whitespace-nowrap">© 2026 AM Publishing Berlin</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link to="/impressum" className="hover:text-white hover:opacity-100 transition-opacity">{t('footer.links.impressum')}</Link>
          <Link to="/privacy" className="hover:text-white hover:opacity-100 transition-opacity">{t('footer.links.privacy')}</Link>
          <Link to="/terms" className="hover:text-white hover:opacity-100 transition-opacity">{t('footer.links.terms')}</Link>
        </div>
      </div>
    </footer>
  );
};
