
import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Send, Mail, Phone, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t, isAdmin, siteSettings } = useApp();

  const footerNav = (siteSettings?.footerNav || []).filter(i => i.enabled !== false);
  const footerLegal = (siteSettings?.footerLegal || []).filter(i => i.enabled !== false);
  const social = siteSettings?.social;
  const contacts = siteSettings?.contacts;
  const brandName = siteSettings?.brand?.name || 'AM Publishing';
  const showNewsletter = siteSettings?.showNewsletter !== false;

  const socialLinks: { label: string; url: string; icon?: React.ReactNode }[] = [];
  if (social?.telegramUrl) socialLinks.push({ label: 'Telegram', url: social.telegramUrl, icon: <Send size={12} /> });
  if (social?.instagramUrl) socialLinks.push({ label: 'Instagram', url: social.instagramUrl });
  if (social?.facebookUrl) socialLinks.push({ label: 'Facebook', url: social.facebookUrl });
  if (social?.youtubeUrl) socialLinks.push({ label: 'YouTube', url: social.youtubeUrl });
  if (social?.twitterUrl) socialLinks.push({ label: 'X / Twitter', url: social.twitterUrl });

  const hasContacts = !!(contacts?.email || contacts?.phone || contacts?.addressLine1 || contacts?.addressLine2);

  return (
    <footer className="bg-primary text-white border-t border-white/20">
      <div className={`grid grid-cols-1 ${showNewsletter ? 'md:grid-cols-4' : 'md:grid-cols-3'} md:min-h-[400px]`}>

         {/* 1. BRAND BLOCK */}
         <div className="p-6 md:p-10 border-b md:border-b-0 md:border-r border-white/20 flex flex-col justify-between">
            <div>
               <h2 className="text-4xl md:text-6xl font-serif mb-6 leading-none">{brandName}</h2>
               <p className="font-mono text-xs max-w-[260px] opacity-60">
                  {t('footer.desc')}
               </p>
            </div>
            <div className="mt-12">
               <span className="block text-[10px] uppercase tracking-widest opacity-40 mb-2">{t('footer.social_index')}</span>
               <div className="flex flex-col gap-2 font-mono text-xs">
                  {socialLinks.map(link => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent flex items-center gap-2"
                    >
                      {link.icon}
                      {link.label} {'->'}
                    </a>
                  ))}
               </div>
            </div>
         </div>

         {/* 2. LINKS */}
         <div className="p-6 md:p-10 border-b md:border-b-0 md:border-r border-white/20">
            <h3 className="font-bold text-xs uppercase tracking-widest mb-8 text-accent">{t('footer.directory')}</h3>
            <ul className="space-y-4 font-serif text-2xl">
               {footerNav.map(item => (
                 <li key={item.id}>
                   <Link to={item.path} className="hover:text-accent transition-all">{t(item.labelKey)}</Link>
                 </li>
               ))}
            </ul>
         </div>

         {/* 3. CONTACTS */}
         {hasContacts ? (
           <div className="p-6 md:p-10 border-b md:border-b-0 md:border-r border-white/20">
             <h3 className="font-bold text-xs uppercase tracking-widest mb-8 text-accent">{t('footer.sections.contacts')}</h3>
             <div className="flex flex-col gap-4 font-mono text-xs leading-relaxed">
               {contacts?.email ? (
                 <a href={`mailto:${contacts.email}`} className="hover:text-accent flex items-start gap-2">
                   <Mail size={14} className="mt-[2px] shrink-0" /> {contacts.email}
                 </a>
               ) : null}
               {contacts?.phone ? (
                 <a href={`tel:${contacts.phone.replace(/[^+\d]/g, '')}`} className="hover:text-accent flex items-start gap-2">
                   <Phone size={14} className="mt-[2px] shrink-0" /> {contacts.phone}
                 </a>
               ) : null}
               {(contacts?.addressLine1 || contacts?.addressLine2) ? (
                 <div className="flex items-start gap-2">
                   <MapPin size={14} className="mt-[2px] shrink-0" />
                   <div className="whitespace-pre-line">
                     {contacts?.addressLine1}{contacts?.addressLine1 && contacts?.addressLine2 ? '\n' : ''}{contacts?.addressLine2}
                   </div>
                 </div>
               ) : null}
             </div>
           </div>
         ) : null}

         {/* 4. NEWSLETTER */}
         {showNewsletter ? (
           <div className={`col-span-1 ${hasContacts ? '' : 'md:col-span-2'} p-6 md:p-10 flex flex-col justify-center bg-[#061426]`}>
              <h3 className="text-3xl md:text-5xl font-serif mb-8 max-w-lg leading-tight">
                 {t('footer.subscribe_title')}<br/> <span className="text-accent italic">{t('footer.subscribe_span')}</span>
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 border-b border-white/40 pb-3">
                 <input
                   type="email"
                   placeholder={t('footer.email_ph')}
                   className="bg-transparent w-full outline-none text-lg md:text-xl font-mono uppercase placeholder:text-white/20 min-w-0"
                 />
                 <button className="uppercase font-bold text-xs tracking-widest hover:text-accent text-left sm:text-right whitespace-nowrap">{t('footer.submit')}</button>
              </div>
           </div>
         ) : null}
      </div>

      {/* COPYRIGHT STRIP */}
      <div className="border-t border-white/20 p-4 flex flex-col md:flex-row justify-between items-start md:items-center text-[9px] uppercase tracking-widest font-mono opacity-50 gap-4 md:gap-0">
         <span>© {new Date().getFullYear()} {brandName} Berlin</span>
         <div className="flex flex-wrap gap-4">
            {footerLegal.map(item => (
              <Link key={item.id} to={item.path} className="hover:text-white hover:opacity-100 transition-opacity">{t(item.labelKey)}</Link>
            ))}
            <Link to={isAdmin ? '/admin' : '/login'} className="hover:text-accent hover:opacity-100 transition-opacity">{isAdmin ? 'Admin Panel' : 'Admin'}</Link>
         </div>
      </div>
    </footer>
  );
};
