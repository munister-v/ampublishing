
import React, { useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-0 right-0 z-[100] flex flex-col items-end p-6 gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const isError = toast.type === 'error';

  return (
    <div className={`
      pointer-events-auto min-w-[300px] max-w-[400px] 
      border border-primary shadow-[8px_8px_0px_0px_rgba(4,15,30,1)] 
      animate-slide-in-right bg-white text-primary
      flex flex-col
    `}>
       {/* Header Strip */}
       <div className={`h-1 w-full ${isError ? 'bg-red-600' : 'bg-primary'}`}></div>
       
       <div className="p-5 flex items-start gap-4">
          <div className="flex-1">
             <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] uppercase font-bold tracking-widest ${isError ? 'text-red-600' : 'text-primary'}`}>
                    {isError ? 'System Alert' : 'Notification'}
                </span>
                <span className="h-[1px] flex-1 bg-gray-200"></span>
             </div>
             <p className="font-mono text-xs leading-relaxed uppercase">
                {toast.message}
             </p>
          </div>
          <button onClick={onRemove} className="group p-1 hover:bg-gray-100 transition-colors">
             <X size={14} />
          </button>
       </div>
       
       {/* Footer Deco */}
       <div className="px-5 pb-3 flex justify-between items-center opacity-40">
          <span className="text-[8px] font-mono">{new Date().toLocaleTimeString()}</span>
          <ArrowRight size={10} />
       </div>
    </div>
  );
};
