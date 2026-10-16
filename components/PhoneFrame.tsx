import React from 'react';

/**
 * Корпус iPhone 15 Pro вокруг скриншота. Размеры в единицах контейнера (`cqw`,
 * 1cqw = 1% ширины телефона), поэтому рамка и скругления масштабируются точно:
 * корпус с радиусом 14.2cqw, титановая кромка с бликами, чёрная окантовка экрана
 * (~2.3cqw) и стекло с лёгким отражением. Сбоку кнопки Action, громкости и питания.
 * Скриншот уже содержит статус-бар и Dynamic Island, поэтому поверх ничего не рисуем.
 */
const RAIL = 'linear-gradient(135deg,#f2f2f4 0%,#a9abb1 14%,#e6e7ea 30%,#8c8f96 52%,#d8dade 70%,#8f9298 86%,#eceef0 100%)';
const KEY = 'linear-gradient(90deg,#7d8087 0%,#c9cbd0 50%,#8f9298 100%)';

export const PhoneFrame: React.FC<{ src: string; className?: string; style?: React.CSSProperties; alt?: string; children?: React.ReactNode }> = ({ src, className, style, alt = '', children }) => (
  <div className={`relative ${className ?? ''}`} style={{ containerType: 'inline-size', ...style }}>
    {/* buttons sit under the rail, so only their outer edge is visible */}
    <span aria-hidden className="absolute rx" style={{ left: '-0.9cqw', top: '15.6%', width: '1.4cqw', height: '3.1%', '--rx': '0.7cqw 0 0 0.7cqw', background: KEY } as React.CSSProperties} />
    <span aria-hidden className="absolute rx" style={{ left: '-0.9cqw', top: '21.4%', width: '1.4cqw', height: '6.2%', '--rx': '0.7cqw 0 0 0.7cqw', background: KEY } as React.CSSProperties} />
    <span aria-hidden className="absolute rx" style={{ left: '-0.9cqw', top: '29.0%', width: '1.4cqw', height: '6.2%', '--rx': '0.7cqw 0 0 0.7cqw', background: KEY } as React.CSSProperties} />
    <span aria-hidden className="absolute rx" style={{ right: '-0.9cqw', top: '25.2%', width: '1.4cqw', height: '9.8%', '--rx': '0 0.7cqw 0.7cqw 0', background: KEY } as React.CSSProperties} />

    <div
      className="rx"
      style={{
        '--rx': '14.2cqw',
        position: 'relative',
        background: RAIL,
        padding: '1.1cqw',
        boxShadow: [
          '0 0 0 0.35cqw rgba(20,22,28,.55)',
          'inset 0 0 0 0.3cqw rgba(255,255,255,.55)',
          '0 6cqw 12cqw -4cqw rgba(0,0,0,.75)',
          '0 2cqw 4cqw -2cqw rgba(0,0,0,.6)',
        ].join(','),
      } as React.CSSProperties}
    >
      <div className="rx" style={{ '--rx': '13.1cqw', background: '#030304', padding: '2.1cqw', boxShadow: 'inset 0 0 0 0.25cqw rgba(255,255,255,.08)' } as React.CSSProperties}>
        <div className="rx" style={{ '--rx': '11cqw', position: 'relative', overflow: 'hidden', background: '#000' } as React.CSSProperties}>
          <img src={src} alt={alt} decoding="async" className="block h-auto w-full" style={{ aspectRatio: '598 / 1300' }} />
          {children}
          {/* стекло: мягкое отражение сверху слева */}
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(118deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,0) 32%)' }} />
        </div>
      </div>
    </div>
  </div>
);
