
import { Book, NewsItem, Region, Language, BookVariant, Order } from './types';

export const REGIONS: Region[] = [
  { id: 'de', name: 'Германия (Deutschland)', currency: '€' },
  { id: 'eu', name: 'Европейский Союз', currency: '€' },
  { id: 'world', name: 'Весь мир (Other)', currency: '€' },
];

export const FREE_SHIPPING_THRESHOLD = 50;

// --- DATA FACTORIES ---

const mkVariant = (id: string, format: 'paperback'|'hardcover'|'digital'|'special_edition', lang: string, price: number, stock: number, isbn: string): BookVariant => ({
  id, format, language: lang, price, stock, isbn
});

// --- MOCK ORDERS ---
export const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-2026-8821',
    date: '2026-01-22T14:30:00Z',
    customer: { name: 'Alex Meyer', email: 'alex@example.com', location: 'Berlin, DE' },
    items: [{ variantId: '1-1', bookTitle: 'Тени Берлина', quantity: 1, priceAtPurchase: 24.00 }],
    total: 29.00,
    currency: '€',
    status: 'processing',
    paymentStatus: 'paid'
  },
  {
    id: 'ORD-2026-8820',
    date: '2026-01-22T10:15:00Z',
    customer: { name: 'Sarah Connor', email: 'sarah@skynet.com', location: 'Los Angeles, USA' },
    items: [
        { variantId: '6-1', bookTitle: 'Бетон и Стекло', quantity: 2, priceAtPurchase: 32.00 },
        { variantId: '2-1', bookTitle: 'Философия Тишины', quantity: 1, priceAtPurchase: 18.50 }
    ],
    total: 97.50, // + shipping
    currency: '€',
    status: 'pending',
    paymentStatus: 'paid'
  },
  {
    id: 'ORD-2026-8819',
    date: '2026-01-21T18:45:00Z',
    customer: { name: 'Hans Gruber', email: 'hans@nakatomi.jp', location: 'Munich, DE' },
    items: [{ variantId: '5-1', bookTitle: 'История Искусств: Том 1', quantity: 1, priceAtPurchase: 45.00 }],
    total: 45.00,
    currency: '€',
    status: 'shipped',
    paymentStatus: 'paid',
    trackingNumber: 'DHL-99283812'
  },
  {
    id: 'ORD-2026-8818',
    date: '2026-01-20T09:00:00Z',
    customer: { name: 'Jean-Luc Godard', email: 'cinema@verite.fr', location: 'Paris, FR' },
    items: [{ variantId: '7-1', bookTitle: 'Эстетика Пустоты', quantity: 1, priceAtPurchase: 20.00 }],
    total: 35.00, // express shipping
    currency: '€',
    status: 'delivered',
    paymentStatus: 'paid'
  },
  {
    id: 'ORD-2026-8817',
    date: '2026-01-19T11:20:00Z',
    customer: { name: 'Unknown User', email: 'anon@tor.net', location: 'Hamburg, DE' },
    items: [{ variantId: '3-1', bookTitle: 'Запретный Архив', quantity: 1, priceAtPurchase: 28.00 }],
    total: 28.00,
    currency: '€',
    status: 'cancelled',
    paymentStatus: 'refunded'
  }
];

// --- LOCALIZED DATA ---

type LocalizedData = {
  books: Book[];
  news: NewsItem[];
  genres: string[];
  authors: string[];
  series: string[];
};

// Generic filler for bulk
const genericCovers = [
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800', // Classic black (ID 8)
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=800', // White (ID 9)
    'https://images.unsplash.com/photo-1550684847-75bdda21cc95?auto=format&fit=crop&q=80&w=800', // Red/Dark Abstract (ID 10 - Updated)
    'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800', // Dark abstract (ID 11)
    'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?auto=format&fit=crop&q=80&w=800', // Stack (ID 12)
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=800', // Mountain/Abstract
    'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=800', // Reading
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=800'  // Library
];

