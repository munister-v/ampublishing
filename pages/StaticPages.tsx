
import React from 'react';
import { Mail, Download, PenTool, BookOpen, Send, User, Clock } from 'lucide-react';
import { useApp } from '../AppContext';
import { Link } from 'react-router-dom';
import { getAuthorShowcaseContent } from '../services/authorShowcase';

// --- Components ---
const SectionHeader: React.FC<{ title: string; subtitle?: string; bgClass?: string }> = ({ title, subtitle, bgClass = 'bg-primary' }) => (
  <div className={`${bgClass} text-white py-24 md:py-32 relative overflow-hidden`}>
    {/* Abstract Noise Texture via Global CSS now, removed external image dependency */}
    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px] transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
    
    <div className="container mx-auto px-4 text-center relative z-10 animate-fade-up">
      <h1 className="text-4xl md:text-6xl font-serif mb-8 tracking-tight leading-none break-words max-w-4xl mx-auto">{title}</h1>
      {subtitle && (
        <div className="flex justify-center">
          <p className="text-gray-300 text-lg md:text-xl font-light max-w-2xl leading-relaxed border-t border-white/10 pt-8">
            {subtitle}
          </p>
        </div>
      )}
    </div>
  </div>
);

// --- Impressum Page ---
export const ImpressumPage: React.FC = () => {
    const { t } = useApp();
    const text = t('static.impressum.text') as string;
    
    return (
        <div className="bg-[#F4F4F0] pt-[60px] md:pt-[80px]">
            <SectionHeader title={t('static.impressum.title')} bgClass="bg-[#0b1623]" />
            <div className="container mx-auto px-6 py-20 max-w-3xl">
                <div className="bg-white p-12 border border-primary shadow-sm">
                    <h2 className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-8">{t('static.impressum.subtitle')}</h2>
                    <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-primary">
                        {text}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Terms (AGB) Page ---
export const TermsPage: React.FC = () => {
    const { t, language } = useApp();
    // Handling array of sections for German, simple text for others
    const sections = t('static.terms.sections') as any;
    const isArray = Array.isArray(sections);

    return (
        <div className="bg-[#F4F4F0] pt-[60px] md:pt-[80px]">
            <SectionHeader title={t('static.terms.title')} subtitle={t('static.terms.subtitle')} bgClass="bg-[#1a2b42]" />
            
            <div className="container mx-auto px-6 py-20 max-w-4xl">
                {/* Language Warning for Non-DE */}
                {language !== 'de' && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-6 mb-12">
                         <p className="font-mono text-sm text-amber-800">{t('static.terms.intro')}</p>
                         <p className="mt-2 text-xs text-amber-600">{t('static.terms.text')}</p>
                    </div>
                )}

                {isArray ? (
                    <div className="space-y-12">
                        {sections.map((section: any, idx: number) => (
                            <div key={idx} className="bg-white p-8 border border-gray-200">
                                <h3 className="text-xl font-serif mb-4 text-primary">{section.title}</h3>
                                <p className="text-gray-600 leading-relaxed font-light">{section.text}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white p-12 text-center text-gray-400 font-mono italic">
                        Switch to German (DE) to view full legal terms.
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Privacy Policy Page ---
export const PrivacyPage: React.FC = () => {
    const { t } = useApp();
    
    // Dynamic Sections Handling
    const sections = t('static.privacy.sections') as any;
    const isArray = Array.isArray(sections);

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="bg-[#F4F4F0] text-primary pt-[60px] md:pt-[80px]">
            <SectionHeader title={t('static.privacy.title')} bgClass="bg-[#11223A]" />
            
            <div className="container mx-auto px-6 py-16 md:py-24">
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">
                    
                    {/* LEFT: Sticky Navigation (Only if sections exist) */}
                    {isArray && (
                        <aside className="lg:w-1/4">
                            <div className="sticky top-[120px]">
                                <p className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-6">{t('static.privacy.updated')}</p>
                                <nav className="space-y-4 border-l border-primary/20 pl-6">
                                    {sections.map((s: any, idx: number) => (
                                        <button 
                                            key={idx}
                                            onClick={() => scrollToSection(`section-${idx}`)}
                                            className="block text-sm font-bold uppercase tracking-wide text-left text-gray-500 hover:text-accent transition-colors truncate w-full"
                                            title={s.title}
                                        >
                                            {s.title.split(' ')[0]} {s.title.split(' ')[1]}...
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        </aside>
                    )}

                    {/* RIGHT: Content */}
                    <div className={`lg:w-3/4 max-w-4xl ${!isArray ? 'mx-auto' : ''}`}>
                        <div className="mb-16">
                            <p className="text-2xl font-serif leading-relaxed">{t('static.privacy.intro')}</p>
                        </div>

                        {isArray ? (
                            <div className="space-y-16">
                                {sections.map((section: any, idx: number) => (
                                    <section key={idx} id={`section-${idx}`} className="scroll-mt-32">
                                        <h2 className="text-3xl font-serif mb-6 border-b border-primary pb-4">{section.title}</h2>
                                        <div className="text-lg leading-loose font-light text-justify whitespace-pre-wrap">
                                            {section.text}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : (
                             // Fallback for languages where sections structure might differ or failed
                            <div className="p-8 bg-white border border-red-200 text-red-500">
                                Content structure mismatch. Please verify translation files.
                            </div>
                        )}

                        <div className="mt-32 pt-16 border-t border-primary/20 text-center">
                            <p className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-6">AM Publishing Berlin • Legal Department</p>
                            <a href="mailto:am.hybridpublishing@gmail.com" className="text-primary text-2xl md:text-3xl font-serif italic hover:text-accent transition-colors border-b-2 border-primary/20 hover:border-accent pb-2">
                                am.hybridpublishing@gmail.com
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Authors Page ---
export const AuthorsPage: React.FC = () => {
  const { t } = useApp();
  
  return (
    <div className="bg-bg pt-[60px] md:pt-[80px]">
      <SectionHeader 
        title={t('static.authors.title')} 
        subtitle={t('static.authors.subtitle')}
      />
      
      {/* Manifesto / Intro */}
      <section className="py-24 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-20 items-start">
          <div className="md:col-span-7">
            <span className="text-accent text-xs font-bold uppercase tracking-[0.25em] mb-6 block flex items-center gap-2">
              <span className="w-8 h-[1px] bg-accent"></span> {t('static.authors.manifesto')}
            </span>
            <h2 className="text-4xl md:text-5xl font-serif text-primary mb-10 leading-[1.1]">
              {t('static.authors.what_we_publish')}
            </h2>
            <div className="space-y-8 text-gray-600 font-light text-lg leading-relaxed md:pr-12">
              <p className="first-letter:text-4xl first-letter:font-serif first-letter:mr-2 first-letter:float-left first-letter:text-primary">
                {t('static.authors.p1')}
              </p>
              <p>
                {t('static.authors.p2')}
              </p>
            </div>
          </div>
          
          <div className="md:col-span-5 grid grid-cols-1 gap-6">
            <div className="bg-white p-10 border border-gray-100 hover:border-primary/20 hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <BookOpen size={80} className="text-primary" />
              </div>
              <h3 className="font-serif text-2xl mb-2 text-primary relative z-10">{t('static.authors.prose')}</h3>
              <p className="text-xs text-gray-500 uppercase tracking-widest relative z-10">{t('static.authors.prose_sub')}</p>
            </div>
            <div className="bg-primary text-white p-10 hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <PenTool size={80} className="text-white" />
              </div>
              <h3 className="font-serif text-2xl mb-2 relative z-10">{t('static.authors.poetry')}</h3>
              <p className="text-xs text-white/60 uppercase tracking-widest relative z-10">{t('static.authors.poetry_sub')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Submission Process (Redesigned) */}
      <section className="bg-white py-24 border-t border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <h2 className="text-3xl md:text-4xl font-serif text-primary">{t('static.authors.process_title')}</h2>
            <div className="h-[1px] flex-1 bg-gray-100 mx-8 hidden md:block"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-l border-t border-gray-100">
            {[1, 2, 3].map((num) => (
              <div key={num} className="relative p-12 bg-white border-r border-b border-gray-100 hover:bg-bg transition-colors group">
                <div className="flex justify-between items-start mb-6">
                   <span className="text-4xl font-serif text-accent/40 group-hover:text-accent transition-colors">0{num}</span>
                   {num === 2 && <Mail className="text-gray-300 group-hover:text-primary transition-colors" />}
                   {num === 3 && <Clock className="text-gray-300 group-hover:text-primary transition-colors" />}
                </div>
                <h3 className="text-xl font-serif text-primary mb-4 relative z-10">
                  {t(`static.authors.step${num}_t`)}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed relative z-10 font-light">
                  {t(`static.authors.step${num}_d`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 container mx-auto px-4">
        <div className="bg-primary text-white px-8 py-20 md:px-20 md:py-24 text-center relative overflow-hidden isolate">
          {/* Animated Gradient Bg */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[#162a47] z-[-1]"></div>
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-serif mb-8">{t('static.authors.ready')}</h2>
            <p className="text-gray-300 mb-12 font-light text-lg">
              {t('static.authors.ready_sub')}
            </p>
            
            <a 
              href="https://docs.google.com/forms/d/e/1FAIpQLSc9Dxc9XRKuhebrkJP6WmHaXmIrTVY9LwnXZHGLkmEpf5iioA/viewform?usp=publish-editor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-4 bg-white text-primary px-10 py-5 uppercase tracking-[0.2em] text-xs font-bold hover:bg-accent hover:text-white transition-all duration-300 shadow-2xl hover:-translate-y-1"
            >
              <Send size={16} /> {t('static.authors.go_to_form')}
            </a>
            
            <p className="mt-10 text-[10px] text-gray-500 uppercase tracking-widest opacity-60">
              {t('static.authors.format_note')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export const OurAuthorsPage: React.FC = () => {
  const { t, language } = useApp();
  const authorShowcase = getAuthorShowcaseContent(language, t('static.our_authors.showcase_items'));

  return (
    <div className="bg-[#F4F4F0] pt-[60px] md:pt-[80px]">
      <SectionHeader
        title={t('static.our_authors.title')}
        subtitle={t('static.our_authors.subtitle')}
        bgClass="bg-[#0b1623]"
      />

      <section className="px-4 md:px-8 py-10 md:py-16">
        <div className="space-y-8">
        {authorShowcase.map((item, index) => (
          <article key={item.id} className="border border-primary bg-white overflow-hidden">
            <div className={`grid grid-cols-1 xl:grid-cols-2 ${index % 2 === 1 ? 'xl:[&>*:first-child]:order-2 xl:[&>*:last-child]:order-1' : ''}`}>
              <div className="relative min-h-[360px] md:min-h-[520px] bg-primary overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={`${item.nameMain} ${item.nameAccent}`}
                  className="absolute inset-0 w-full h-full object-cover grayscale"
                  style={{ objectPosition: '50% 18%' }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,15,30,0.12),rgba(4,15,30,0.72))]" />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 md:px-8 py-5">
                  <span className="border border-white/20 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/80">
                    {item.years}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/70">
                    0{index + 1}
                  </span>
                </div>
                <div className="absolute left-5 md:left-8 bottom-5 md:bottom-8">
                  <div className="text-[5rem] md:text-[8rem] font-serif text-white/10 leading-none">
                    {item.initial}
                  </div>
                </div>
              </div>

              <div className="bg-[#F7F1E6] p-8 md:p-12 xl:p-16 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-4 mb-8">
                    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent whitespace-nowrap">
                      {t('home.authors_kicker')}
                    </p>
                    <div className="h-px flex-1 bg-primary/15" />
                  </div>

                  <h2 className="text-4xl sm:text-5xl md:text-7xl font-serif leading-[0.9] text-primary break-words">
                    {item.nameMain}
                  </h2>
                  <p className="text-3xl sm:text-4xl md:text-6xl font-serif italic text-primary/60 leading-[0.95] mt-2 break-words">
                    {item.nameAccent}
                  </p>

                  <div className="mt-8 grid grid-cols-1 md:grid-cols-[170px_1fr] gap-6 items-start">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-accent font-mono leading-relaxed">
                      {item.knownFor}
                    </div>
                    <div className="space-y-5 text-lg md:text-xl leading-relaxed text-primary/70">
                      <p>{item.bio}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="border border-primary/15 bg-white/60 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-primary/75">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
        </div>
      </section>
    </div>
  );
};

// --- About Page ---
export const AboutPage: React.FC = () => {
  const { t } = useApp();

  return (
    <div className="bg-white pt-[60px] md:pt-[80px]">
      <SectionHeader 
        title={t('static.about.title')}
        subtitle={t('static.about.subtitle')}
      />
      <div className="container mx-auto px-4 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-24 items-center mb-32">
          <div className="order-2 md:order-1">
            <h2 className="text-3xl font-serif text-primary mb-8">{t('static.about.mission')}</h2>
            <p className="text-gray-600 leading-relaxed mb-6 font-light text-lg drop-cap">
              {t('static.about.p1')}
            </p>
            <p className="text-gray-600 leading-relaxed font-light text-lg">
              {t('static.about.p2')}
            </p>
            <div className="flex gap-12 mt-12 border-t border-gray-100 pt-8">
               <div>
                 <span className="block text-4xl font-serif text-primary mb-2">300-1000+</span>
                 <span className="text-[10px] uppercase tracking-widest text-gray-400">{t('static.about.stat1')}</span>
               </div>
               <div>
                 <span className="block text-4xl font-serif text-primary mb-2">✓</span>
                 <span className="text-[10px] uppercase tracking-widest text-gray-400">{t('static.about.stat2')}</span>
               </div>
            </div>
          </div>
          <div className="order-1 md:order-2 bg-gray-100 aspect-square md:aspect-[4/3] relative overflow-hidden group">
             <img
              src={t('static.about.mission_image') as string || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=1000"}
              alt={t('static.about.mission') as string || 'AM Publishing'}
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-[1.5s]"
            />
            <div className="absolute inset-0 bg-primary/5 mix-blend-multiply pointer-events-none"></div>
          </div>
        </div>

        <div className="bg-bg py-24 -mx-4 px-4 md:mx-0 rounded-sm">
           <div className="text-center mb-16">
             <h2 className="text-4xl font-serif text-primary mb-4">{t('static.about.team')}</h2>
             <div className="w-12 h-[1px] bg-accent mx-auto"></div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
             {[
               { role: "role1" },
               { role: "role2" },
               { role: "role3" }
             ].map((member, i) => (
               <div key={i} className="group text-center border border-gray-100 bg-white p-10 shadow-sm">
                 <h4 className="font-serif text-2xl text-primary">{t(`static.about.${member.role}`)}</h4>
                 <p className="text-[10px] uppercase tracking-[0.15em] text-accent mt-4 font-bold">AM Publishing</p>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- Media Page ---
export const MediaPage: React.FC = () => {
  const { t } = useApp();

  return (
    <div className="bg-bg pt-[60px] md:pt-[80px]">
      <SectionHeader 
        title={t('static.media.title')}
        subtitle={t('static.media.subtitle')}
      />
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            
            {/* Press Kit */}
            <div className="bg-white p-10 shadow-sm border border-gray-100 hover:border-primary/20 transition-all duration-300 flex flex-col items-start">
              <div className="w-12 h-12 bg-bg flex items-center justify-center mb-6 text-primary rounded-full">
                 <Download size={20} />
              </div>
              <h2 className="text-2xl font-serif text-primary mb-4">{t('static.media.kit_title')}</h2>
              <p className="text-sm text-gray-500 mb-8 font-light leading-relaxed flex-1">
                {t('static.media.kit_desc')}
              </p>
              <button className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary border-b border-primary pb-1 hover:text-accent hover:border-accent transition-colors">
                {t('static.media.download')} (ZIP, 45MB)
              </button>
            </div>

            {/* Request Review Copy */}
            <div className="bg-white p-10 shadow-sm border border-gray-100 hover:border-primary/20 transition-all duration-300 flex flex-col items-start">
              <div className="w-12 h-12 bg-bg flex items-center justify-center mb-6 text-primary rounded-full">
                 <BookOpen size={20} />
              </div>
              <h2 className="text-2xl font-serif text-primary mb-4">{t('static.media.review_title')}</h2>
              <p className="text-sm text-gray-500 mb-8 font-light leading-relaxed flex-1">
                {t('static.media.review_desc')}
              </p>
              <a href="mailto:am.hybridpublishing@gmail.com" className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary border-b border-primary pb-1 hover:text-accent hover:border-accent transition-colors">
                {t('static.media.contact_pr')}
              </a>
            </div>

             {/* Interviews */}
             <div className="bg-white p-10 shadow-sm border border-gray-100 hover:border-primary/20 transition-all duration-300 flex flex-col items-start">
              <div className="w-12 h-12 bg-bg flex items-center justify-center mb-6 text-primary rounded-full">
                 <User size={20} />
              </div>
              <h2 className="text-2xl font-serif text-primary mb-4">{t('static.media.interview_title')}</h2>
              <p className="text-sm text-gray-500 mb-8 font-light leading-relaxed flex-1">
                {t('static.media.interview_desc')}
              </p>
              <a href="mailto:am.hybridpublishing@gmail.com" className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary border-b border-primary pb-1 hover:text-accent hover:border-accent transition-colors">
                {t('static.media.interview_cta')}
              </a>
            </div>

          </div>

          <div className="h-px w-full bg-gray-200"></div>
        </div>
      </div>
    </div>
  );
};
