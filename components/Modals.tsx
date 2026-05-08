
import React, { useEffect, useState } from 'react';
import { X, Check, Loader2, Globe } from 'lucide-react';
import { REGIONS } from '../constants';
import { useApp } from '../AppContext';

// --- Reusable Modal Shell ---
const ModalOverlay: React.FC<{ children: React.ReactNode; onClose?: () => void }> = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 backdrop-blur-sm p-4 animate-fade-in">
    <div className="absolute inset-0" onClick={onClose}></div>
    <div className="relative bg-white shadow-[20px_20px_0px_0px_rgba(0,0,0,0.2)] max-w-md w-full animate-fade-up border border-primary">
      {children}
    </div>
  </div>
);

// --- Cookie Consent ---
export const CookieConsent: React.FC = () => {
  const { t } = useApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookie-consent')) {
      setTimeout(() => setVisible(true), 2000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-primary p-4 md:p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] animate-slide-in-right">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-4">
            <div className="hidden md:block p-2 bg-primary text-white rounded-full">
                <Globe size={16} />
            </div>
            <p className="text-xs md:text-sm text-primary font-mono max-w-2xl">
              {t('modal.cookies')}
            </p>
        </div>
        <button 
          onClick={handleAccept}
          className="bg-primary text-white px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] hover:bg-accent transition-colors whitespace-nowrap"
        >
          {t('modal.accept')}
        </button>
      </div>
    </div>
  );
};

// --- Region Selector ---
interface RegionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (regionId: string) => void;
  currentRegionId?: string;
}

export const RegionModal: React.FC<RegionModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useApp();
  const [step, setStep] = useState<'detecting' | 'confirm' | 'select'>('detecting');
  const [detected, setDetected] = useState(REGIONS[0]);

  useEffect(() => {
    if (isOpen) {
      setStep('detecting');
      
      const detectRegion = async () => {
        try {
            // 1. Try IP-based Detection
            const response = await fetch('https://get.geojs.io/v1/ip/country.json');
            if (!response.ok) throw new Error('GeoIP service unavailable');
            
            const data = await response.json();
            const country = data.country; 
            
            // Logic mapping
            if (country === 'DE') return 'de';
            const EU_COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
            if (EU_COUNTRIES.includes(country)) return 'eu';
            return 'world';

        } catch (e) {
            // 2. Fallback: Timezone
            try {
                 const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                 if (timeZone === 'Europe/Berlin' || timeZone === 'Europe/Vienna') return 'de';
                 if (timeZone.startsWith('Europe/')) return 'eu';
            } catch (err) {}
            return 'world';
        }
      };

      // Artificial delay for UX "Searching" feel
      detectRegion().then(targetId => {
          const foundRegion = REGIONS.find(r => r.id === targetId) || REGIONS.find(r => r.id === 'world')!;
          setTimeout(() => {
             setDetected(foundRegion);
             setStep('confirm');
          }, 1000);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ModalOverlay>
      <div className="p-8 text-center bg-[#F4F4F0]">
        
        {step === 'detecting' && (
          <div className="py-12">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-6" />
            <h3 className="text-lg font-serif tracking-wide">{t('modal.region_detecting')}</h3>
          </div>
        )}

        {step === 'confirm' && (
          <div className="animate-fade-in">
             <div className="w-16 h-16 bg-white border border-primary mx-auto flex items-center justify-center mb-6">
                 <span className="text-2xl">{detected.id === 'de' ? '🇩🇪' : detected.id === 'eu' ? '🇪🇺' : '🌍'}</span>
             </div>
            <h3 className="text-2xl font-serif mb-3">{t('modal.region_confirm', { region: detected.name })}</h3>
            <p className="text-xs font-mono text-gray-500 mb-8 uppercase tracking-wider">{t('modal.region_desc')}</p>
            
            <div className="space-y-3">
              <button 
                onClick={() => { onSelect(detected.id); onClose(); }}
                className="w-full bg-primary text-white py-4 uppercase tracking-[0.2em] text-xs font-bold hover:bg-accent transition-colors shadow-lg"
              >
                {t('modal.yes_correct')}
              </button>
              <button 
                onClick={() => setStep('select')}
                className="w-full border border-primary text-primary py-4 uppercase tracking-[0.2em] text-xs font-bold hover:bg-white transition-colors"
              >
                {t('modal.choose_other')}
              </button>
            </div>
            <button onClick={onClose} className="mt-6 text-[9px] text-gray-400 underline uppercase tracking-widest hover:text-primary transition-colors">
              {t('modal.continue_anyway')}
            </button>
          </div>
        )}

        {step === 'select' && (
          <div className="animate-fade-in text-left">
            <div className="flex justify-between items-center mb-8 border-b border-primary/20 pb-4">
              <h3 className="text-xl font-serif">{t('modal.choose_region')}</h3>
              <button onClick={() => setStep('confirm')} className="text-gray-400 hover:text-primary text-[10px] uppercase tracking-widest">{t('modal.back')}</button>
            </div>
            <div className="space-y-2">
              {REGIONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => { onSelect(r.id); onClose(); }}
                  className="w-full text-left px-6 py-4 border border-white hover:border-primary bg-white hover:bg-gray-50 transition-all group flex justify-between items-center"
                >
                  <span className="font-serif text-lg group-hover:text-primary">{r.name}</span>
                  <span className="text-xs font-mono text-gray-400 group-hover:text-accent font-bold">{r.currency}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
};

// --- Age Gate ---
export const AgeGateModal: React.FC<{ isOpen: boolean; onConfirm: () => void; onDeny: () => void }> = ({ isOpen, onConfirm, onDeny }) => {
  const { t } = useApp();
  if (!isOpen) return null;
  return (
    <ModalOverlay>
      <div className="p-8 text-center border-t-4 border-red-500 bg-white">
        <h3 className="text-3xl font-serif mb-4 text-primary">{t('modal.age_title')}</h3>
        <p className="mb-8 text-gray-600 font-mono text-xs leading-relaxed">
          {t('modal.age_desc')}
        </p>
        <div className="flex gap-4">
          <button 
            onClick={onDeny}
            className="flex-1 border border-primary text-primary py-4 uppercase tracking-widest text-xs hover:bg-gray-50 font-bold"
          >
            {t('modal.age_no')}
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 bg-primary text-white py-4 uppercase tracking-widest text-xs hover:bg-accent transition-colors font-bold"
          >
            {t('modal.age_yes')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};

// --- Confirm Remove ---
export const ConfirmRemoveModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; itemName: string }> = ({ isOpen, onClose, onConfirm, itemName }) => {
  const { t } = useApp();
  if (!isOpen) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="p-8 bg-white">
        <h3 className="text-xl font-serif mb-2">{t('cart.delete_confirm')}</h3>
        <p className="text-sm text-gray-500 mb-8 font-mono">{t('cart.delete_msg', { name: itemName })}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-xs uppercase tracking-widest text-gray-500 hover:text-primary">{t('cart.cancel')}</button>
          <button 
            onClick={onConfirm}
            className="px-8 py-3 bg-primary text-white text-xs uppercase tracking-widest font-bold hover:bg-red-700 transition-colors"
          >
            {t('cart.delete')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};
