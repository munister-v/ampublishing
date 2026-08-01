import React, { useEffect, useState } from 'react';
import { Mail, Check, Copy, ArrowRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { analytics } from '../services/analytics';
import type { ServiceItem } from '../types';

/** mailto: со смысловой темой письма (шаблон задаётся в админке). */
const buildMailto = (email: string, subjectTemplate: string, serviceTitle: string) => {
  const subject = (subjectTemplate || '{service}').replace('{service}', serviceTitle);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
};

const ServiceBlock: React.FC<{
  item: ServiceItem;
  index: number;
  email: string;
  subjectTemplate: string;
  ctaLabel: string;
  formLabel: string;
}> = ({ item, index, email, subjectTemplate, ctaLabel, formLabel }) => (
  <article className="bg-white border border-primary/15 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
    {/* Левая колонка: номер + название */}
    <div className="p-8 lg:p-12 border-b md:border-b-0 md:border-r border-primary/15 bg-[#F8F8F5] flex flex-col justify-between gap-8">
      <div>
        <span className="block font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400 mb-6">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="font-serif text-3xl lg:text-4xl leading-tight">{item.title}</h2>
        {item.summary ? (
          <p className="mt-4 text-gray-600 leading-relaxed">{item.summary}</p>
        ) : null}
      </div>
      {item.priceNote ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary border-t border-primary/15 pt-4">
          {item.priceNote}
        </p>
      ) : null}
    </div>

    {/* Правая колонка: что входит */}
    <div className="p-8 lg:p-12 flex flex-col gap-8">
      {item.includes.filter(Boolean).length ? (
        <ul className="space-y-4">
          {item.includes.filter(Boolean).map((line, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="mt-[7px] w-2 h-2 bg-accent shrink-0" />
              <span className="text-[17px] leading-relaxed">{line}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {item.note ? (
        <p className="text-sm text-gray-500 italic border-l-2 border-primary/20 pl-4">{item.note}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-3">
        <a
          href={buildMailto(email, subjectTemplate, item.title)}
          onClick={() => analytics.serviceEnquiryClick(item.id, item.title)}
          className="inline-flex items-center gap-3 border border-primary px-6 py-3 text-[10px] uppercase tracking-[0.22em] font-bold hover:bg-primary hover:text-white transition-colors group"
        >
          {ctaLabel}
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </a>
        <Link
          to={`/services/order?service=${encodeURIComponent(item.id)}`}
          onClick={() => analytics.serviceEnquiryClick(item.id, item.title)}
          className="inline-flex items-center gap-2 px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-gray-500 hover:text-primary transition-colors"
          title="Заполнить форму вместо письма"
        >
          <FileText size={13} /> {formLabel}
        </Link>
      </div>
    </div>
  </article>
);

export const ServicesPage: React.FC = () => {
  const { services, isLoadingData, language, t } = useApp();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (services) analytics.viewServices(language);
  }, [services, language]);

  const copyEmail = async () => {
    if (!services?.contactEmail) return;
    try {
      await navigator.clipboard.writeText(services.contactEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard недоступен — пользователь всё равно видит адрес */
    }
  };

  if (!services) {
    return (
      <div className="bg-[#F4F4F0] pt-[58px] md:pt-[76px] min-h-[60vh] flex items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-gray-400">
          {isLoadingData ? '…' : ''}
        </p>
      </div>
    );
  }

  const items = (services.items || []).filter(item => item.enabled !== false);
  const checklist = (services.orderChecklist || []).filter(Boolean);

  return (
    <div className="bg-[#F4F4F0] pt-[58px] md:pt-[76px]">
      {/* HERO */}
      <header className="bg-primary text-white py-20 md:py-28 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="container mx-auto relative z-10 max-w-5xl">
          <h1 className="text-5xl md:text-7xl font-serif mb-6 leading-[0.95]">{services.title}</h1>
          {services.subtitle ? (
            <p className="text-xl font-light text-gray-300 max-w-2xl">{services.subtitle}</p>
          ) : null}
        </div>
      </header>

      <div className="container mx-auto px-6 py-16 md:py-24 max-w-5xl space-y-12">
        {services.intro ? (
          <p className="font-serif text-xl md:text-2xl leading-relaxed max-w-3xl">{services.intro}</p>
        ) : null}

        <div className="space-y-8">
          {items.map((item, index) => (
            <ServiceBlock
              key={item.id}
              item={item}
              index={index}
              email={services.contactEmail}
              subjectTemplate={services.emailSubject}
              ctaLabel={services.ctaLabel}
              formLabel={t('services.form_link')}
            />
          ))}
        </div>

        {/* КАК ЗАКАЗАТЬ */}
        <section className="bg-primary text-white border border-primary grid grid-cols-1 lg:grid-cols-2">
          <div className="p-8 lg:p-14 border-b lg:border-b-0 lg:border-r border-white/15">
            <span className="block font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-6">
              {services.orderTitle}
            </span>
            {services.orderIntro ? (
              <p className="font-serif text-2xl leading-snug mb-8">{services.orderIntro}</p>
            ) : null}

            {checklist.length ? (
              <ol className="space-y-4">
                {checklist.map((line, i) => (
                  <li key={i} className="flex items-start gap-4 text-gray-200">
                    <span className="w-6 h-6 border border-white/30 flex items-center justify-center text-[10px] font-mono shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>

          <div className="p-8 lg:p-14 flex flex-col justify-center gap-6 bg-white/5">
            <Mail size={28} className="text-accent" />
            <a
              href={`mailto:${services.contactEmail}`}
              className="font-serif text-3xl md:text-4xl break-all hover:text-accent transition-colors"
            >
              {services.contactEmail}
            </a>
            <div className="flex flex-wrap gap-3">
              <a
                href={`mailto:${services.contactEmail}`}
                className="inline-flex items-center gap-3 bg-accent text-primary px-6 py-3 text-[10px] uppercase tracking-[0.22em] font-bold hover:bg-white transition-colors"
              >
                {services.ctaLabel}
                <ArrowRight size={14} />
              </a>
              <Link
                to="/services/order"
                className="inline-flex items-center gap-3 border border-white/30 px-6 py-3 text-[10px] uppercase tracking-[0.22em] font-bold hover:bg-white hover:text-primary transition-colors"
              >
                <FileText size={14} /> {t('services.form_link')}
              </Link>
              <button
                onClick={copyEmail}
                className="inline-flex items-center gap-3 border border-white/30 px-6 py-3 text-[10px] uppercase tracking-[0.22em] font-bold hover:bg-white hover:text-primary transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'OK' : 'Copy'}
              </button>
            </div>
            {services.outro ? (
              <p className="text-sm text-gray-300 border-t border-white/15 pt-6">{services.outro}</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};
