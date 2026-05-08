
import React from 'react';
import { Mail, ArrowRight, Download, PenTool, BookOpen, Send, User, Award, Globe, Clock, Shield, Anchor, CheckCircle } from 'lucide-react';
import { useApp } from '../AppContext';
import { Link } from 'react-router-dom';
import { FadeImage } from '../components/FadeImage';

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
        <div className="bg-[#F4F4F0] min-h-screen pt-[60px] md:pt-[80px]">
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
        <div className="bg-[#F4F4F0] min-h-screen pt-[60px] md:pt-[80px]">
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
        <div className="bg-[#F4F4F0] min-h-screen text-primary pt-[60px] md:pt-[80px]">
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
    <div className="bg-bg min-h-screen pt-[60px] md:pt-[80px]">
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
            
            <Link 
              to="/services/order"
              className="inline-flex items-center gap-4 bg-white text-primary px-10 py-5 uppercase tracking-[0.2em] text-xs font-bold hover:bg-accent hover:text-white transition-all duration-300 shadow-2xl hover:-translate-y-1"
            >
              <Send size={16} /> {t('static.authors.go_to_form')}
            </Link>
            
            <p className="mt-10 text-[10px] text-gray-500 uppercase tracking-widest opacity-60">
              {t('static.authors.format_note')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

// --- About Page ---
export const AboutPage: React.FC = () => {
  const { t } = useApp();

  return (
    <div className="bg-white min-h-screen pt-[60px] md:pt-[80px]">
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
                 <span className="block text-4xl font-serif text-primary mb-2">20+</span>
                 <span className="text-[10px] uppercase tracking-widest text-gray-400">Лет опыта</span>
               </div>
               <div>
                 <span className="block text-4xl font-serif text-primary mb-2">150+</span>
                 <span className="text-[10px] uppercase tracking-widest text-gray-400">Изданных книг</span>
               </div>
            </div>
          </div>
          <div className="order-1 md:order-2 bg-gray-100 aspect-square md:aspect-[4/3] relative overflow-hidden group">
             <img 
              src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=1000" 
              alt="Library interior" 
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-[1.5s]"
            />
            <div className="absolute inset-0 bg-primary/10 mix-blend-multiply"></div>
            <div className="absolute bottom-6 left-6 text-white text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Berlin HQ</div>
          </div>
        </div>

        <div className="bg-bg py-24 -mx-4 px-4 md:mx-0 rounded-sm">
           <div className="text-center mb-16">
             <h2 className="text-4xl font-serif text-primary mb-4">{t('static.about.team')}</h2>
             <div className="w-12 h-[1px] bg-accent mx-auto"></div>
           </div>
           
           {/* Team Grid (Replaced RandomUser with Professional Placeholders) */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
             {[
               { name: "Maryia Surkant", role: "role1", img: "https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=400&h=500" },
               { name: "Sophia Lenz", role: "role2", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=500" },
               { name: "Markus Weber", role: "role3", img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400&h=500" }
             ].map((member, i) => (
               <div key={i} className="group text-center">
                 <div className="w-full aspect-[3/4] mx-auto mb-6 relative overflow-hidden bg-white shadow-sm border border-gray-100">
                    <FadeImage 
                      src={member.img}
                      alt={member.name}
                      className="w-full h-full object-cover grayscale contrast-125 group-hover:grayscale-0 transition-all duration-700" 
                    />
                 </div>
                 <h4 className="font-serif text-xl text-primary">{member.name}</h4>
                 <p className="text-[10px] uppercase tracking-[0.15em] text-accent mt-2 font-bold">{t(`static.about.${member.role}`)}</p>
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
    <div className="bg-bg min-h-screen pt-[60px] md:pt-[80px]">
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
              <h2 className="text-2xl font-serif text-primary mb-4">Interview Requests</h2>
              <p className="text-sm text-gray-500 mb-8 font-light leading-relaxed flex-1">
                Author interviews, publishing house features, and media inquiries.
              </p>
              <a href="mailto:am.hybridpublishing@gmail.com" className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary border-b border-primary pb-1 hover:text-accent hover:border-accent transition-colors">
                Send Request
              </a>
            </div>

          </div>

          <div className="border-t border-gray-200 pt-16">
            <h2 className="text-3xl font-serif text-primary mb-12 text-center">{t('static.media.mentions')}</h2>
            <div className="grid grid-cols-1 gap-4">
              {[
                { source: "The Berlin Review", title: "New Wave of Intellectual Literature in Germany", date: "Oct 2023", icon: Globe },
                { source: "BookCulture Blog", title: "Anna Stern on 'Shadows of Berlin': Big Interview", date: "Sep 2023", icon: User },
                { source: "Art & Text", title: "Best Covers of the Year: Editor's Choice", date: "Aug 2023", icon: Award },
              ].map((item, i) => (
                 <div key={i} className="flex flex-col md:flex-row justify-between items-start md:items-center p-8 bg-white border border-gray-100 hover:shadow-md transition-all group cursor-pointer">
                    <div className="flex items-start gap-6">
                      <div className="hidden md:flex w-12 h-12 bg-gray-50 text-gray-400 items-center justify-center rounded-full shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                         <item.icon size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] text-accent uppercase tracking-[0.15em] mb-2 block font-bold">{item.source}</span>
                        <h3 className="font-serif text-xl text-primary group-hover:text-accent transition-colors">{item.title}</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-4 md:mt-0 pl-[calc(3rem+1.5rem)] md:pl-0">
                      <span className="text-xs text-gray-400 font-mono">{item.date}</span>
                      <ArrowRight size={16} className="text-gray-300 group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 duration-300" />
                    </div>
                 </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
