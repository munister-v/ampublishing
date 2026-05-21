import React, { useEffect, useState } from 'react';
import { Server } from 'lucide-react';
import { contentStore } from '../services/contentStore';

const CONTENT_FILES = [
  'manifest.json',
  'books.ru.json', 'books.en.json', 'books.de.json',
  'news.ru.json', 'news.en.json', 'news.de.json',
  'translation-overrides.ru.json', 'translation-overrides.en.json', 'translation-overrides.de.json',
  'payment-settings.json',
];

export const DevTools: React.FC = () => {
  if (import.meta.env.PROD) return null;

  const [isOpen, setIsOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, number | string>>({});

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const base = `${import.meta.env.BASE_URL}content/`;
      const entries = await Promise.all(
        CONTENT_FILES.map(async file => {
          try {
            const res = await fetch(base + file, { cache: 'no-cache' });
            return [file, res.status] as const;
          } catch (e) {
            return [file, 'ERR'] as const;
          }
        }),
      );
      if (!cancelled) {
        setStatuses(Object.fromEntries(entries));
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-mono text-xs">
      <div className={`bg-primary text-white shadow-2xl border border-white/20 transition-all duration-300 ${isOpen ? 'w-80 p-4' : 'w-10 h-10 p-0 flex items-center justify-center cursor-pointer hover:bg-accent'}`}>
        {!isOpen && (
          <button onClick={() => setIsOpen(true)} title="Content Source">
            <Server size={16} />
          </button>
        )}

        {isOpen && (
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-white/20 pb-2">
              <h3 className="font-bold uppercase tracking-widest text-accent">Content source</h3>
              <button onClick={() => setIsOpen(false)} className="opacity-50 hover:opacity-100">X</button>
            </div>
            <p className="opacity-60 mb-3 leading-relaxed">
              Static JSON under <code>public/content/</code> + GitHub Contents API for admin writes.
              Admin PAT: <span className={contentStore.isAuthenticated() ? 'text-green-400' : 'text-red-400'}>
                {contentStore.isAuthenticated() ? 'present' : 'none'}
              </span>
            </p>
            <table className="w-full">
              <tbody>
                {CONTENT_FILES.map(f => (
                  <tr key={f} className="border-t border-white/10">
                    <td className="py-1 pr-2 truncate max-w-[180px]">{f}</td>
                    <td className={`py-1 text-right ${
                      statuses[f] === 200 ? 'text-green-400' :
                      typeof statuses[f] === 'number' ? 'text-amber-400' :
                      statuses[f] ? 'text-red-400' : 'opacity-40'
                    }`}>
                      {statuses[f] ?? '...'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] opacity-40 text-center mt-3">NODE_ENV=development only</p>
          </div>
        )}
      </div>
    </div>
  );
};
