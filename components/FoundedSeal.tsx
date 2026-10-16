import React, { useId } from 'react';

/**
 * Печать издательства: монограмма AM в центре, по кругу медленно вращается
 * надпись («Основано в 2026 году в Берлине», «Founded in Berlin in 2026»...).
 * Текст берётся из переводов, число повторов и размер букв подбираются под длину
 * строки, чтобы кольцо замыкалось ровно. При `prefers-reduced-motion` печать стоит.
 */
const R = 80;
const LENGTH = 2 * Math.PI * R;

export const FoundedSeal: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const id = useId().replace(/:/g, '');
  const unit = `${text.toUpperCase()} ✦ `;
  const reps = 1;
  const total = unit.length * reps;
  // ширина заглавной буквы ≈ 0.72 кегля плюс разрядка: подбираем кегль под длину окружности
  const size = Math.max(10, Math.min(19, LENGTH / (total * 0.95)));
  return (
    <div className={`relative ${className ?? ''}`} role="img" aria-label={text}>
      <svg viewBox="0 0 200 200" className="h-full w-full motion-safe:animate-spin-slow" aria-hidden="true">
        <defs>
          <path id={`seal-${id}`} d={`M 100,100 m -${R},0 a ${R},${R} 0 1,1 ${R * 2},0 a ${R},${R} 0 1,1 -${R * 2},0`} />
        </defs>
        <circle cx="100" cy="100" r="96" fill="none" stroke="#C9A66B" strokeWidth="1.2" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="#C9A66B" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" />
        <text fontFamily="Manrope, sans-serif" fontWeight="800" fontSize={size} letterSpacing="2.5" fill="#040F1E">
          <textPath href={`#seal-${id}`} textLength={LENGTH - 2} lengthAdjust="spacing">{unit.repeat(reps)}</textPath>
        </text>
      </svg>
      <img src="/logo-dark.svg" alt="" className="absolute left-1/2 top-1/2 h-[30%] w-auto -translate-x-1/2 -translate-y-1/2" draggable={false} />
    </div>
  );
};
