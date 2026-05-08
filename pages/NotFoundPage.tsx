
import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const { t } = useApp();

  return (
    <div className="bg-primary text-white min-h-[calc(100vh-80px)] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-[0.1] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        
        {/* Abstract shape */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>

        <div className="relative z-10 text-center px-6">
            <h1 className="text-[12rem] md:text-[20rem] font-serif leading-none opacity-20 select-none animate-fade-up">
                {t('error.not_found.title')}
            </h1>
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full">
                 <h2 className="text-4xl md:text-6xl font-serif mb-6 text-white animate-fade-up delay-100">
                    {t('error.not_found.subtitle')}
                 </h2>
                 <p className="font-mono text-sm md:text-base text-gray-400 max-w-md mx-auto mb-10 animate-fade-up delay-200">
                    {t('error.not_found.desc')}
                 </p>
                 <Link 
                   to="/" 
                   className="inline-flex items-center gap-2 border border-white px-8 py-3 uppercase text-xs font-bold tracking-widest hover:bg-white hover:text-primary transition-colors animate-fade-up delay-300"
                 >
                    <ArrowLeft size={16} /> {t('error.not_found.back')}
                 </Link>
            </div>
        </div>
        
        <div className="absolute bottom-10 left-0 w-full text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-30">System Error / Void Detected</span>
        </div>
    </div>
  );
};
