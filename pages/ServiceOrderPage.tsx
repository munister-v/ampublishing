
import React, { useState, useRef } from 'react';
import { Upload, Check, Send, Paperclip } from 'lucide-react';
import { useApp } from '../AppContext';
import { Link } from 'react-router-dom';

export const ServiceOrderPage: React.FC = () => {
  const { t } = useApp();
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    type: 'publishing',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    setTimeout(() => setSubmitted(true), 1500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  if (submitted) {
    return (
      <div className="bg-[#F4F4F0] min-h-screen pt-[80px] flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white border border-primary p-12 text-center animate-fade-up">
           <div className="w-20 h-20 bg-primary text-white mx-auto flex items-center justify-center rounded-full mb-8">
              <Check size={40} />
           </div>
           <h2 className="text-4xl font-serif mb-4">{t('services.form.success_title')}</h2>
           <p className="text-gray-600 mb-8">{t('services.form.success_desc')}</p>
           <Link to="/" className="bg-primary text-white px-8 py-3 uppercase font-bold text-xs tracking-widest hover:bg-accent transition-colors">
              {t('services.form.back')}
           </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F4F0] min-h-screen pt-[60px] md:pt-[80px]">
      
      {/* HEADER */}
      <div className="bg-primary text-white py-20 px-6 border-b border-primary relative overflow-hidden">
         {/* Noise applied via global body style now */}
         <div className="container mx-auto relative z-10 max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-serif mb-6 leading-[0.9]">{t('services.title')}</h1>
            <p className="text-xl font-light text-gray-300 max-w-2xl">{t('services.subtitle')}</p>
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
            </div>
            
            {/* Decorative Grid */}
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
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-4 group-focus-within:text-accent transition-colors">{t('services.form.type')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {['publishing', 'editing', 'design', 'printing', 'distribution'].map(type => (
                        <label key={type} className="flex items-center gap-3 cursor-pointer group/radio">
                           <div className={`w-5 h-5 border border-primary flex items-center justify-center transition-colors ${form.type === type ? 'bg-primary' : 'bg-transparent'}`}>
                              <input 
                                type="radio" 
                                name="type" 
                                value={type} 
                                checked={form.type === type}
                                onChange={e => setForm({...form, type: e.target.value})}
                                className="hidden"
                              />
                              {form.type === type && <div className="w-2 h-2 bg-white"></div>}
                           </div>
                           <span className={`text-sm font-mono uppercase ${form.type === type ? 'text-primary font-bold' : 'text-gray-500'}`}>
                              {t(`services.form.type_options.${type}`)}
                           </span>
                        </label>
                     ))}
                  </div>
               </div>

               <div className="group">
                   <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 group-focus-within:text-accent transition-colors">{t('services.form.description')}</label>
                   <textarea 
                     rows={4}
                     value={form.description}
                     onChange={e => setForm({...form, description: e.target.value})}
                     placeholder={t('services.form.description_placeholder')}
                     className="w-full bg-gray-50 border border-primary/20 p-4 font-serif text-lg focus:outline-none focus:border-primary focus:bg-white transition-all rounded-none resize-none"
                   ></textarea>
               </div>

               {/* CUSTOM FILE INPUT */}
               <div className="border border-dashed border-primary/40 bg-gray-50 p-8 text-center hover:bg-white hover:border-primary transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept=".pdf,.doc,.docx"
                  />
                  <div className="flex flex-col items-center gap-4">
                     {file ? (
                        <>
                           <Paperclip size={32} className="text-accent" />
                           <span className="font-mono text-sm underline">{file.name}</span>
                           <span className="text-[10px] uppercase text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        </>
                     ) : (
                        <>
                           <Upload size={32} className="text-gray-400 group-hover:text-primary transition-colors" />
                           <span className="font-mono text-sm uppercase tracking-widest">{t('services.form.upload_btn')}</span>
                           <span className="text-[10px] text-gray-400">{t('services.form.file_desc')}</span>
                        </>
                     )}
                  </div>
               </div>

               <button type="submit" className="w-full bg-primary text-white py-5 text-sm uppercase font-bold tracking-[0.2em] hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-4 group">
                  {t('services.form.submit')}
                  <Send size={16} className="group-hover:translate-x-1 transition-transform" />
               </button>

            </form>
         </div>
      </div>
    </div>
  );
};
