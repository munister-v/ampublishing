import React, { useEffect, useState } from 'react';

export const Preloader: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [exit, setExit] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExit(true); // Trigger the slide up
      setTimeout(() => setVisible(false), 800); // Wait for animation duration (match CSS)
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-primary transition-transform duration-[800ms] ease-out-expo ${exit ? '-translate-y-full' : 'translate-y-0'}`}
    >
      <div className={`text-center flex flex-col items-center transition-opacity duration-500 ${exit ? 'opacity-0' : 'opacity-100'}`}>
        <img src="/logo-white.png" alt="AM Publishing" className="w-24 h-24 object-contain mb-6 animate-pulse" draggable={false} />
        <div className="overflow-hidden mt-2">
            <p className="text-soft text-[10px] uppercase tracking-[0.4em] animate-fade-up delay-100">Berlin</p>
        </div>
      </div>
    </div>
  );
};