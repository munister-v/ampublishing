import React, { useState } from 'react';

/**
 * Small decorative glyphs for the homepage "region / delivery partner" tiles.
 * Self-contained inline SVGs (no external asset fetch) so they render
 * offline and never depend on a third-party logo file.
 */

/** Simplified, stylised Europe silhouette — a recognisable continent shape, not survey-accurate. */
const EuropeSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Mainland: a smooth, gently-lobed landmass reading as a continent, not a literal map */}
    <path
      d="M32 7c5 0 8 3.5 12 4 5 .6 8.5 5 7.5 10-.6 3-3 4.5-2.5 7.5.6 3.6 3 6-.5 9-2.6 2-2 5-4.5 7-3 2.4-6.5 2-9 4.5-3 3-7.5 3-10.5.5-2 1.7-5 1.4-6.5-1-2.6 2.4-6.6-.4-6-3.4-4-1-6-5-3.6-8.6 1.3-2 3.6-2.3 4-4.7.5-3-1.4-6 1.6-8.4 2-1.6 4.6-1 6-3 1.4-2 1.6-4.7 4-5.8 1.7-.8 3.7-.6 5-2z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    {/* British Isles, offset to the west */}
    <ellipse cx="16" cy="21" rx="2.6" ry="4" stroke="currentColor" strokeWidth="2" transform="rotate(-20 16 21)" />
  </svg>
);

/**
 * Europe glyph for the homepage tile. Prefers a real photo/illustration at
 * /images/europe-icon.png (drop a file there — nothing else to wire up) and
 * silently falls back to the hand-drawn silhouette above if that file is
 * missing, so the tile never shows a broken image.
 */
export const EuropeGlyph: React.FC<{ className?: string }> = ({ className }) => {
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) return <EuropeSVG className={className} />;
  return (
    <img
      src="/images/europe-icon.png"
      alt=""
      aria-hidden="true"
      className={`${className || ''} object-contain`}
      onError={() => setImgFailed(true)}
    />
  );
};

/**
 * Compact DHL delivery-partner badge. Renders the wordmark in DHL's brand
 * colours (own typography/markup, not a copy of their vector logo file) so
 * the tile reads as an official-feeling badge without hot-linking or
 * downloading any third-party asset.
 */
export const DHLBadge: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={`inline-flex items-center justify-center px-3 py-1 rounded-sm font-sans font-black italic tracking-tight ${className || ''}`}
    style={{ background: '#FFCC00', color: '#D40511' }}
  >
    DHL
  </span>
);
