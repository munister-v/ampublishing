import React, { useEffect, useState } from 'react';
import { Truck, ArrowRight, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { buildDhlTrackingUrl } from '../utils/dhl';
import { analytics } from '../services/analytics';

/**
 * Публичная страница отслеживания: покупатель вводит номер посылки
 * (или приходит по ссылке /tracking?code=…) и попадает на страницу DHL.
 * Своего API отслеживания у статического сайта нет — и не нужно.
 */
export const TrackingPage: React.FC = () => {
  const { t, integrations, siteSettings } = useApp();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get('code') || searchParams.get('tracking') || '';
    if (fromQuery) setCode(fromQuery);
  }, [searchParams]);

  const dhl = integrations?.dhl;
  const trimmed = code.trim();
  const url = dhl && trimmed ? buildDhlTrackingUrl(dhl, trimmed) : null;
  const looksValid = /^[A-Za-z0-9]{8,}$/.test(trimmed);
  const email = siteSettings?.contacts.email || 'info@ampublishing.org';

  return (
    <div className="bg-[#F4F4F0] pt-[58px] md:pt-[76px]">
      <header className="bg-primary text-white py-20 md:py-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <Truck size={32} className="text-accent mb-6" />
          <h1 className="text-5xl md:text-6xl font-serif mb-4 leading-[0.95]">{t('tracking.title')}</h1>
          <p className="text-lg font-light text-gray-300 max-w-2xl">{t('tracking.subtitle')}</p>
        </div>
      </header>

      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <form
          onSubmit={e => {
            e.preventDefault();
            setTouched(true);
            if (!url || !looksValid) return;
            analytics.track('dhl_tracking_click', { source: 'tracking_page' });
            window.open(url, '_blank', 'noopener');
          }}
          className="bg-white border border-primary p-8 md:p-12 space-y-6"
        >
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-gray-400 mb-3">
              {t('tracking.field')}
            </span>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="00340434161094042557"
              className="w-full bg-transparent border-b border-primary py-3 font-mono text-lg md:text-2xl focus:outline-none focus:border-accent transition-colors"
            />
          </label>

          {touched && trimmed && !looksValid ? (
            <p className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle size={14} /> {t('tracking.invalid')}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!trimmed}
            className="w-full bg-primary text-white py-5 text-xs uppercase font-bold tracking-[0.2em] hover:bg-accent transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {t('tracking.submit')} <ArrowRight size={16} />
          </button>

          <p className="text-xs text-gray-500 leading-relaxed">
            {t('tracking.help')}{' '}
            <a href={`mailto:${email}`} className="underline hover:text-primary">{email}</a>
          </p>
        </form>
      </div>
    </div>
  );
};
