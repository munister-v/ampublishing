
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { CheckoutFormData, OrderDiagnostics, PaymentSettings } from '../types';
import { api } from '../services/api';
import { formatLabel } from '../utils/formatLabel';

const collectOrderDiagnostics = async (regionId: string, storeLanguage: string): Promise<OrderDiagnostics> => {
  const base: OrderDiagnostics = {
    capturedAt: new Date().toISOString(),
    regionId,
    storeLanguage,
  };
  try {
    base.userAgent = navigator.userAgent;
    base.language = navigator.language;
    base.languages = Array.isArray(navigator.languages) ? Array.from(navigator.languages) : undefined;
    base.platform = (navigator as any).platform;
    base.screen = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
    base.viewport = `${window.innerWidth}x${window.innerHeight}`;
    base.devicePixelRatio = window.devicePixelRatio;
    base.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    base.timezoneOffset = new Date().getTimezoneOffset();
    base.referer = document.referrer || '';
    base.pageUrl = window.location.href;
  } catch {
    // ignore — diagnostics are best-effort
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      base.ip = data.ip;
      base.ipCity = data.city;
      base.ipRegion = data.region;
      base.ipCountry = data.country_name || data.country;
      base.ipOrg = data.org;
    }
  } catch {
    // network/cors/timeout — skip; diagnostics are best-effort
  }
  return base;
};
import {
  CheckCircle, ArrowRight, ChevronLeft, AlertCircle,
  ShieldCheck, ChevronDown, ChevronUp, ShoppingBag,
  Truck, User, MapPin, FileText
} from 'lucide-react';

// --- УТИЛИТЫ: ВАЛИДАЦИЯ И ФОРМАТИРОВАНИЕ ---
// Вынесли чистые функции для работы с данными карт, чтобы не засорять компонент

