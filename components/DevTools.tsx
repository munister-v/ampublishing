
import React, { useState, useEffect } from 'react';
import { Server, Database, Save, RefreshCw } from 'lucide-react';

export const DevTools: React.FC = () => {
  // Only show in development
  if (import.meta.env.PROD) return null;

  const [isOpen, setIsOpen] = useState(false);
  const [useMock, setUseMock] = useState(localStorage.getItem('use_mock_api') !== 'false');
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('api_url') || 'http://localhost:3000/api/v1');

  const handleSave = () => {
    localStorage.setItem('use_mock_api', String(useMock));
    localStorage.setItem('api_url', apiUrl);
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-mono text-xs">
      <div className={`bg-primary text-white shadow-2xl border border-white/20 transition-all duration-300 ${isOpen ? 'w-80 p-4' : 'w-10 h-10 p-0 flex items-center justify-center cursor-pointer hover:bg-accent'}`}>
        
        {!isOpen && (
            <button onClick={() => setIsOpen(true)} title="Backend Dev Tools">
                <Server size={16} />
            </button>
        )}

        {isOpen && (
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-white/20 pb-2">
                <h3 className="font-bold uppercase tracking-widest text-accent">Backend Config</h3>
                <button onClick={() => setIsOpen(false)} className="opacity-50 hover:opacity-100">X</button>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <span>Data Source:</span>
                    <button 
                        onClick={() => setUseMock(!useMock)}
                        className={`px-3 py-1 border ${useMock ? 'bg-white/10 border-white' : 'bg-green-500 border-green-500 text-primary font-bold'}`}
                    >
                        {useMock ? 'MOCK DATA' : 'REAL API'}
                    </button>
                </div>

                {!useMock && (
                    <div>
                        <label className="block mb-1 opacity-70">API Base URL:</label>
                        <input 
                            type="text" 
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 p-2 text-white focus:border-accent outline-none"
                        />
                    </div>
                )}

                <div className="pt-2 border-t border-white/20">
                     <button 
                        onClick={handleSave}
                        className="w-full bg-white text-primary py-2 font-bold uppercase hover:bg-accent hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                        <Save size={14} /> Save & Reload
                    </button>
                </div>
                
                <div className="text-[10px] opacity-40 text-center">
                    Visible only in NODE_ENV=development
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
