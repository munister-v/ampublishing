
import React, { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Minus, Plus, ArrowLeft, AlertCircle, ExternalLink } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { BookVariant, Format, PurchaseLink } from '../types';
import { formatLabel } from '../utils/formatLabel';
import { getActivePurchaseLinks, getShopifyPurchaseLink, isShopifyPurchaseLink } from '../utils/purchaseLinks';
import { buildShopifyCartUrl, getShopifyLinkForBook } from '../utils/shopify';
import { fetchVariantStates, isStorefrontConfigured, type VariantState } from '../services/shopifyStorefront';
import { analytics } from '../services/analytics';
import { toGenitiveRu } from '../utils/declension';
import { findBookByRouteId, getBookPath, isAliasRoute } from '../utils/bookRoutes';
import { BookSpread } from '../components/BookSpread';

export const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addToCart, region, t, addRecentlyViewed, books, language, integrations } = useApp();
  const book = findBookByRouteId(books, id);
  const [qty, setQty] = useState(1);
  const relatedBooks = book ? books.filter(b => b.genre[0] === book.genre[0] && b.id !== book.id).slice(0, 4) : [];
  
  // Variant Logic
  const [selectedFormat, setSelectedFormat] = useState<Format | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [currentVariant, setCurrentVariant] = useState<BookVariant | null>(null);
  // Живые цена и наличие из Shopify (если подключён Storefront API).
  const [shopifyState, setShopifyState] = useState<VariantState | null>(null);

  useEffect(() => {
    if (book) {
      addRecentlyViewed(book);
      // Default selection
      if (book.variants.length > 0) {
        const defaultVar = book.variants[0];
        setSelectedFormat(defaultVar.format);
        setSelectedLanguage(defaultVar.language);
        setCurrentVariant(defaultVar);
      }
    }
  }, [book, id]);

  useEffect(() => {
    if (book && selectedFormat && selectedLanguage) {
      const v = book.variants.find(v => v.format === selectedFormat && v.language === selectedLanguage);
      setCurrentVariant(v || null);
    }
  }, [selectedFormat, selectedLanguage, book]);

  useEffect(() => {
    const shopify = integrations?.shopify;
    const link = book ? getShopifyLinkForBook(shopify, book.id) : null;
    if (!shopify || !link || !isStorefrontConfigured(shopify)) {
      setShopifyState(null);
      return;
    }
    let alive = true;
    fetchVariantStates(shopify, [link.variantId])
      .then(states => { if (alive) setShopifyState(states[link.variantId.replace(/\D/g, '')] || null); })
      .catch(error => { console.warn('[shopify] не удалось получить цену', error); });
    return () => { alive = false; };
  }, [integrations, book?.id]);

  if (!book) return <div className="pt-32 text-center font-mono uppercase">{t('product.not_found')}</div>;
  if (isAliasRoute(book, id)) return <Navigate to={getBookPath(book)} replace />;

  // Shopify: сначала прямая привязка книги к варианту товара (админка →
  // Интеграции → Shopify), затем — старая ручная ссылка в purchaseLinks.
  const shopifyProduct = getShopifyLinkForBook(integrations?.shopify, book.id);
  const shopifyCartUrl = shopifyProduct && integrations
    ? buildShopifyCartUrl(integrations.shopify, shopifyProduct.variantId, qty)
    : null;
  const shopifyLink = shopifyCartUrl
    ? { id: 'shopify', label: 'Shopify', url: shopifyCartUrl }
    : getShopifyPurchaseLink(book);
  const secondaryPurchaseLinks = getActivePurchaseLinks(book).filter((link): link is PurchaseLink => !isShopifyPurchaseLink(link));
  const availableFormats = Array.from(new Set(book.variants.map(v => v.format))) as Format[];
  
  // Get languages available for the currently selected format
  const availableLanguages = selectedFormat 
    ? Array.from(new Set(book.variants.filter(v => v.format === selectedFormat).map(v => v.language)))
    : [];

  const handleFormatChange = (newFormat: Format) => {
    setSelectedFormat(newFormat);
    // Smart language selection: try to keep current language, else pick first available
    const newLangs = Array.from(new Set(book.variants.filter(v => v.format === newFormat).map(v => v.language)));
    if (selectedLanguage && newLangs.includes(selectedLanguage)) {
        // Keep current
    } else if (newLangs.length > 0) {
        setSelectedLanguage(newLangs[0]);
    } else {
        setSelectedLanguage(null);
    }
  };

  const handleAddToCart = () => {
    if (currentVariant && currentVariant.stock > 0) {
      if (shopifyLink) {
        analytics.shopifyBuyClick(book.id, shopifyProduct?.variantId || shopifyLink.url);
        window.location.assign(shopifyLink.url);
        return;
      }
      addToCart(book, currentVariant, qty);
    }
  };

  // Pricing / availability
  const effectivePrice = currentVariant ? currentVariant.price : book.price;
  const isPurchasable = effectivePrice > 0;
  const effectiveStock = currentVariant ? currentVariant.stock : book.stock;
  const inStock = effectiveStock > 0;

  // Build a compact, data-driven spec list (only real values are shown)
  const specs: { label: string; value: string }[] = [
    { label: t('product.details.year'), value: String(book.details.year || '') },
    { label: t('product.details.pages'), value: book.details.pages ? String(book.details.pages) : '' },
    { label: t('product.format'), value: currentVariant ? formatLabel(currentVariant.format, language) : '' },
    { label: t('product.language'), value: currentVariant ? currentVariant.language.toUpperCase() : '' },
    { label: t('product.details.publisher'), value: book.details.publisher || '' },
    { label: t('product.details.dimensions'), value: book.details.dimensions || '' },
    { label: t('product.details.weight'), value: book.details.weight || '' },
    { label: t('product.details.isbn'), value: currentVariant ? currentVariant.isbn : (book.variants[0]?.isbn || '') },
  ].filter(s => s.value.trim() !== '');

  const scrollToBuy = () => {
    document.getElementById('buy-elsewhere')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Drop stray editorial label lines like "Аннотация:" — the section already has its own heading
  const isLabelLine = (s: string) => {
    const t = s.trim();
    return t.length > 0 && t.length <= 30 && t.endsWith(':') && !t.includes('. ');
  };
  const aboutParas = (book.story?.about ?? []).filter(p => p.trim() !== '' && !isLabelLine(p));

  return (
    <div className="bg-[#F4F4F0] pt-[58px] md:pt-[76px]">
      
      {/* HEADER NAV */}
      <div className="border-b border-primary px-4 py-2 flex justify-between items-center bg-white sticky top-[58px] md:top-[76px] z-20">
         <Link to="/catalog" className="flex items-center gap-2 text-[10px] uppercase font-bold hover:text-accent">
            <ArrowLeft size={12} /> {t('cart.back_to_catalog')}
         </Link>
         {/* Fix: Display variant ISBN or fallback */}
         <span className="font-mono text-[10px]">{currentVariant ? currentVariant.isbn : (book.variants[0]?.isbn || '')}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-primary">
         
         {/* LEFT: IMAGE (Sticky) */}
         <div className="lg:border-r border-primary bg-[#E8EDF2] relative h-[58vh] sm:h-[64vh] lg:h-[calc(100vh-120px)] lg:sticky lg:top-[120px] flex items-center justify-center p-5 md:p-8 lg:p-20 overflow-hidden">
             <div className="relative w-full h-full shadow-[20px_20px_0px_0px_rgba(4,15,30,0.1)] border border-primary bg-white animate-fade-in p-3 md:p-4">
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  fetchPriority="high"
                  decoding="async"
                  className="w-full h-full object-contain"
                />
             </div>
         </div>

         {/* RIGHT: INFO (Scrollable) */}
         <div className="bg-white flex flex-col lg:min-h-[calc(100vh-120px)] border-t lg:border-t-0 border-primary">
            
            <div className="p-6 md:p-16 flex-1">
               <div className="mb-10">
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                     <span className="text-accent font-mono text-xs uppercase tracking-widest">{book.genre[0]}</span>
                     {inStock ? (
                       <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary/70">
                         <span className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />
                         {t('product.in_stock_label')}
                       </span>
                     ) : (
                       <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-gray-400">
                         <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                         {t('product.out_of_stock')}
                       </span>
                     )}
                  </div>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif leading-[0.9] text-primary mb-6 break-words hyphens-auto">
                    {book.title}
                  </h1>
                  <p className="text-lg md:text-xl font-serif italic text-gray-500 border-l-2 border-accent pl-6">
                    {t('product.by_author')} {language === 'ru' ? (book.authorGenitive?.trim() || toGenitiveRu(book.author)) : book.author}
                  </p>
               </div>

               {specs.length > 0 && (
                 <dl className="grid grid-cols-2 sm:grid-cols-3 border-t border-l border-primary">
                    {specs.map((s, i) => (
                      <div key={i} className="border-r border-b border-primary p-5">
                         <dt className="block text-[10px] uppercase text-gray-400 mb-2 tracking-widest">{s.label}</dt>
                         <dd className="font-mono text-base leading-tight">{s.value}</dd>
                      </div>
                    ))}
                 </dl>
               )}

               {/* VARIANTS SELECTOR */}
               <div className="py-8 border-b border-primary">
                  {/* У книг без заведённых вариантов подпись висела над пустотой:
                      заголовок «Формат» и под ним ничего. Показываем, только
                      когда есть что выбирать. */}
                  <div className={availableFormats.length > 0 ? 'mb-6' : 'hidden'}>
                    <span className="block text-[10px] uppercase text-gray-400 mb-3 tracking-widest">{t('product.format')}</span>
                    <div className="flex flex-wrap gap-3">
                      {availableFormats.map(f => (
                        <button
                          key={f}
                          onClick={() => handleFormatChange(f)}
                          className={`px-4 py-2 border font-mono text-xs uppercase transition-all ${selectedFormat === f ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary hover:bg-gray-100'}`}
                        >
                          {formatLabel(f, language)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedFormat && (
                    <div className="mb-4">
                      <span className="block text-[10px] uppercase text-gray-400 mb-3 tracking-widest">{t('product.language')}</span>
                      <div className="flex flex-wrap gap-3">
                        {availableLanguages.map(l => (
                          <button
                            key={l}
                            onClick={() => setSelectedLanguage(l)}
                            className={`px-4 py-2 border font-mono text-xs uppercase transition-all ${selectedLanguage === l ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary hover:bg-gray-100'}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!currentVariant && selectedFormat && (
                     <p className="text-red-500 text-xs font-mono flex items-center gap-2 mt-4"><AlertCircle size={12}/> {t('product.variant_unavailable')}</p>
                  )}
               </div>

               {secondaryPurchaseLinks.length > 0 ? (
                 <section id="buy-elsewhere" className="border-t border-primary py-8 md:py-10 scroll-mt-32">
                    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
                       {t('product.buy_elsewhere_title')}
                    </p>
                    <div className="flex flex-wrap gap-3">
                       {secondaryPurchaseLinks.map(link => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 border border-primary px-5 py-3 text-xs uppercase tracking-[0.18em] font-bold hover:bg-primary hover:text-white transition-colors"
                          >
                             {link.label} <ExternalLink size={12} />
                          </a>
                       ))}
                    </div>
                 </section>
               ) : null}

               <section className="border-t border-primary py-8 md:py-10">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
                     {t('product.payment_info_title')}
                  </p>
                  <div className="border border-primary bg-[#F4F4F0] p-6 md:p-8">
                     <p className="text-lg leading-relaxed text-gray-700">
                        {t('product.payment_info_text')}
                     </p>
                  </div>
               </section>
            </div>

            {/* ACTION FOOTER */}
            {/* Added 'pb-safe-b' to respect Safe Area on iOS */}
            <div className="border-t border-primary bg-[#F4F4F0] p-6 md:p-8 md:sticky md:bottom-0 z-10 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
               <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-baseline">
                     <span className="font-mono text-xs uppercase">{isPurchasable ? t('cart.total') : t('product.availability')}</span>
                     <span className="text-4xl font-serif text-right">
                       {isPurchasable
                          ? shopifyState?.price != null
                            ? `${shopifyState.price.toFixed(2)} ${shopifyState.currency === 'EUR' ? '€' : shopifyState.currency}`
                            : `${(currentVariant ? currentVariant.price : book.price).toFixed(2)} ${region.currency}`
                          : t('product.price_on_request')}
                       {shopifyState?.available === false ? (
                         <span className="block text-[10px] font-mono uppercase tracking-widest text-amber-600">
                           {t('product.out_of_stock')}
                         </span>
                       ) : null}
                     </span>
                  </div>

                  {isPurchasable ? (
                    <div className="flex border border-primary bg-white h-14 md:h-14">
                       <button onClick={() => setQty(Math.max(1, qty-1))} className="w-14 border-r border-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors">
                          <Minus size={16} />
                       </button>
                       <div className="flex-1 flex items-center justify-center font-mono text-lg border-r border-primary">
                          {qty}
                       </div>
                       <button onClick={() => setQty(qty+1)} className="w-14 border-r border-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors">
                          <Plus size={16} />
                       </button>
                       <button
                          onClick={handleAddToCart}
                          className="flex-[2] bg-primary text-white hover:bg-accent transition-colors uppercase font-bold text-sm tracking-widest disabled:bg-gray-300 disabled:cursor-not-allowed"
                          disabled={!currentVariant || currentVariant.stock === 0 || shopifyState?.available === false}
                       >
                          {!currentVariant
                             ? t('product.select_variant')
                             : currentVariant.stock > 0
                               ? (shopifyLink ? t('product.buy_on_shopify') : t('product.add_to_cart'))
                               : t('product.out_of_stock')
                          }
                       </button>
                    </div>
                  ) : (
                    /* Без ссылок на магазины кнопка раньше была отключена и
                       повторяла надпись «Цена по запросу» строкой выше. Дубль
                       ничего не сообщал и никуда не вёл — теперь это живое
                       письмо с уже подставленной книгой в теме. */
                    secondaryPurchaseLinks.length > 0 ? (
                      <button
                         onClick={scrollToBuy}
                         className="w-full h-14 bg-primary text-white hover:bg-accent transition-colors uppercase font-bold text-sm tracking-widest"
                      >
                         {t('product.where_to_buy')}
                      </button>
                    ) : (
                      <a
                         href={`mailto:info@ampublishing.org?subject=${encodeURIComponent(`${t('product.ask_price')}: ${book.title}`)}`}
                         className="w-full h-14 flex items-center justify-center bg-primary text-white hover:bg-accent transition-colors uppercase font-bold text-sm tracking-widest"
                      >
                         {t('product.ask_price')}
                      </a>
                    )
                  )}
               </div>
            </div>

         </div>
      </div>

      {/* STORY SECTION */}
      {book.story && (book.story.quote || (book.story.about?.length ?? 0) > 0 || book.story.featureImageUrl) ? (
        <div className="border-t border-primary bg-white">

          {/* Opening quote */}
          {book.story.quote ? (
            <div className="border-b border-primary px-6 md:px-24 py-16 md:py-28">
              <div className="max-w-4xl mx-auto text-center">
                <span className="block font-serif text-6xl md:text-8xl leading-none text-accent mb-4 select-none">“</span>
                <blockquote className="text-3xl md:text-5xl font-serif italic leading-snug text-primary">
                  {book.story.quote}
                </blockquote>
                {book.story.quoteSource ? (
                  <p className="mt-8 font-mono text-xs uppercase tracking-[0.24em] text-gray-400">— {book.story.quoteSource}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Feature image */}
          {book.story.featureImageUrl ? (
            <div className="border-b border-primary">
              <img src={book.story.featureImageUrl} alt={book.title} className="w-full max-h-[70vh] object-cover" loading="lazy" />
            </div>
          ) : null}

          {/* About */}
          {aboutParas.length > 0 ? (
            <div className="border-b border-primary">
              <div className="px-8 py-6 border-b border-primary">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400">{t('product.about_book')}</h2>
              </div>
              {/* Строка была ~123 знака — вдвое шире нормы чтения. Сузили меру,
                  но колонку центрируем: прижатая влево, она оставляла полэкрана
                  пустоты справа. Гарнитура — та же серифная, что в отрывке и
                  биографии: соседние блоки прозы разными шрифтами читались как
                  недоделка. */}
              {/* Тёплая подложка — та же, что под отрывком: аннотация и отрывок
                  идут подряд, и на белом фоне этот блок висел в пустоте, тогда
                  как соседний лежал на бумаге.

                  Абзацы отбиваются пробелом, а не красной строкой: это не
                  сплошная проза, а издательская аннотация, и набор у неё должен
                  отличаться от отрывка, иначе два соседних блока сливаются. */}
              <div className="bg-[#EFEBE3] px-8 py-14 md:px-16 md:py-24">
                <div className="mx-auto max-w-[40rem]">
                  {/* Короткий штрих вместо пустоты над текстом — даёт колонке
                      верхнюю точку опоры, как зачин на шмуцтитуле. */}
                  <span aria-hidden className="mx-auto mb-10 block h-px w-16 bg-accent/50" />

                  {aboutParas.map((para, i) => (
                    <p
                      key={i}
                      className={
                        'font-serif ' +
                        (i === 0
                          // Первый абзац — вводный: крупнее и темнее, он держит
                          // начало и задаёт, с чего читать.
                          ? 'text-[1.3rem] leading-[1.7] text-primary md:text-[1.5rem] md:leading-[1.65]'
                          : 'mt-6 text-[1.12rem] leading-[1.8] text-primary/80 md:text-[1.22rem] md:leading-[1.85]')
                      }
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Themes */}
          {(book.story.themes?.length ?? 0) > 0 ? (
            <div className="border-b border-primary">
              <div className="px-8 py-6 border-b border-primary bg-primary text-white">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">{t('product.themes')}</h2>
              </div>
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${book.story.themes!.length >= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
                {book.story.themes!.map((theme, i) => (
                  <div key={i} className="border-b sm:border-r border-primary p-8 last:border-r-0 bg-primary text-white">
                    <span className="block font-mono text-[10px] uppercase tracking-widest text-accent mb-4">0{i + 1}</span>
                    <h3 className="font-serif text-2xl mb-3">{theme.title}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">{theme.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Excerpt — same label-bar + breathing room as Reviews below, since both
              present quoted words from/about the book rather than editorial copy.
              Left-aligned and measure-constrained (not centred like the pull-quote):
              this is running prose, often several paragraphs, and centring or
              cramping that into a narrow sidebar column is what read as a dense
              wall of text before. */}
          {(book.story.excerpt?.length ?? 0) > 0 ? (
            <div className="border-b border-primary">
              <div className="px-8 py-6 border-b border-primary flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400">{t('product.excerpt')}</h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-300">
                  {book.title}
                </span>
              </div>
              {/* Тёплая подложка + белая «страница» поверх: колонка текста
                  перестаёт висеть в пустоте и читается как разворот книги. */}
              <div className="px-4 py-10 md:px-10 md:py-16 bg-[#EFEBE3]">
                {/*
                  Набор по книжным правилам, а не «цитата на три страницы»:
                  — прямое начертание, курсив тут был на всём отрывке и убивал
                    читаемость длинной прозы (курсив — для акцента, не для тела);
                  — абзацы отбиваются красной строкой, а не пустотой между ними,
                    так читается непрерывный текст в книге;
                  — первый абзац без отступа и с буквицей — типографская норма.
                */}
                {/* На широком экране лист шире: две колонки должны держать
                    норму строки, в 52rem они выходили по ~35 знаков. */}
                <div className="mx-auto max-w-[52rem] lg:max-w-[74rem] bg-white px-7 py-12 md:px-16 md:py-20 lg:px-20 ring-1 ring-primary/[0.06] shadow-[0_2px_4px_rgba(4,15,30,0.03),0_30px_70px_-40px_rgba(4,15,30,0.35)]">
                  <BookSpread
                    paragraphs={book.story.excerpt}
                    labels={{
                      prev: t('product.spread_prev'),
                      next: t('product.spread_next'),
                      of: t('product.spread_of'),
                    }}
                    paragraphClass={(i) =>
                      "font-serif text-primary/90 " +
                      "text-[1.15rem] leading-[1.8] md:text-[1.32rem] md:leading-[1.85] " +
                      (i === 0
                        ? "first-letter:float-left first-letter:mr-4 first-letter:mt-2 " +
                          "first-letter:font-serif first-letter:text-[4.6rem] first-letter:leading-[0.76] " +
                          "first-letter:text-accent md:first-letter:text-[5.6rem] " +
                          // Первая строка капителью — классический зачин главы,
                          // мягко вводит в текст без лишней графики.
                          "first-line:tracking-[0.04em] first-line:text-primary"
                        : "indent-8 md:indent-12")
                    }
                    footer={
                      /* Отрывок обрывается на середине главы — читателю нужен знак,
                         что текст закончился намеренно, а не «недогрузился». */
                      <div className="mt-12 text-center">
                        <span className="block font-serif text-2xl leading-none text-accent/70">❧</span>
                        <span className="mt-4 block font-mono text-[10px] uppercase tracking-[0.24em] text-gray-400">
                          {t('product.excerpt_end')}
                        </span>
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Author bio */}
          {(book.story.authorBio?.length ?? 0) > 0 ? (
            <div className="border-b border-primary">
              <div className="px-8 py-6 border-b border-primary">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400">{t('product.author_section')}</h2>
              </div>
              {/* Набрано как аннотация, а не как отрывок. Правило по странице
                  простое: белый лист — это проза автора, и он тут один, у
                  отрывка. Биография — редакционный текст о человеке, поэтому
                  лежит прямо на тёплом фоне. Раньше лист шёл сразу за листом
                  отрывка, и два одинаковых блока подряд читались как повтор. */}
              <div className="bg-[#EFEBE3] px-8 py-14 md:px-16 md:py-24">
                <div className="mx-auto max-w-[40rem]">
                  <span aria-hidden className="mx-auto mb-10 block h-px w-16 bg-accent/50" />
                  <h3 className="font-serif text-3xl text-primary md:text-4xl">{book.author}</h3>
                  {book.story.authorBio.map((para, i) => (
                    <p
                      key={i}
                      className={
                        'font-serif text-[1.12rem] leading-[1.8] text-primary/80 md:text-[1.22rem] md:leading-[1.85] ' +
                        (i === 0 ? 'mt-7' : 'mt-6')
                      }
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Reviews */}
          {(book.story.reviews?.length ?? 0) > 0 ? (
            (() => {
              const reviews = book.story!.reviews!;
              const single = reviews.length === 1;
              return (
                <div className="border-b border-primary">
                  <div className="px-8 py-6 border-b border-primary">
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400">{t('product.reviews')}</h2>
                  </div>
                  {single ? (
                    <div className="p-8 md:p-16">
                      <div className="max-w-3xl mx-auto text-center">
                        <p className="text-2xl md:text-3xl font-serif italic leading-relaxed mb-6 text-primary">«{reviews[0].quote}»</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-400">— {reviews[0].author}</p>
                      </div>
                    </div>
                  ) : (
                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${reviews.length >= 3 ? 'xl:grid-cols-3' : ''}`}>
                      {reviews.map((review, i) => (
                        <div key={i} className="p-8 md:p-10 border-b sm:border-r border-primary last:border-r-0">
                          <p className="font-serif text-[1.15rem] leading-[1.7] italic mb-6 text-primary/85">«{review.quote}»</p>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">— {review.author}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
          ) : null}

          {/* Order note */}
          {book.story.orderNote ? (
            <div className="p-8 md:p-16 border-b border-primary bg-[#F4F4F0]">
              <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">{book.story.orderNote}</p>
            </div>
          ) : null}

        </div>
      ) : null}

      {relatedBooks.length > 0 ? (
        <div className="border-t border-primary">
           <div className="p-4 border-b border-primary bg-accent text-primary">
              <h3 className="font-mono text-xs uppercase tracking-widest">{t('product.you_may_like')}</h3>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 border-b border-primary">
              {relatedBooks.map(rb => (
                 <ProductCard key={rb.id} book={rb} />
              ))}
           </div>
        </div>
      ) : null}
    </div>
  );
};
