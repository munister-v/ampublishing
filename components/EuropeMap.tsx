import React, { useEffect, useState } from 'react';
import { EUROPE_CITIES, EUROPE_COUNTRIES, EUROPE_VIEWBOX } from './europeMapData';

/**
 * Карта Европы по данным Natural Earth (components/europeMapData.ts собирает
 * scripts/build-europe-map.py). Страны ЕС залиты золотом, Беларусь подсвечена
 * светлым золотом со свечением, остальные приглушены. Книги уходят из Берлина:
 * пунктирные дуги к городам (среди них Минск), по дугам летят «посылки» и
 * пульсирует точка отправки. Движение только без `prefers-reduced-motion`.
 */

const DESTINATIONS = ['Lisbon', 'Madrid', 'Paris', 'Dublin', 'Rome', 'Athens', 'Vienna', 'Warsaw', 'Minsk', 'Helsinki', 'Stockholm'];

const STYLE = `
@media (prefers-reduced-motion: no-preference){
  .em-route{animation:emDash 28s linear infinite}
  .em-pulse{transform-box:fill-box;transform-origin:center;animation:emPulse 2.8s ease-out infinite}
  .em-pulse.d{animation-delay:1.4s}
  .em-hl{animation:emGlow 3.6s ease-in-out infinite}
}
@keyframes emDash{to{stroke-dashoffset:-260}}
@keyframes emPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(3.4);opacity:0}}
@keyframes emGlow{0%,100%{filter:drop-shadow(0 0 6px rgba(244,226,176,.35))}50%{filter:drop-shadow(0 0 16px rgba(244,226,176,.85))}}
.em-hl{filter:drop-shadow(0 0 10px rgba(244,226,176,.55))}
.em-eu{transition:fill .35s}
.em-eu:hover{fill:#e3c690}
`;

const arc = (a: [number, number], b: [number, number]) => {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  // control point pushed to the north of the chord, so every arc bows upward
  const nx = -dy / len, ny = dx / len;
  const sign = ny > 0 ? -1 : 1;
  const k = len * 0.22;
  return `M${a[0]} ${a[1]} Q${(mx + nx * k * sign).toFixed(1)} ${(my + ny * k * sign).toFixed(1)} ${b[0]} ${b[1]}`;
};

export const EuropeMap: React.FC<{ className?: string; label: string; mini?: boolean }> = ({ className, label, mini }) => {
  const berlin = EUROPE_CITIES.Berlin;
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    setMotion(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }, []);

  return (
    <svg
      viewBox={EUROPE_VIEWBOX}
      className={className}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
      // края кадра растворяются, чтобы карта не обрывалась жёсткой линией
      style={mini ? undefined : { WebkitMaskImage: 'radial-gradient(ellipse 62% 66% at 46% 52%, #000 58%, transparent 100%)', maskImage: 'radial-gradient(ellipse 62% 66% at 46% 52%, #000 58%, transparent 100%)' }}
    >
      <style>{STYLE}</style>
      <g>
        {EUROPE_COUNTRIES.filter(c => !mini || c.eu || c.hl).map(c => (
          <path
            key={c.name}
            d={c.d}
            className={c.hl ? 'em-hl' : c.eu ? 'em-eu' : undefined}
            fill={c.hl ? '#f4e2b0' : c.eu ? '#c9a66b' : 'rgba(255,255,255,0.075)'}
            stroke={c.hl ? '#fff7e0' : c.eu ? '#0a1b36' : 'rgba(255,255,255,0.13)'}
            strokeWidth={c.hl ? 1.6 : c.eu ? 1.1 : 0.8}
            strokeLinejoin="round"
          >
            <title>{c.name}</title>
          </path>
        ))}
      </g>
      {!mini && (
        <>
          <g fill="none" stroke="#fff" strokeOpacity="0.62" strokeWidth="1.8" strokeLinecap="round">
            {DESTINATIONS.map(city => (
              <path key={city} d={arc(berlin, EUROPE_CITIES[city])} className="em-route" strokeDasharray="1 9" strokeOpacity={city === 'Minsk' ? 0.95 : 0.62} />
            ))}
          </g>
          {motion && (
            <g fill="#fff" aria-hidden="true">
              {DESTINATIONS.map((city, i) => (
                <circle key={city} r="3.6" stroke="#0a1b36" strokeWidth="1.2">
                  <animateMotion dur={`${5.2 + (i % 4) * 0.8}s`} begin={`${(i * 0.55).toFixed(2)}s`} repeatCount="indefinite" path={arc(berlin, EUROPE_CITIES[city])} />
                </circle>
              ))}
            </g>
          )}
          <g fill="#fff">
            {DESTINATIONS.map(city => (
              <circle key={city} cx={EUROPE_CITIES[city][0]} cy={EUROPE_CITIES[city][1]} r={city === 'Minsk' ? 6.5 : 4.5} stroke={city === 'Minsk' ? '#c9a66b' : '#0a1b36'} strokeWidth={city === 'Minsk' ? 2.5 : 1.5} />
            ))}
          </g>
          <circle cx={EUROPE_CITIES.Minsk[0]} cy={EUROPE_CITIES.Minsk[1]} r="9" fill="#f4e2b0" fillOpacity="0.5" className="em-pulse d" />
          <circle cx={berlin[0]} cy={berlin[1]} r="9" fill="#fff" fillOpacity="0.35" className="em-pulse" />
          <circle cx={berlin[0]} cy={berlin[1]} r="9" fill="#fff" fillOpacity="0.35" className="em-pulse d" />
          <circle cx={berlin[0]} cy={berlin[1]} r="9" fill="#0a1b36" stroke="#fff" strokeWidth="3" />
        </>
      )}
    </svg>
  );
};