const generateGenericBooks = (lang: Language, startId: number): Book[] => {
  const titles = lang === 'ru' ? 'Архивный Том' : lang === 'de' ? 'Archivband' : 'Archive Volume';
  return Array.from({ length: 8 }).map((_, i) => {
      const id = (startId + i).toString();
      return {
        id,
        title: `${titles} #${id}`,
        author: 'AM Collective',
        price: 15 + i,
        // Cycle through curated images
        coverUrl: genericCovers[i % genericCovers.length],
        badges: [],
        type: 'publisher',
        isPreorder: false,
        stock: 5,
        description: 'Standard catalog item.',
        details: { pages: 200, year: 2020 + (i % 4), weight: '300g', dimensions: '120x190mm' },
        genre: [lang === 'ru' ? 'Теория' : 'Theory'],
        ageRating: '16+',
        variants: [mkVariant(`${id}-1`, 'paperback', 'English', 15 + i, 5, `978-0-00-${id}-X`)],
        releaseDate: `202${i % 4}-01-01`
      };
  });
};

export const DATABASE: Record<Language, LocalizedData> = {
  ru: {
    genres: ['Художественная литература', 'Философия', 'История', 'Искусство', 'Биографии', 'Поэзия', 'Урбанистика', 'Дизайн'],
    authors: ['Анна Штерн', 'Марк Вебер', 'Елена Кросс', 'Дмитрий Волков', 'Роберт Лэнг', 'Сара Миллер', 'Джон Кейдж', 'Симона Вейль', 'Ле Корбюзье', 'Вальтер Гропиус'],
    series: ['Берлинские Тайны', 'Новая Философия', 'Поэтика', 'Архивы XX века', 'Modern Classics', 'Bauhaus Archive'],
    news: [
      { id: '1', date: '12 Фев 2026', title: 'AM Publishing на Art Book Fair', preview: 'Мы представляем наши новинки и встречаемся с авторами на крупнейшей книжной выставке.' },
      { id: '2', date: '05 Фев 2026', title: 'Открытие нового сезона', preview: 'Презентация новой серии философской эссеистики и встречи с читателями.' },
      { id: '3', date: '20 Янв 2026', title: 'Интервью с главным редактором', preview: 'О будущем печатной книги в цифровую эпоху и новых вызовах индустрии.' },
    ],
    books: [
      {
        id: '1',
        title: 'Тени Берлина',
        author: 'Анна Штерн',
        price: 24.00,
        coverUrl: 'https://images.unsplash.com/photo-1470219556762-1771e7f9427d?auto=format&fit=crop&q=80&w=800',
        badges: ['new', 'bestseller'],
        type: 'publisher',
        isPreorder: false,
        stock: 15,
        description: 'Захватывающий роман о тайнах старого города, переплетающихся с современностью.',
        details: { pages: 320, year: 2023, publisher: "AM Pub", weight: "450g", dimensions: "140x210mm" },
        genre: ['Художественная литература', 'История'],
        series: 'Берлинские Тайны',
        ageRating: '16+',
        releaseDate: '2023-10-01',
        variants: [
            mkVariant('1-1', 'hardcover', 'Русский', 24.00, 10, '978-3-16-148410-0'),
            mkVariant('1-2', 'paperback', 'Русский', 18.00, 5, '978-3-16-148410-X'),
        ]
      },
      {
        id: '2',
        title: 'Философия Тишины',
        author: 'Марк Вебер',
        price: 18.50,
        oldPrice: 22.00,
        coverUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=800',
        badges: [],
        type: 'publisher',
        isPreorder: false,
        stock: 4,
        description: 'Эссе о поиске покоя в шумном мире. Книга-медитация.',
        details: { pages: 180, year: 2022, publisher: "AM Pub", weight: "200g", dimensions: "120x190mm" },
        genre: ['Философия'],
        series: 'Новая Философия',
        ageRating: '12+',
        releaseDate: '2022-05-15',
        variants: [mkVariant('2-1', 'paperback', 'Русский', 18.50, 4, '978-3-16-148410-1')]
      },
      {
        id: '3',
        title: 'Запретный Архив',
        author: 'Дмитрий Волков',
        price: 28.00,
        coverUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=800',
        badges: ['18+', 'preorder'],
        type: 'author_project',
        isPreorder: true,
        stock: 0,
        description: 'Остросюжетный триллер, основанный на реальных событиях.',
        details: { pages: 450, year: 2024, publisher: "Samizdat", weight: "600g", dimensions: "150x230mm" },
        genre: ['История', 'Биографии'],
        series: 'Архивы XX века',
        ageRating: '18+',
        releaseDate: '2024-03-01',
        variants: [mkVariant('3-1', 'hardcover', 'Русский', 28.00, 0, '978-3-16-148410-2')]
      },
      {
        id: '4',
        title: 'Стихи о Вечном',
        author: 'Елена Кросс',
        price: 15.00,
        coverUrl: 'https://images.unsplash.com/photo-1618519764620-7403abdbdfe9?auto=format&fit=crop&q=80&w=800',
        badges: ['new'],
        type: 'author_project',
        isPreorder: false,
        stock: 100,
        description: 'Сборник современной поэзии. Искренность и глубина.',
        details: { pages: 120, year: 2023, publisher: "AM Pub", weight: "150g", dimensions: "110x170mm" },
        genre: ['Поэзия'],
        series: 'Поэтика',
        ageRating: '12+',
        releaseDate: '2023-11-20',
        variants: [mkVariant('4-1', 'paperback', 'Русский', 15.00, 100, '978-3-16-148410-3')]
      },
      {
        id: '5',
        title: 'История Искусств: Том 1',
        author: 'Коллектив авторов',
        price: 45.00,
        coverUrl: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&q=80&w=800',
        badges: ['bestseller'],
        type: 'publisher',
        isPreorder: false,
        stock: 8,
        description: 'Подарочное издание с иллюстрациями.',
        details: { pages: 600, year: 2021, publisher: "Art Press", weight: "1200g", dimensions: "240x300mm" },
        genre: ['Искусство'],
        ageRating: '6+',
        releaseDate: '2021-09-10',
        variants: [mkVariant('5-1', 'hardcover', 'Русский', 45.00, 8, '978-3-16-148410-4')]
      },
      {
        id: '6',
        title: 'Бетон и Стекло',
        author: 'Ле Корбюзье',
        price: 32.00,
        coverUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=800',
        badges: [],
        type: 'publisher',
        isPreorder: false,
        stock: 12,
        description: 'Манифест современной архитектуры.',
        details: { pages: 240, year: 2020, publisher: "Bauhaus Print", weight: "500g", dimensions: "200x200mm" },
        genre: ['Урбанистика', 'Искусство'],
        series: 'Bauhaus Archive',
        ageRating: '12+',
        releaseDate: '2020-02-15',
        variants: [mkVariant('6-1', 'hardcover', 'Русский', 32.00, 12, '978-3-16-148410-6')]
      },
      {
        id: '7',
        title: 'Эстетика Пустоты',
        author: 'Джон Кейдж',
        price: 20.00,
        coverUrl: 'https://images.unsplash.com/photo-1506806732259-39c2d0268443?auto=format&fit=crop&q=80&w=800',
        badges: ['last_copy'],
        type: 'publisher',
        isPreorder: false,
        stock: 1,
        description: 'Лекции о тишине и случайности в искусстве.',
        details: { pages: 160, year: 2019, publisher: "AM Pub", weight: "220g", dimensions: "130x200mm" },
        genre: ['Искусство', 'Философия'],
        ageRating: '16+',
        releaseDate: '2019-11-01',
        variants: [mkVariant('7-1', 'paperback', 'Русский', 20.00, 1, '978-3-16-148410-7')]
      },
      ...generateGenericBooks('ru', 8)
    ]
  },
  
  en: {
    genres: ['Fiction', 'Philosophy', 'History', 'Art Theory', 'Biography', 'Poetry', 'Urbanism', 'Design'],
    authors: ['Anna Stern', 'Mark Weber', 'Elena Cross', 'Dmitry Volkov', 'Robert Lang', 'Sarah Miller', 'John Cage', 'Simone Weil', 'Le Corbusier'],
    series: ['Berlin Mysteries', 'New Philosophy', 'Poetics', 'XX Century Archives', 'Modern Classics', 'Bauhaus Archive'],
    news: [
      { id: '1', date: 'Feb 12, 2026', title: 'AM Publishing at Art Book Fair', preview: 'We present our new releases and meet with authors at the largest book fair.' },
      { id: '2', date: 'Feb 05, 2026', title: 'New Season Opening', preview: 'Presentation of a new series of philosophical essays and meetings with readers.' },
      { id: '3', date: 'Jan 20, 2026', title: 'Interview with Editor-in-Chief', preview: 'On the future of printed books in the digital age and new industry challenges.' },
    ],
    books: [
      {
        id: '1',
        title: 'Shadows of Berlin',
        author: 'Anna Stern',
        price: 24.00,
        coverUrl: 'https://images.unsplash.com/photo-1470219556762-1771e7f9427d?auto=format&fit=crop&q=80&w=800',
        badges: ['new', 'bestseller'],
        type: 'publisher',
        isPreorder: false,
        stock: 15,
        description: 'A gripping novel about the secrets of the old city.',
        details: { pages: 320, year: 2023, publisher: "AM Pub", weight: "450g", dimensions: "140x210mm" },
        genre: ['Fiction', 'History'],
        series: 'Berlin Mysteries',
        ageRating: '16+',
        releaseDate: '2023-10-01',
        variants: [
            mkVariant('1-1', 'hardcover', 'English', 24.00, 10, '978-EN-001'),
            mkVariant('1-2', 'paperback', 'English', 18.00, 5, '978-EN-002'),
        ]
      },
      {
        id: '2',
        title: 'Philosophy of Silence',
        author: 'Mark Weber',
        price: 18.50,
        oldPrice: 22.00,
        coverUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=800',
        badges: [],
        type: 'publisher',
        isPreorder: false,
        stock: 4,
        description: 'Essays on finding peace in a noisy world.',
        details: { pages: 180, year: 2022, publisher: "AM Pub", weight: "200g", dimensions: "120x190mm" },
        genre: ['Philosophy'],
        series: 'New Philosophy',
        ageRating: '12+',
        releaseDate: '2022-05-15',
        variants: [mkVariant('2-1', 'paperback', 'English', 18.50, 4, '978-EN-003')]
      },
      {
        id: '3',
        title: 'Forbidden Archive',
        author: 'Dmitry Volkov',
        price: 28.00,
        coverUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=800',
        badges: ['18+', 'preorder'],
        type: 'author_project',
        isPreorder: true,
        stock: 0,
        description: 'An action-packed thriller based on real events.',
        details: { pages: 450, year: 2024, publisher: "Samizdat", weight: "600g", dimensions: "150x230mm" },
        genre: ['History', 'Biography'],
        series: 'XX Century Archives',
        ageRating: '18+',
        releaseDate: '2024-03-01',
        variants: [mkVariant('3-1', 'hardcover', 'English', 28.00, 0, '978-EN-004')]
      },
      {
        id: '6',
        title: 'Concrete & Glass',
        author: 'Le Corbusier',
        price: 35.00,
        coverUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=800',
        badges: ['bestseller'],
        type: 'publisher',
        isPreorder: false,
        stock: 20,
        description: 'A visual journey through modernist architecture.',
        details: { pages: 240, year: 2020, publisher: "Bauhaus Print", weight: "500g", dimensions: "200x200mm" },
        genre: ['Urbanism', 'Design'],
        series: 'Bauhaus Archive',
        ageRating: '12+',
        releaseDate: '2020-02-15',
        variants: [mkVariant('6-1', 'hardcover', 'English', 35.00, 20, '978-EN-006')]
      },
      {
        id: '8',
        title: 'Digital Decay',
        author: 'Sarah Miller',
        price: 12.00,
        coverUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800',
        badges: ['new'],
        type: 'author_project',
        isPreorder: false,
        stock: 999,
        description: 'An exploration of internet culture and memory.',
        details: { pages: 150, year: 2024, publisher: "Indie", weight: "N/A", dimensions: "PDF/EPUB" },
        genre: ['Philosophy', 'Urbanism'],
        ageRating: '16+',
        releaseDate: '2024-01-10',
        variants: [mkVariant('8-1', 'digital', 'English', 12.00, 999, '978-EN-DIG-01')]
      },
      ...generateGenericBooks('en', 9)
    ]
  },

  de: {
    genres: ['Belletristik', 'Philosophie', 'Geschichte', 'Kunsttheorie', 'Biografie', 'Lyrik', 'Urbanismus', 'Design'],
    authors: ['Anna Stern', 'Mark Weber', 'Elena Cross', 'Dmitry Volkov', 'Le Corbusier', 'Robert Lang', 'Sarah Miller', 'John Cage', 'Simone Weil'],
    series: ['Berlin Mysteries', 'Neue Philosophie', 'Poetik', 'Archive des 20. Jahrhunderts', 'Modern Classics', 'Bauhaus Archive'],
    news: [
      { id: '1', date: '12. Feb 2026', title: 'AM Publishing auf der Art Book Fair', preview: 'Wir präsentieren unsere Neuheiten und treffen Autoren auf der größten Buchmesse.' },
      { id: '2', date: '05. Feb 2026', title: 'Eröffnung der neuen Saison', preview: 'Präsentation einer neuen Reihe philosophischer Essays und Treffen mit Lesern.' },
      { id: '3', date: '20. Jan 2026', title: 'Interview mit dem Chefredakteur', preview: 'Über die Zukunft des gedruckten Buches im digitalen Zeitalter und neue Herausforderungen.' },
    ],
    books: [
      {
        id: '1',
        title: 'Schatten von Berlin',
        author: 'Anna Stern',
        price: 24.00,
        coverUrl: 'https://images.unsplash.com/photo-1470219556762-1771e7f9427d?auto=format&fit=crop&q=80&w=800',
        badges: ['new', 'bestseller'],
        type: 'publisher',
        isPreorder: false,
        stock: 15,
        description: 'Ein fesselnder Roman über die Geheimnisse der alten Stadt.',
        details: { pages: 320, year: 2023, publisher: "AM Pub", weight: "450g", dimensions: "140x210mm" },
        genre: ['Belletristik', 'Geschichte'],
        series: 'Berlin Mysteries',
        ageRating: '16+',
        releaseDate: '2023-10-01',
        variants: [mkVariant('1-1', 'hardcover', 'Deutsch', 24.00, 15, '978-DE-001')]
      },
      {
        id: '6',
        title: 'Beton und Glas',
        author: 'Le Corbusier',
        price: 32.00,
        coverUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=800',
        badges: [],
        type: 'publisher',
        isPreorder: false,
        stock: 12,
        description: 'Manifest der modernen Architektur.',
        details: { pages: 240, year: 2020, publisher: "Bauhaus Print", weight: "500g", dimensions: "200x200mm" },
        genre: ['Urbanismus', 'Kunsttheorie'],
        series: 'Bauhaus Archive',
        ageRating: '12+',
        releaseDate: '2020-02-15',
        variants: [mkVariant('6-1', 'hardcover', 'Deutsch', 32.00, 12, '978-DE-006')]
      },
      ...generateGenericBooks('de', 9)
    ]
  }
};
