
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Send, AlertTriangle, Loader2, Mail } from 'lucide-react';
import { useApp } from '../AppContext';
import { Link, useSearchParams } from 'react-router-dom';
import { submitLead, type LeadResult } from '../services/leads';
import { analytics } from '../services/analytics';

export const ServiceOrderPage: React.FC = () => {
  const { t, language, services } = useApp();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<LeadResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Список типов услуг берём из раздела «Услуги», чтобы форма и страница
  // всегда совпадали; если раздел пуст — старый фиксированный набор.
  const serviceOptions = useMemo(() => {
    const fromContent = (services?.items || [])
      .filter(item => item.enabled !== false)
      .map(item => ({ id: item.id, title: item.title }));
    if (fromContent.length) return fromContent;
    return ['publishing', 'editing', 'design', 'printing', 'distribution'].map(id => ({
      id,
      title: t(`services.form.type_options.${id}`) as string,
    }));
  }, [services, t]);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    type: '',
    description: '',
  });

  // Предвыбор услуги из ссылки /services/order?service=<id>
  useEffect(() => {
    const requested = searchParams.get('service');
    const fallback = serviceOptions[0]?.id || '';
    const match = serviceOptions.find(option => option.id === requested);
    setForm(prev => ({ ...prev, type: prev.type || match?.id || fallback }));
  }, [searchParams, serviceOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const selected = serviceOptions.find(option => option.id === form.type);
      const submitted = await submitLead({
        name: form.name,
        email: form.email,
        phone: form.phone,
        service: form.type,
        serviceTitle: selected?.title,
        message: form.description,
        language,
      });
      analytics.leadSubmit(form.type, submitted.delivered);
      setResult(submitted);
      if (!submitted.delivered) {
        setError(submitted.error || t('services.form.fallback_hint'));
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <div className="bg-[#F4F4F0] pt-[76px] flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white border border-primary p-12 text-center animate-fade-up">
          <div className={`w-20 h-20 mx-auto flex items-center justify-center rounded-full mb-8 ${result.delivered ? 'bg-primary text-white' : 'bg-amber-100 text-amber-700'}`}>
            {result.delivered ? <Check size={40} /> : <AlertTriangle size={36} />}
          </div>
          <h2 className="text-4xl font-serif mb-4">
            {result.delivered ? t('services.form.success_title') : t('services.form.fallback_title')}
          </h2>
          <p className="text-gray-600 mb-8">
            {result.delivered
              ? services?.orderIntro || (t('services.form.success_desc') as string)
              : t('services.form.fallback_desc')}
          </p>

          {!result.delivered ? (
            <a
              href={result.mailtoUrl}
              className="inline-flex items-center justify-center gap-3 bg-primary text-white px-8 py-4 uppercase font-bold text-xs tracking-widest hover:bg-accent transition-colors mb-4"
            >
              <Mail size={16} /> {t('services.form.fallback_cta')}
            </a>
          ) : null}

          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-6">
            {result.lead.id}
          </p>

          <Link to="/" className="border border-primary px-8 py-3 uppercase font-bold text-xs tracking-widest hover:bg-primary hover:text-white transition-colors">
            {t('services.form.back')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F4F0] pt-[58px] md:pt-[76px]">

      {/* HEADER */}
      <div className="bg-primary text-white py-20 px-6 border-b border-primary relative overflow-hidden">
         <div className="container mx-auto relative z-10 max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-serif mb-6 leading-[0.9]">{t('services.title')}</h1>
            <p className="text-xl font-light text-gray-300 max-w-2xl">{t('services.subtitle')}</p>
            <Link to="/services" className="inline-block mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-white transition-colors underline underline-offset-4">
              ← {services?.title || t('nav.services')}
            </Link>
         </div>
      </div>

      {/* FORM GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[600px] border-b border-primary">

         {/* LEFT: INFO & VISUAL */}
         <div className="bg-[#E8EDF2] p-8 lg:p-20 border-b lg:border-b-0 lg:border-r border-primary flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
               <span className="block font-mono text-xs uppercase tracking-[0.2em] mb-8 text-primary/60">EST. 2026</span>
               <h3 className="text-3xl font-serif mb-6">{t('services.protocol_title')}</h3>
               <ul className="space-y-6 font-mono text-sm">
                  {[1, 2, 3].map(step => (
                     <li key={step} className="flex items-start gap-4">
                        <span className="w-6 h-6 bg-primary text-white flex items-center justify-center text-[10px] shrink-0">0{step}</span>
                        <p>{t(`services.protocol_steps.${step}`)}</p>
                     </li>
                  ))}
               </ul>

               {services?.orderChecklist?.filter(Boolean).length ? (
                 <div className="mt-12 border-t border-primary/20 pt-8">
                   <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/60 mb-4">
                     {services.orderTitle}
                   </p>
                   <ul className="space-y-2 text-sm">
                     {services.orderChecklist.filter(Boolean).map((line, i) => (
                       <li key={i} className="flex gap-3"><span className="mt-2 w-1.5 h-1.5 bg-primary shrink-0" />{line}</li>
                     ))}
                   </ul>
                 </div>
               ) : null}
            </div>

            <div className="absolute inset-0 opacity-10 pointer-events-none"
                 style={{ backgroundImage: 'linear-gradient(#040F1E 1px, transparent 1px), linear-gradient(90deg, #040F1E 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            </div>
         </div>

         {/* RIGHT: FORM */}
         <div className="bg-white p-8 lg:p-20">
            <form onSubmit={handleSubmit} className="space-y-12">

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="group">
                     <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 group-focus-within:text-accent transition-colors">{t('services.form.name')}</label>
                     <input
                       required
                       type="text"
                       value={form.name}
                       onChange={e => setForm({...form, name: e.target.value})}
                       className="w-full bg-transparent border-b border-primary py-2 font-serif text-xl focus:outline-none focus:border-accent transition-colors rounded-none placeholder:opacity-0"
                     />
                  </div>
                  <div className="group">
                     <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 group-focus-within:text-accent transition-colors">{t('services.form.email')}</label>
                     <input
                       required
                       type="email"
                       value={form.email}
                       onChange={e => setForm({...form, email: e.target.value})}
                       className="w-full bg-transparent border-b border-primary py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors rounded-none"
                     />
                  </div>
               </div>

               <div className="group">
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 group-focus-within:text-accent transition-colors">{t('services.form.phone')}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full bg-transparent border-b border-primary py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors rounded-none"
                  />
               </div>

               <div className="group">
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-4 group-focus-within:text-accent transition-colors">{t('services.form.type')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {serviceOptions.map(option => (
                        <label key={option.id} className="flex items-center gap-3 cursor-pointer group/radio">
                           <div className={`w-5 h-5 border border-primary flex items-center justify-center transition-colors ${form.type === option.id ? 'bg-primary' : 'bg-transparent'}`}>
                              <input
                                type="radio"
                                name="type"
                                value={option.id}
                                checked={form.type === option.id}
                                onChange={e => setForm({...form, type: e.target.value})}
                                className="hidden"
                              />
                              {form.type === option.id && <div className="w-2 h-2 bg-white"></div>}
                           </div>
                           <span className={`text-sm font-mono ${form.type === option.id ? 'text-primary font-bold' : 'text-gray-500'}`}>
                              {option.title}
                           </span>
                        </label>
                     ))}
                  </div>
               </div>

               <div className="group">
                   <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 group-focus-within:text-accent transition-colors">{t('services.form.description')}</label>
                   <textarea
                     rows={5}
                     required
                     value={form.description}
                     onChange={e => setForm({...form, description: e.target.value})}
                     placeholder={t('services.form.description_placeholder')}
                     className="w-full bg-gray-50 border border-primary/20 p-4 font-serif text-lg focus:outline-none focus:border-primary focus:bg-white transition-all rounded-none resize-none"
                   ></textarea>
               </div>

               {error ? (
                 <p className="border border-amber-300 bg-amber-50 text-amber-800 p-4 text-sm">{error}</p>
               ) : null}

               <button type="submit" disabled={sending} className="w-full bg-primary text-white py-5 text-sm uppercase font-bold tracking-[0.2em] hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-4 group disabled:opacity-60">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : null}
                  {t('services.form.submit')}
                  {!sending ? <Send size={16} className="group-hover:translate-x-1 transition-transform" /> : null}
               </button>

               <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400 text-center">
                 {services?.contactEmail
                   ? <>{t('services.form.or_email')} <a href={`mailto:${services.contactEmail}`} className="underline hover:text-primary">{services.contactEmail}</a></>
                   : null}
               </p>

            </form>
         </div>
      </div>
    </div>
  );
};
