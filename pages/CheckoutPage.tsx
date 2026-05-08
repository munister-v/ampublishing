
import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { CheckoutFormData } from '../types';
import { api } from '../services/api';
import { 
  CheckCircle, ArrowRight, ChevronLeft, Lock, AlertCircle, 
  ShieldCheck, CreditCard, ChevronDown, ChevronUp, ShoppingBag, 
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

export const CheckoutPage: React.FC = () => {
  // Хуки приложения
  const { cart, region, t, clearCart } = useApp();
  const navigate = useNavigate();

  // Локальное состояние UI
  const [currentStep, setCurrentStep] = useState<typeof STEPS[number]>('details');
  const [isProcessing, setIsProcessing] = useState(false); // Состояние загрузки API
  const [isSuccess, setIsSuccess] = useState(false); // Успешное завершение
  const [orderId, setOrderId] = useState<string>('');
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

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
    paymentMethod: 'card' // Stripe default
  });

  // Отдельное состояние для данных карты (не отправляется на сервер в чистом виде в реальном приложении)
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: ''
  });

  // Состояние ошибок
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Вычисляемые значения (Memoized)
  const cardType = useMemo(() => PaymentUtils.getCardType(cardData.number), [cardData.number]);
  
  const total = cart.reduce((sum, item) => sum + (item.variant.price * item.quantity), 0);
  const shippingCost = formData.shippingMethod === 'express' ? 15 : 5;
  const finalTotal = total + shippingCost;

  // Проверка валидности всей формы.
  // Используется для блокировки кнопки "Place Order".
  const isFormValid = useMemo(() => {
    if (currentStep !== 'payment') return true; // На первых шагах валидация через HTML5 (required)
    // No card validation if paying by Invoice or PayPal
    if (formData.paymentMethod === 'paypal' || formData.paymentMethod === 'invoice') return true;

    // Проверяем наличие ошибок в объекте errors и заполненность полей
    const hasErrors = Object.values(errors).some(err => !!err);
    const hasEmptyFields = !cardData.number || !cardData.expiry || !cardData.cvc || !cardData.name;
    const isLuhnValid = PaymentUtils.validateCardNumber(cardData.number);
    const isExpValid = PaymentUtils.validateExpiry(cardData.expiry);

    return !hasErrors && !hasEmptyFields && isLuhnValid && isExpValid;
  }, [currentStep, formData.paymentMethod, errors, cardData]);

  // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

  // Обработка ввода данных карты с автоматическим форматированием
  const handleCardChange = (field: keyof typeof cardData, value: string) => {
    let formatted = value;
    if (field === 'number') formatted = PaymentUtils.formatCardNumber(value);
    if (field === 'expiry') formatted = PaymentUtils.formatExpiry(value);
    if (field === 'cvc') formatted = value.replace(/\D/g, '').slice(0, 4);
    if (field === 'name') formatted = value.toUpperCase();

    setCardData(prev => ({ ...prev, [field]: formatted }));
    
    // Очищаем ошибку при вводе для улучшения UX
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    setPaymentError(null);
  };

  // Валидация при потере фокуса (onBlur)
  const handleBlur = (field: keyof typeof cardData) => {
    let error = '';
    const val = cardData[field];

    switch(field) {
        case 'number':
            if (val.replace(/\s/g, '').length < 13) error = 'Неполный номер';
            else if (!PaymentUtils.validateCardNumber(val)) error = 'Неверный номер карты';
            break;
        case 'expiry':
            if (!PaymentUtils.validateExpiry(val)) error = 'Неверная дата';
            break;
        case 'cvc':
            if (val.length < 3) error = 'Мин. 3 цифры';
            break;
        case 'name':
            if (val.trim().length < 3) error = 'Обязательное поле';
            break;
    }

    setErrors(prev => ({ ...prev, [field]: error }));
  };

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
      // Финальная проверка перед отправкой
      if (formData.paymentMethod === 'card' && !isFormValid) {
          handleBlur('number');
          handleBlur('expiry');
          handleBlur('cvc');
          handleBlur('name');
          return;
      }

      setIsProcessing(true);
      setPaymentError(null);

      try {
          const payload = {
              customer: formData,
              items: cart.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
              regionId: region.id,
              totalAmount: finalTotal,
              currency: region.currency
          };

          const response = await api.submitOrder(payload);

          if (response.success && response.data) {
              setOrderId(response.data.orderId);
              setIsSuccess(true);
              clearCart();
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
      <div className="pt-32 text-center min-h-screen bg-[#F4F4F0]">
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
        <div className="min-h-screen bg-[#F4F4F0] pt-[80px] flex items-center justify-center p-6">
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
              <button onClick={() => navigate('/')} className="w-full bg-primary text-white py-4 uppercase font-bold text-xs tracking-[0.2em] hover:bg-accent transition-colors">
                 Back to Home
              </button>
           </div>
        </div>
     );
  }

  return (
    <div className="bg-[#F4F4F0] min-h-screen pt-[60px] md:pt-[80px]">
       
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
                                  <p className="text-[10px] uppercase text-gray-500">{item.variant.format}</p>
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
                      <div className="grid grid-cols-1 md:grid-cols-3 border border-primary">
                         <button 
                            type="button"
                            onClick={() => setFormData({...formData, paymentMethod: 'card'})}
                            className={`py-4 text-xs uppercase tracking-[0.2em] font-bold transition-colors border-b md:border-b-0 md:border-r border-primary ${formData.paymentMethod === 'card' ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-400 hover:text-primary'}`}
                         >
                            {t('checkout.card')}
                         </button>
                         <button 
                             type="button"
                             onClick={() => setFormData({...formData, paymentMethod: 'paypal'})}
                             className={`py-4 text-xs uppercase tracking-[0.2em] font-bold transition-colors border-b md:border-b-0 md:border-r border-primary ${formData.paymentMethod === 'paypal' ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-400 hover:text-primary'}`}
                         >
                            {t('checkout.paypal')}
                         </button>
                         <button 
                             type="button"
                             onClick={() => setFormData({...formData, paymentMethod: 'invoice'})}
                             className={`py-4 text-xs uppercase tracking-[0.2em] font-bold transition-colors ${formData.paymentMethod === 'invoice' ? 'bg-primary text-white' : 'hover:bg-gray-50 text-gray-400 hover:text-primary'}`}
                         >
                            {t('checkout.invoice')}
                         </button>
                      </div>

                      {/* ПОЛЯ ДЛЯ КАРТЫ */}
                      {formData.paymentMethod === 'card' && (
                          <div className="bg-[#F8F9FA] border border-gray-200 p-8 md:p-10 relative mt-8">
                              <div className="flex justify-between items-center mb-8">
                                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-400">
                                      <Lock size={12} />
                                      {t('checkout.secure_notice')}
                                  </div>
                                  <CardLogos activeType={cardType} />
                              </div>
                              
                              <div className="space-y-6">
                                  <InputField 
                                      label={t('checkout.cc_number')}
                                      placeholder="0000 0000 0000 0000"
                                      maxLength={19}
                                      value={cardData.number}
                                      onChange={e => handleCardChange('number', e.target.value)}
                                      onBlur={() => handleBlur('number')}
                                      error={errors.number}
                                      icon={<CreditCard size={16}/>}
                                      className="bg-white"
                                  />
                                  
                                  <InputField 
                                      label={t('checkout.cc_holder')}
                                      placeholder={t('checkout.cc_holder_ph')}
                                      value={cardData.name}
                                      onChange={e => handleCardChange('name', e.target.value)}
                                      onBlur={() => handleBlur('name')}
                                      error={errors.name}
                                      className="bg-white"
                                  />

                                  <div className="grid grid-cols-2 gap-6">
                                      <InputField 
                                          label={t('checkout.cc_expiry')}
                                          placeholder="MM/YY"
                                          maxLength={5}
                                          value={cardData.expiry}
                                          onChange={e => handleCardChange('expiry', e.target.value)}
                                          onBlur={() => handleBlur('expiry')}
                                          error={errors.expiry}
                                          className="bg-white"
                                      />
                                      <InputField 
                                          label={t('checkout.cc_cvc')}
                                          placeholder="CVC"
                                          maxLength={4}
                                          type="tel" 
                                          value={cardData.cvc}
                                          onChange={e => handleCardChange('cvc', e.target.value)}
                                          onBlur={() => handleBlur('cvc')}
                                          error={errors.cvc}
                                          icon={<Lock size={14}/>}
                                          className="bg-white"
                                      />
                                  </div>
                              </div>
                              
                              {paymentError && (
                                <div className="mt-6 bg-red-50 border border-red-200 text-red-600 p-4 flex items-center gap-3 animate-fade-in">
                                   <AlertCircle size={16} />
                                   <span className="text-[10px] font-bold uppercase tracking-widest">{paymentError}</span>
                                </div>
                              )}
                          </div>
                      )}
                      
                      {/* PAYPAL ЗАГЛУШКА */}
                      {formData.paymentMethod === 'paypal' && (
                          <div className="bg-[#F8F9FA] border border-gray-200 p-12 text-center animate-fade-in">
                              <p className="text-gray-500 font-mono text-sm mb-6">{t('checkout.paypal_desc')}</p>
                              <div className="w-12 h-12 mx-auto bg-[#003087] text-white rounded-full flex items-center justify-center font-bold italic font-serif text-xl">
                                  P
                              </div>
                          </div>
                      )}

                      {/* INVOICE ЗАГЛУШКА */}
                      {formData.paymentMethod === 'invoice' && (
                          <div className="bg-[#F8F9FA] border border-gray-200 p-12 text-center animate-fade-in">
                              <p className="text-gray-500 font-mono text-sm mb-6">{t('checkout.invoice_desc')}</p>
                              <div className="w-16 h-16 mx-auto bg-gray-200 text-gray-500 rounded-full flex items-center justify-center">
                                  <FileText size={32} />
                              </div>
                          </div>
                      )}
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
                <span className="font-mono text-xs text-gray-400">{cart.length} ITEMS</span>
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
                         <p className="text-[10px] uppercase text-gray-400">{item.variant.format} / x{item.quantity}</p>
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
