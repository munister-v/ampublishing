import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

/**
 * Кнопка-призыв: подпись и отдельная ячейка со стрелкой. На телефоне занимает всю
 * ширину и держит высоту пальца (56px), на широком экране по размеру подписи.
 * `solid` и `outline` для светного фона, `gold` для тёмных блоков.
 */
type Variant = 'solid' | 'outline' | 'gold';

const FRAME: Record<Variant, string> = {
  solid: 'border-primary bg-primary text-white hover:bg-secondary',
  outline: 'border-primary bg-transparent text-primary hover:bg-white',
  gold: 'border-white/35 bg-transparent text-white hover:border-accent',
};
const CELL: Record<Variant, string> = {
  solid: 'border-white/15 bg-accent text-primary',
  outline: 'border-primary bg-primary text-white',
  gold: 'border-white/35 bg-accent text-primary',
};

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  to?: string;
  href?: string;
  className?: string;
}

export const CtaButton: React.FC<Props> = ({ children, variant = 'solid', to, href, className = '' }) => {
  const cls = `group flex min-h-[56px] w-full items-stretch border transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex sm:w-auto ${FRAME[variant]} ${className}`;
  const inner = (
    <>
      <span className="flex flex-1 items-center px-6 py-4 text-left text-[13px] font-bold uppercase leading-tight tracking-[0.14em] sm:px-8">{children}</span>
      <span aria-hidden="true" className={`flex w-14 shrink-0 items-center justify-center border-l ${CELL[variant]}`}>
        {href ? <ArrowUpRight size={18} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /> : <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />}
      </span>
    </>
  );
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
  return <Link to={to ?? '/'} className={cls}>{inner}</Link>;
};
