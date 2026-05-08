
import React, { Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Preloader } from './components/Preloader';
import { CartDrawer } from './components/CartDrawer';
import { ToastContainer } from './components/Toast';
import { CookieConsent, RegionModal, AgeGateModal } from './components/Modals';
import { DevTools } from './components/DevTools';
import { AppProvider, useApp } from './AppContext';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { analytics } from './services/analytics'; // Import Analytics

// --- Lazy Load Pages (Code Splitting) ---
const HomePage = React.lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const CatalogPage = React.lazy(() => import('./pages/CatalogPage').then(module => ({ default: module.CatalogPage })));
const ProductPage = React.lazy(() => import('./pages/ProductPage').then(module => ({ default: module.ProductPage })));
const CartPage = React.lazy(() => import('./pages/CartPage').then(module => ({ default: module.CartPage })));
const CheckoutPage = React.lazy(() => import('./pages/CheckoutPage').then(module => ({ default: module.CheckoutPage })));
const ServiceOrderPage = React.lazy(() => import('./pages/ServiceOrderPage').then(module => ({ default: module.ServiceOrderPage })));
const AuthorsPage = React.lazy(() => import('./pages/StaticPages').then(module => ({ default: module.AuthorsPage })));
const AboutPage = React.lazy(() => import('./pages/StaticPages').then(module => ({ default: module.AboutPage })));
const MediaPage = React.lazy(() => import('./pages/StaticPages').then(module => ({ default: module.MediaPage })));
const PrivacyPage = React.lazy(() => import('./pages/StaticPages').then(module => ({ default: module.PrivacyPage })));
const ImpressumPage = React.lazy(() => import('./pages/StaticPages').then(module => ({ default: module.ImpressumPage })));
const TermsPage = React.lazy(() => import('./pages/StaticPages').then(module => ({ default: module.TermsPage })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })));

// Admin Pages
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const AdminPage = React.lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F4F4F0]">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// --- App Content with Routing ---

const AppContent: React.FC = () => {
  const location = useLocation();
  const { 
    toasts, removeToast, 
    showRegionModal, setShowRegionModal, setRegionById,
    showAgeModal, handleAgeConfirm, handleAgeDeny,
    isAdmin
  } = useApp();

  // 1. Scroll to top on route change
  // 2. Track Page View
  useEffect(() => {
    window.scrollTo(0, 0);
    analytics.pageView(location.pathname);
  }, [location.pathname]);

  // Hide standard Header/Footer on Admin pages
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname === '/login';

  return (
    <div className="flex flex-col min-h-screen font-sans text-primary">
      {!isAdminRoute && <Preloader />}
      {!isAdminRoute && <Header />}
      <CartDrawer />
      
      <main className="flex-1 relative z-10">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<CatalogPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            
            <Route path="/services" element={<ServiceOrderPage />} />
            <Route path="/services/order" element={<ServiceOrderPage />} />

            <Route path="/authors" element={<AuthorsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/media" element={<MediaPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/impressum" element={<ImpressumPage />} />
            <Route path="/terms" element={<TermsPage />} />
            
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>

      {!isAdminRoute && <Footer />}
      
      {/* Global Overlays */}
      {!isAdminRoute && <CookieConsent />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {!isAdminRoute && (
        <RegionModal 
          isOpen={showRegionModal} 
          onClose={() => setShowRegionModal(false)}
          onSelect={setRegionById}
        />
      )}
      
      <AgeGateModal 
        isOpen={showAgeModal}
        onConfirm={handleAgeConfirm}
        onDeny={handleAgeDeny}
      />
      <DevTools /> 
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