const PaymentUtils = {
  // Алгоритм Луна для проверки корректности номера карты
  // (Стандартная проверка контрольной суммы, используемая банками)
  validateCardNumber: (val: string) => {
    const clean = val.replace(/\D/g, ''); // Удаляем все нечисловые символы
    if (clean.length < 13) return false; // Минимальная длина номера
    
    let sum = 0;
    let shouldDouble = false;
    
    // Проходим по цифрам справа налево
    for (let i = clean.length - 1; i >= 0; i--) {
        let digit = parseInt(clean.charAt(i));
        if (shouldDouble) {
            if ((digit *= 2) > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
  },

  // Проверка срока действия (Формат MM/YY)
  // Проверяет формат, корректность месяца (1-12) и что карта не просрочена
  validateExpiry: (val: string) => {
    if (!/^\d{2}\/\d{2}$/.test(val)) return false; // Строгое соответствие маске 00/00
    const [month, year] = val.split('/').map(Number);
    
    if (month < 1 || month > 12) return false;
    
    const now = new Date();
    const currentYear = parseInt(now.getFullYear().toString().slice(-2)); // Берем последние 2 цифры года
    const currentMonth = now.getMonth() + 1;

    // Логика проверки будущего времени
    if (year < currentYear) return false;
    if (year === currentYear && month < currentMonth) return false;
    
    return true;
  },

  // Форматирование: Вставляет пробел каждые 4 цифры
  formatCardNumber: (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 19); // Макс 19 символов
    return v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  },

  // Форматирование: Вставляет слэш после месяца
  formatExpiry: (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 2) return `${v.slice(0, 2)}/${v.slice(2)}`;
    return v;
  },

  // Определение типа карты (Visa начинается с 4, MasterCard с 5)
  getCardType: (number: string): 'visa' | 'mastercard' | null => {
    const clean = number.replace(/\D/g, '');
    if (clean.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(clean)) return 'mastercard';
    return null;
  }
};

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

// Переиспользуемый компонент поля ввода с отображением ошибок и иконок
const InputField: React.FC<InputFieldProps> = ({ label, error, icon, className = "", ...props }) => (
  <div className={`relative group ${className}`}>
    <div className="flex justify-between items-end mb-2">
       {/* Лейбл меняет цвет при фокусе, если нет ошибки */}
       <label className={`text-[9px] uppercase tracking-[0.2em] font-bold transition-colors ${error ? 'text-red-500' : 'text-gray-400 group-focus-within:text-primary'}`}>
         {label}
       </label>
       {/* Анимация появления ошибки */}
       {error && (
          <span className="text-[9px] uppercase tracking-wider text-red-500 font-mono animate-fade-in flex items-center gap-1">
            <AlertCircle size={10} /> {error}
          </span>
       )}
    </div>
    <div className="relative">
       <input
         {...props}
         className={`
            w-full bg-[#F8F9FA] border-b-2 p-3 font-mono text-base rounded-none
            focus:outline-none transition-all duration-300 placeholder:text-gray-300
            ${error 
              ? 'border-red-500 bg-red-50/10 text-red-900' // Стилизация ошибки
              : 'border-gray-200 text-primary focus:border-accent focus:bg-white' // Нормальное состояние
            }
         `}
       />
       {icon && (
         <div className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-red-400' : 'text-gray-300 group-focus-within:text-accent'}`}>
            {icon}
         </div>
       )}
    </div>
  </div>
);

// Компонент логотипов карт (затухают, если тип карты не совпадает)
const CardLogos = ({ activeType }: { activeType: 'visa' | 'mastercard' | null }) => (
  <div className="flex gap-3 opacity-80">
    <svg viewBox="0 0 48 48" className={`h-6 w-auto transition-all duration-500 ${!activeType || activeType === 'visa' ? 'opacity-100 grayscale-0' : 'opacity-30 grayscale'}`}>
      <path fill="#1A1F71" d="M21.7 20.8H18l-1.8 11.2h3.8l1.7-11.2zm8.9-10.9c-3.4 0-5.8 1.8-5.9 4.4 0 1.9 1.7 3 3 3.6 1.3.7 1.8 1.1 1.8 1.7 0 .9-1.1 1.3-2.1 1.3-1.4 0-2.2-.2-3.4-.7l-.5-.2-.5 3.3c.9.4 2.5.8 4.2.8 3.9 0 6.5-1.9 6.5-4.9 0-1.6-1-2.9-3.1-3.9-1-.5-1.7-.8-1.7-1.3 0-.5.5-1 1.7-1 .9 0 1.7.2 2.2.4l.3.1.4-3.4c-.8-.3-2.1-.5-2.9-.5zM38.8 20.8h-2.9c-.9 0-1.6.3-2 1.3l-5.7 13.6h4l.8-2.2h4.9l.5 2.2h3.5L38.8 20.8zm-4.7 9.1l2-5.5 1.1 5.5h-3.1zm-19-11l-3.9 10.3-.4-1.8c-.7-2.4-2.8-5-5.2-6.3l3.4 12.8h4.1l6.1-14.9h-4.1z"/>
    </svg>
    <svg viewBox="0 0 48 48" className={`h-6 w-auto transition-all duration-500 ${!activeType || activeType === 'mastercard' ? 'opacity-100 grayscale-0' : 'opacity-30 grayscale'}`}>
      <g fill="none" fillRule="evenodd">
        <rect width="48" height="48" fill="#FFFFFF" rx="4"/>
        <circle cx="16" cy="24" r="10" fill="#EB001B"/>
        <circle cx="32" cy="24" r="10" fill="#F79E1B"/>
        <path fill="#FF5F00" d="M24 18.2c-2.2 0-4.2.7-5.8 1.9 1.6 3.3 1.6 7.3 0 10.6 1.6 1.2 3.6 1.9 5.8 1.9 2.2 0 4.2-.7 5.8-1.9-1.6-3.3-1.6-7.3 0-10.6-1.6-1.2-3.6-1.9-5.8-1.9z"/>
      </g>
    </svg>
  </div>
);

// --- ГЛАВНЫЙ КОМПОНЕНТ СТРАНИЦЫ ---

const STEPS = ['details', 'shipping', 'payment'] as const;

const EMPTY_PAYMENT_SETTINGS: PaymentSettings = {
  recipientName: 'AM Publishing',
  visaPaymentUrl: '',
  mastercardPaymentUrl: '',
  cardholder: 'AM PUBLISHING',
  cardNumber: '',
  bankName: 'Revolut Bank UAB · BIC REVOLT21',
  iban: 'LT47 3250 0072 6895 2728',
  mirCardholder: '',
  mirCardNumber: '',
  mirBankName: '',
  whatsappNumber: '',
  telegramUsername: '',
  contactEmail: 'am.hybridpublishing@gmail.com',
  paymentNote: '',
  invoicePrefix: 'AM',
  webhookUrl: '',
  webhookLabel: '',
  notifyOnOrderCreated: false,
  notifyOnPaymentConfirmed: false,
};

const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const CheckoutPage: React.FC = () => {
  // Хуки приложения
  const { cart, region, t, clearCart, language } = useApp();
  const navigate = useNavigate();

  // Локальное состояние UI
  const [currentStep, setCurrentStep] = useState<typeof STEPS[number]>('details');
  const [isProcessing, setIsProcessing] = useState(false); // Состояние загрузки API
  const [isSuccess, setIsSuccess] = useState(false); // Успешное завершение
  const [orderId, setOrderId] = useState<string>('');
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(EMPTY_PAYMENT_SETTINGS);
  const [redirectCheckoutUrl, setRedirectCheckoutUrl] = useState<string>('');

  // Данные формы (Адрес, Контакты)
  const [formData, setFormData] = useState<CheckoutFormData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    zip: '',
    country: '',
    shippingMethod: 'standard',
    paymentMethod: 'visa'
  });

  // Состояние ошибок
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  const total = cart.reduce((sum, item) => sum + (item.variant.price * item.quantity), 0);
  const shippingCost = formData.shippingMethod === 'express' ? 15 : 5;
  const finalTotal = total + shippingCost;
  const visaUrl = paymentSettings.visaPaymentUrl || '';
  const mastercardUrl = paymentSettings.mastercardPaymentUrl || '';
  const canUseVisa = Boolean(visaUrl);
  const canUseMastercard = Boolean(mastercardUrl);

  const paymentProofMessage = useMemo(() => {
    const customerName = `${formData.firstName} ${formData.lastName}`.trim();
    return [
      `Order: ${orderId || 'pending'}`,
      `Amount: ${finalTotal.toFixed(2)} ${region.currency}`,
      `Customer: ${customerName || formData.email || 'Unknown customer'}`,
      `Please confirm the payment for this order.`,
    ].join('\n');
  }, [finalTotal, formData.email, formData.firstName, formData.lastName, orderId, region.currency]);

  const whatsappHref = paymentSettings.whatsappNumber
    ? `https://wa.me/${digitsOnly(paymentSettings.whatsappNumber)}?text=${encodeURIComponent(paymentProofMessage)}`
    : '';
  const telegramHref = paymentSettings.telegramUsername
    ? `https://t.me/${paymentSettings.telegramUsername.replace(/^@/, '')}`
    : '';
  const emailHref = paymentSettings.contactEmail
    ? `mailto:${paymentSettings.contactEmail}?subject=${encodeURIComponent(`Payment confirmation ${orderId || ''}`)}&body=${encodeURIComponent(paymentProofMessage)}`
    : '';

  useEffect(() => {
    api.getPaymentSettings().then(setPaymentSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (formData.paymentMethod === 'visa' && canUseVisa) return;
    if (formData.paymentMethod === 'mastercard' && canUseMastercard) return;
    if (formData.paymentMethod === 'invoice' || formData.paymentMethod === 'mir') return;

    const fallbackMethod = canUseVisa ? 'visa' : canUseMastercard ? 'mastercard' : 'invoice';
    setFormData(prev => ({ ...prev, paymentMethod: fallbackMethod }));
  }, [canUseMastercard, canUseVisa, formData.paymentMethod]);

  // Проверка валидности всей формы.
  // Используется для блокировки кнопки "Place Order".
  const isFormValid = useMemo(() => {
    if (currentStep !== 'payment') return true; // На первых шагах валидация через HTML5 (required)
    if (formData.paymentMethod === 'invoice' || formData.paymentMethod === 'mir') return true;
    if (formData.paymentMethod === 'visa') return canUseVisa;
    if (formData.paymentMethod === 'mastercard') return canUseMastercard;
    return true;
  }, [currentStep, formData.paymentMethod, canUseMastercard, canUseVisa]);

  // Переход к следующему шагу
  const handleNext = async (e: React.FormEvent) => {
     e.preventDefault();
     
     // Используем нативную валидацию браузера для простых полей
     const form = e.currentTarget.closest('form');
     if (form && !form.checkValidity()) {
       form.reportValidity();
       return;
     }

     if (currentStep === 'details') {
        setCurrentStep('shipping');
     } else if (currentStep === 'shipping') {
        setCurrentStep('payment');
     } else {
        await submitOrder();
     }
  };

  // Отправка заказа на сервер
  const submitOrder = async () => {
      if (formData.paymentMethod === 'visa' && !canUseVisa) {
          setPaymentError(t('checkout.visa_error'));
          return;
      }
      if (formData.paymentMethod === 'mastercard' && !canUseMastercard) {
          setPaymentError(t('checkout.mastercard_error'));
          return;
      }
      setIsProcessing(true);
      setPaymentError(null);

      try {
          const diagnostics = await collectOrderDiagnostics(region.id, language);
          const payload = {
              customer: formData,
              items: cart.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
              regionId: region.id,
              totalAmount: finalTotal,
              currency: region.currency,
              diagnostics,
          };

          const response = await api.submitOrder(payload);

          if (response.success && response.data) {
              setOrderId(response.data.orderId);
              const nextRedirectUrl =
                formData.paymentMethod === 'visa'
                  ? visaUrl
                  : formData.paymentMethod === 'mastercard'
                    ? mastercardUrl
                    : '';
              setRedirectCheckoutUrl(nextRedirectUrl);
              setIsSuccess(true);
              clearCart();
              if (nextRedirectUrl) {
                window.open(nextRedirectUrl, '_blank', 'noopener,noreferrer');
              }
          } else {
              throw new Error("Order submission failed");
          }
      } catch (err) {
          console.error(err);
          setPaymentError(t('checkout.payment_error'));
      } finally {
          setIsProcessing(false);
      }
  };

  // --- ОТРИСОВКА ---

  if (cart.length === 0 && !isSuccess) {
    return (
      <div className="pt-32 text-center bg-[#F4F4F0]">
        <p className="font-mono mb-4 text-gray-500 uppercase tracking-widest">{t('cart.empty')}</p>
        <Link to="/catalog" className="bg-primary text-white px-6 py-2 uppercase text-xs font-bold tracking-widest hover:bg-accent transition-colors">
            {t('cart.back_to_catalog')}
        </Link>
      </div>
    );
  }

  // Экран успешного заказа
  if (isSuccess) {
     return (
        <div className="bg-[#F4F4F0] pt-[80px] flex items-center justify-center p-6">
           <div className="bg-white p-12 max-w-lg w-full border border-primary text-center shadow-[20px_20px_0px_0px_rgba(4,15,30,0.05)] animate-fade-up">
              <div className="flex justify-center mb-8">
                 <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white">
                    <CheckCircle size={40} strokeWidth={1} />
                 </div>
              </div>
              <h2 className="text-5xl font-serif mb-4 text-primary">{t('checkout.success_title')}</h2>
              <p className="text-gray-500 mb-10 font-light text-lg">{t('checkout.success_desc')}</p>
              <div className="bg-[#F8F9FA] p-8 mb-8 border border-gray-100 font-mono text-sm text-left relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-2 text-gray-200"><ShieldCheck size={48} /></div>
                 <div className="flex justify-between mb-4 border-b border-gray-200 pb-4 relative z-10">
                    <span className="uppercase text-gray-400 tracking-widest text-[10px]">{t('checkout.order_id')}</span>
                    <span className="font-bold text-primary">#{orderId}</span>
                 </div>
                 <div className="flex justify-between pt-2 relative z-10">
                    <span className="uppercase text-gray-400 tracking-widest text-[10px]">{t('checkout.total_paid')}</span>
                    <span className="font-bold text-primary">{finalTotal.toFixed(2)} {region.currency}</span>
                 </div>
              </div>
              {formData.paymentMethod === 'visa' || formData.paymentMethod === 'mastercard' ? (
                <div className="mb-8 border border-primary bg-[#F8F9FA] p-6 text-left space-y-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400">
                    {formData.paymentMethod === 'visa' ? t('checkout.visa_title') : t('checkout.mastercard_title')}
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {formData.paymentMethod === 'visa' ? t('checkout.visa_success_note') : t('checkout.mastercard_success_note')}
                  </p>
                  {redirectCheckoutUrl ? (
                    <a href={redirectCheckoutUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center border border-primary bg-primary text-white px-6 py-4 text-xs uppercase tracking-[0.18em] font-bold hover:bg-accent transition-colors">
                      {formData.paymentMethod === 'visa' ? t('checkout.visa_cta') : t('checkout.mastercard_cta')}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {formData.paymentMethod === 'invoice' || formData.paymentMethod === 'mir' ? (
                <div className="mb-8 border border-primary bg-[#F8F9FA] p-6 text-left space-y-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400">{t('checkout.payment_transfer_title')}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{paymentSettings.paymentNote || t('checkout.success_payment_pending')}</p>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    {paymentSettings.recipientName ? <div><span className="font-mono text-[10px] uppercase text-gray-400">{t('checkout.payment_recipient')}</span><div>{paymentSettings.recipientName}</div></div> : null}
                    {formData.paymentMethod === 'invoice' && paymentSettings.cardholder ? <div><span className="font-mono text-[10px] uppercase text-gray-400">{t('checkout.payment_cardholder')}</span><div>{paymentSettings.cardholder}</div></div> : null}
                    {formData.paymentMethod === 'invoice' && paymentSettings.cardNumber ? <div><span className="font-mono text-[10px] uppercase text-gray-400">{t('checkout.payment_card_number')}</span><div className="font-mono text-primary">{paymentSettings.cardNumber}</div></div> : null}
                    {formData.paymentMethod === 'invoice' && paymentSettings.bankName ? <div><span className="font-mono text-[10px] uppercase text-gray-400">{t('checkout.payment_bank')}</span><div>{paymentSettings.bankName}</div></div> : null}
                    {formData.paymentMethod === 'invoice' && paymentSettings.iban ? <div><span className="font-mono text-[10px] uppercase text-gray-400">{t('checkout.payment_iban')}</span><div className="font-mono text-primary break-all">{paymentSettings.iban}</div></div> : null}
                    {formData.paymentMethod === 'mir' && paymentSettings.mirCardholder ? <div><span className="font-mono text-[10px] uppercase text-gray-400">{t('checkout.mir_cardholder')}</span><div>{paymentSettings.mirCardholder}</div></div> : null}
                    {formData.paymentMethod === 'mir' && paymentSettings.mirCardNumber ? <div><span className="font-mono text-[10px] uppercase text-gray-400">{t('checkout.mir_card_number')}</span><div className="font-mono text-primary">{paymentSettings.mirCardNumber}</div></div> : null}
                    {formData.paymentMethod === 'mir' && paymentSettings.mirBankName ? <div><span className="font-mono text-[10px] uppercase text-gray-400">{t('checkout.mir_bank')}</span><div>{paymentSettings.mirBankName}</div></div> : null}
                    <div><span className="font-mono text-[10px] uppercase text-gray-400">{t('checkout.payment_reference')}</span><div className="font-mono text-primary">{orderId}</div></div>
                  </div>
                  <div className="pt-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">{t('checkout.payment_send_proof')}</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex-1 border border-primary bg-primary text-white px-4 py-3 text-center text-xs uppercase tracking-[0.18em] font-bold hover:bg-accent transition-colors">{t('checkout.payment_send_whatsapp')}</a> : null}
                      {telegramHref ? <a href={telegramHref} target="_blank" rel="noopener noreferrer" className="flex-1 border border-primary px-4 py-3 text-center text-xs uppercase tracking-[0.18em] font-bold hover:bg-primary hover:text-white transition-colors">{t('checkout.payment_send_telegram')}</a> : null}
                      {emailHref ? <a href={emailHref} className="flex-1 border border-primary px-4 py-3 text-center text-xs uppercase tracking-[0.18em] font-bold hover:bg-primary hover:text-white transition-colors">{t('checkout.payment_send_email')}</a> : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <button onClick={() => navigate('/')} className="w-full bg-primary text-white py-4 uppercase font-bold text-xs tracking-[0.2em] hover:bg-accent transition-colors">
                 Back to Home
              </button>
           </div>
        </div>
     );
  }

  return (
    <div className="bg-[#F4F4F0] pt-[60px] md:pt-[80px]">
       
       <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-80px)]">
          
          {/* МОБИЛЬНОЕ РЕЗЮМЕ ЗАКАЗА (Sticky Header для мобильных) */}
          <div className="lg:hidden border-b border-primary bg-[#E8EDF2] sticky top-[60px] z-20">
             <button 
                onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
                className="w-full flex justify-between items-center p-4"
             >
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-bold">
                   <ShoppingBag size={16} />
                   <span>{mobileSummaryOpen ? 'Hide Summary' : 'Show Order Summary'}</span>
                   {mobileSummaryOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                <span className="font-mono font-bold text-lg">{finalTotal.toFixed(2)} {region.currency}</span>
             </button>
             
             {mobileSummaryOpen && (
                <div className="p-4 border-t border-primary/10 animate-fade-in bg-[#E8EDF2]">
                   <div className="space-y-4 mb-4">
                      {cart.map(item => (
                         <div key={item.variantId} className="flex justify-between items-start text-sm">
                            <div className="flex gap-3">
                               <span className="font-mono text-xs">{item.quantity}x</span>
                               <div>
                                  <p className="font-serif leading-none mb-1">{item.title}</p>
                                  <p className="text-[10px] uppercase text-gray-500">{formatLabel(item.variant.format, language)}</p>
                               </div>
                            </div>
                            <span className="font-mono">{(item.variant.price * item.quantity).toFixed(2)}</span>
                         </div>
                      ))}
                   </div>
                </div>
             )}
          </div>

          {/* ЛЕВАЯ КОЛОНКА: ФОРМА ОФОРМЛЕНИЯ */}
          <div className="lg:col-span-7 bg-white p-6 md:p-12 lg:p-20 border-r border-primary">
             
             {/* Заголовок с шагами */}
             <div className="mb-12 md:mb-16">
                <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-4">
                   {STEPS.map((step, i) => (
                      <React.Fragment key={step}>
                         <div className={`flex items-center gap-2 ${currentStep === step ? 'text-primary font-bold' : ''}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors duration-500 ${currentStep === step ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>
                               {i + 1}
                            </span>
                            <span className="hidden sm:inline">{t(`checkout.${step === 'details' ? 'step1' : step === 'shipping' ? 'step2' : 'step3'}`)}</span>
                         </div>
                         {i < 2 && <div className="flex-1 h-[1px] bg-gray-100 min-w-[20px]"></div>}
                      </React.Fragment>
                   ))}
                </div>
                <h1 className="text-4xl md:text-5xl font-serif text-primary">
                  {t(`checkout.${currentStep === 'details' ? 'step1' : currentStep === 'shipping' ? 'step2' : 'step3'}`)}
                </h1>
             </div>

             <form className="max-w-2xl mx-auto lg:mx-0">
                
                {/* --- ШАГ 1: ЛИЧНЫЕ ДАННЫЕ --- */}
                {currentStep === 'details' && (
                   <div className="space-y-8 animate-fade-in">
                      <div className="grid grid-cols-2 gap-6">
                         <InputField 
                            label={t('checkout.firstName')}
                            value={formData.firstName}
                            onChange={e => setFormData({...formData, firstName: e.target.value})}
                            required
                            placeholder="John"
                            icon={<User size={14} />}
                         />
                         <InputField 
                            label={t('checkout.lastName')}
                            value={formData.lastName}
                            onChange={e => setFormData({...formData, lastName: e.target.value})}
                            required
                            placeholder="Doe"
                         />
                      </div>

                      <InputField 
                         label={t('checkout.email')}
                         type="email"
                         value={formData.email}
                         onChange={e => setFormData({...formData, email: e.target.value})}
                         required
                         placeholder="john@example.com"
                      />

                      <InputField
                         label={t('checkout.phone')}
                         type="tel"
                         value={formData.phone}
                         onChange={e => setFormData({...formData, phone: e.target.value})}
                         placeholder="+49 ..."
                      />

                      <InputField 
                         label={t('checkout.address')}
                         value={formData.address}
                         onChange={e => setFormData({...formData, address: e.target.value})}
                         required
                         placeholder="Street, House No."
                         icon={<MapPin size={14} />}
                      />

                      <div className="grid grid-cols-6 gap-6">
                         <div className="col-span-3">
                            <InputField 
                                label={t('checkout.city')}
                                value={formData.city}
                                onChange={e => setFormData({...formData, city: e.target.value})}
                                required
                                placeholder="Berlin"
                            />
                         </div>
                         <div className="col-span-3">
                            <InputField 
                                label={t('checkout.zip')}
                                value={formData.zip}
                                onChange={e => setFormData({...formData, zip: e.target.value})}
                                required
                                placeholder="10115"
                            />
                         </div>
                         <div className="col-span-6">
                            <InputField 
                                label={t('checkout.country')}
                                value={formData.country}
                                onChange={e => setFormData({...formData, country: e.target.value})}
                                required
                                placeholder="Germany"
                            />
                         </div>
                      </div>
                   </div>
                )}

                {/* --- ШАГ 2: ДОСТАВКА --- */}
                {currentStep === 'shipping' && (
                   <div className="space-y-6 animate-fade-in">
                      {['standard', 'express'].map((method) => (
                         <label key={method} className={`relative flex items-center justify-between p-6 md:p-8 border cursor-pointer transition-all duration-300 group ${formData.shippingMethod === method ? 'border-primary bg-[#F8F9FA] shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                            <div className="flex items-center gap-6">
                               <div className={`w-5 h-5 rounded-full border border-primary flex items-center justify-center bg-white transition-all ${formData.shippingMethod === method ? 'scale-110' : ''}`}>
                                  {formData.shippingMethod === method && <div className="w-2.5 h-2.5 bg-primary rounded-full animate-fade-in"></div>}
                               </div>
                               <div>
                                  <div className="flex items-center gap-3">
                                     <span className="block font-serif text-2xl">{t(`checkout.${method}`)}</span>
                                     {method === 'express' && <Truck size={16} className="text-accent" />}
                                  </div>
                                  <span className="text-[10px] uppercase tracking-widest text-gray-500">{t(`checkout.est_${method}`)}</span>
                               </div>
                            </div>
                            <span className="font-mono text-lg font-bold">
                                {method === 'standard' ? '5.00' : '15.00'} {region.currency}
                            </span>
                            <input 
                                type="radio" 
                                name="shipping" 
                                value={method} 
                                checked={formData.shippingMethod === method} 
                                onChange={() => setFormData({...formData, shippingMethod: method as any})} 
                                className="hidden" 
                            />
                         </label>
                      ))}
                   </div>
                )}

                {/* --- ШАГ 3: ОПЛАТА --- */}
                {currentStep === 'payment' && (
                   <div className="space-y-8 animate-fade-in">
                      
                      {/* Переключатель метода оплаты */}
                      <div className="grid grid-cols-1 md:grid-cols-4 border border-primary">
                         <button 
                            type="button"
                            onClick={() => canUseVisa && setFormData({...formData, paymentMethod: 'visa'})}
                            className={`py-4 text-xs uppercase tracking-[0.2em] font-bold transition-colors border-b md:border-b-0 md:border-r border-primary ${formData.paymentMethod === 'visa' ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-400 hover:text-primary'} ${!canUseVisa ? 'opacity-40 cursor-not-allowed' : ''}`}
                            disabled={!canUseVisa}
                         >
                            {t('checkout.visa')}
                         </button>
                         <button 
                             type="button"
                             onClick={() => canUseMastercard && setFormData({...formData, paymentMethod: 'mastercard'})}
                             className={`py-4 text-xs uppercase tracking-[0.2em] font-bold transition-colors border-b md:border-b-0 md:border-r border-primary ${formData.paymentMethod === 'mastercard' ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-400 hover:text-primary'} ${!canUseMastercard ? 'opacity-40 cursor-not-allowed' : ''}`}
                             disabled={!canUseMastercard}
                         >
                            {t('checkout.mastercard')}
                         </button>
                         <button
                             type="button"
                             onClick={() => setFormData({...formData, paymentMethod: 'invoice'})}
                             className={`py-4 text-xs uppercase tracking-[0.2em] font-bold transition-colors border-b md:border-b-0 md:border-r border-primary ${formData.paymentMethod === 'invoice' ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-400 hover:text-primary'}`}
                         >
                            {t('checkout.invoice')}
                         </button>
                         <button 
                             type="button"
                             onClick={() => setFormData({...formData, paymentMethod: 'mir'})}
                             className={`py-4 text-xs uppercase tracking-[0.2em] font-bold transition-colors ${formData.paymentMethod === 'mir' ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-400 hover:text-primary'}`}
                         >
                            {t('checkout.mir')}
                         </button>
                      </div>

                      {(formData.paymentMethod === 'visa' || formData.paymentMethod === 'mastercard') && (
                        <div className="bg-[#F8F9FA] border border-gray-200 p-10 md:p-12 animate-fade-in">
                          <div className="flex items-center justify-between gap-4 mb-6">
                            <p className="text-gray-500 font-mono text-sm">
                              {formData.paymentMethod === 'visa' ? t('checkout.visa_desc') : t('checkout.mastercard_desc')}
                            </p>
                            <CardLogos activeType={formData.paymentMethod === 'visa' ? 'visa' : 'mastercard'} />
                          </div>
                          {((formData.paymentMethod === 'visa' && visaUrl) || (formData.paymentMethod === 'mastercard' && mastercardUrl)) ? (
                            <a href={formData.paymentMethod === 'visa' ? visaUrl : mastercardUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center border border-primary bg-primary text-white px-6 py-4 text-xs uppercase tracking-[0.18em] font-bold hover:bg-accent transition-colors">
                              {formData.paymentMethod === 'visa' ? t('checkout.visa_cta') : t('checkout.mastercard_cta')}
                            </a>
                          ) : (
                            <p className="text-sm text-red-500">{formData.paymentMethod === 'visa' ? t('checkout.visa_error') : t('checkout.mastercard_error')}</p>
                          )}
                        </div>
                      )}

                      {formData.paymentMethod === 'invoice' && (
                      <div className="bg-[#F8F9FA] border border-gray-200 p-12 text-center animate-fade-in">
                          <p className="text-gray-500 font-mono text-sm mb-6">{t('checkout.invoice_desc')}</p>
                          <div className="w-16 h-16 mx-auto bg-gray-200 text-gray-500 rounded-full flex items-center justify-center">
                              <FileText size={32} />
                          </div>
                          <div className="mt-8 max-w-xl mx-auto text-left border border-primary/10 bg-white p-6 space-y-3">
                            {paymentSettings.recipientName ? <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{t('checkout.payment_recipient')}</p><p className="text-sm text-primary">{paymentSettings.recipientName}</p></div> : null}
                            {paymentSettings.cardholder ? <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{t('checkout.payment_cardholder')}</p><p className="text-sm text-primary">{paymentSettings.cardholder}</p></div> : null}
                            {paymentSettings.cardNumber ? <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{t('checkout.payment_card_number')}</p><p className="text-sm font-mono text-primary break-all">{paymentSettings.cardNumber}</p></div> : null}
                            {paymentSettings.bankName ? <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{t('checkout.payment_bank')}</p><p className="text-sm text-primary">{paymentSettings.bankName}</p></div> : null}
                            {paymentSettings.iban ? <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{t('checkout.payment_iban')}</p><p className="text-sm font-mono text-primary break-all">{paymentSettings.iban}</p></div> : null}
                          </div>
                          <div className="mt-8 text-left max-w-xl mx-auto">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-4">{t('checkout.invoice_steps_title')}</p>
                            <div className="space-y-3 text-sm text-gray-600">
                              <p>1. {t('checkout.invoice_step_1')}</p>
                              <p>2. {t('checkout.invoice_step_2')}</p>
                              <p>3. {t('checkout.invoice_step_3')}</p>
                            </div>
                          </div>
                      </div>
                  )}

                      {formData.paymentMethod === 'mir' && (
                      <div className="bg-[#F8F9FA] border border-gray-200 p-12 text-center animate-fade-in">
                          <p className="text-gray-500 font-mono text-sm mb-6">{t('checkout.mir_desc')}</p>
                          <div className="mt-8 max-w-xl mx-auto text-left border border-primary/10 bg-white p-6 space-y-3">
                            {paymentSettings.recipientName ? <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{t('checkout.payment_recipient')}</p><p className="text-sm text-primary">{paymentSettings.recipientName}</p></div> : null}
                            {paymentSettings.mirCardholder ? <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{t('checkout.mir_cardholder')}</p><p className="text-sm text-primary">{paymentSettings.mirCardholder}</p></div> : null}
                            {paymentSettings.mirCardNumber ? <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{t('checkout.mir_card_number')}</p><p className="text-sm font-mono text-primary break-all">{paymentSettings.mirCardNumber}</p></div> : null}
                            {paymentSettings.mirBankName ? <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{t('checkout.mir_bank')}</p><p className="text-sm text-primary">{paymentSettings.mirBankName}</p></div> : null}
                          </div>
                          <div className="mt-8 text-left max-w-xl mx-auto">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-4">{t('checkout.invoice_steps_title')}</p>
                            <div className="space-y-3 text-sm text-gray-600">
                              <p>1. {t('checkout.invoice_step_1')}</p>
                              <p>2. {t('checkout.mir_step_2')}</p>
                              <p>3. {t('checkout.invoice_step_3')}</p>
                            </div>
                          </div>
                      </div>
                  )}

                  <div className="bg-[#F8F9FA] border border-gray-200 p-6 animate-fade-in">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">{t('checkout.payment_method')}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{t('checkout.payment_note')}</p>
                    <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-accent">{t('checkout.payment_timeline')}</p>
                  </div>
               </div>
                )}

                {/* НАВИГАЦИЯ ПО ФОРМЕ */}
                <div className="flex justify-between items-center mt-12 pt-8 border-t border-gray-100">
                   <button type="button" onClick={() => currentStep === 'details' ? navigate('/cart') : setCurrentStep(currentStep === 'shipping' ? 'details' : 'shipping')} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] hover:text-accent transition-colors group">
                      <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> {t('checkout.back')}
                   </button>
                   <button 
                     type="button"
                     onClick={handleNext}
                     disabled={isProcessing || (currentStep === 'payment' && !isFormValid)}
                     className={`
                        bg-primary text-white px-10 py-5 uppercase font-bold text-xs tracking-[0.2em] 
                        hover:bg-accent hover:text-white transition-all flex items-center gap-4 group shadow-lg
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                     `}
                   >
                      {isProcessing ? t('checkout.processing') : currentStep === 'payment' ? t('checkout.place_order') : t('checkout.next')}
                      {!isProcessing && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                   </button>
                </div>
             </form>
          </div>

          {/* ПРАВАЯ КОЛОНКА: ИТОГ ЗАКАЗА (Десктоп) */}
          <div className="hidden lg:block lg:col-span-5 bg-[#F4F4F0] p-6 md:p-12 border-t lg:border-t-0 border-primary sticky top-[80px] h-fit">
             <div className="mb-8 pb-4 border-b border-primary/20 flex justify-between items-end">
                <h3 className="font-serif text-3xl">{t('cart.summary')}</h3>
                <span className="font-mono text-xs text-gray-400">{t('catalog.items_count', { count: cart.length })}</span>
             </div>
             
             <div className="space-y-6 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {cart.map(item => (
                   <div key={item.variantId} className="flex gap-4 items-start group">
                      <div className="w-14 h-20 border border-primary bg-white flex-shrink-0 overflow-hidden">
                         <img src={item.coverUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                         <h4 className="font-serif text-lg leading-none mb-1 truncate">{item.title}</h4>
                         <p className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">{item.author}</p>
                         <p className="text-[10px] uppercase text-gray-400">{formatLabel(item.variant.format, language)} / x{item.quantity}</p>
                      </div>
                      <div className="font-mono text-sm font-bold">
                         {(item.variant.price * item.quantity).toFixed(2)}
                      </div>
                   </div>
                ))}
             </div>
             
             <div className="bg-white p-6 border border-primary/10 space-y-3 font-mono text-sm uppercase">
                <div className="flex justify-between text-gray-500">
                   <span>{t('cart.summary')}</span>
                   <span>{total.toFixed(2)} {region.currency}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                   <span>{t('cart.delivery')}</span>
                   <span>{currentStep === 'details' ? '--' : shippingCost.toFixed(2)} {region.currency}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-4 border-t border-dashed border-gray-300 mt-4 text-primary">
                   <span>{t('cart.total')}</span>
                   <span>{currentStep === 'details' ? total.toFixed(2) : finalTotal.toFixed(2)} {region.currency}</span>
                </div>
             </div>
             
             <div className="mt-8 text-center opacity-60">
                <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400 mb-2">{t('checkout.we_accept')}</p>
                <div className="flex justify-center">
                    <CardLogos activeType={null} />
                </div>
             </div>
          </div>

       </div>
    </div>
  );
};
