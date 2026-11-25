import React from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../AppContext';

/* Кнопка скачивания Android-приложения, в пару к бейджу App Store: чёрная, с тонкой рамкой, высота 53px. */
export const AndroidBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useApp();
  return (
    <a
      href="/app/"
      aria-label={t('footer.android_alt')}
      className={`inline-flex h-[53px] items-center gap-3 rounded-[9px] border border-[#a6a6a6] bg-black px-4 leading-none text-white transition-transform duration-200 hover:-translate-y-0.5 active:opacity-80 ${className}`}
    >
      <Download size={26} strokeWidth={1.6} aria-hidden />
      <span className="flex flex-col text-left">
        <span className="text-[10px] tracking-wide">{t('footer.android_small')}</span>
        <span className="mt-0.5 text-[22px] font-semibold leading-none tracking-tight">Android</span>
      </span>
    </a>
  );
};
