
import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Preloader } from './components/Preloader';
import { CartDrawer } from './components/CartDrawer';
import { ToastContainer } from './components/Toast';
import { CookieConsent, RegionModal, AgeGateModal } from './components/Modals';
import { DevTools } from './components/DevTools';
import { SEO } from './components/SEO';
import { AppProvider, useApp } from './AppContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { analytics } from './services/analytics'; // Import Analytics
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ServiceOrderPage } from './pages/ServiceOrderPage';
import { AuthorsPage, AboutPage, MediaPage, PrivacyPage, ImpressumPage, TermsPage, OurAuthorsPage } from './pages/StaticPages';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { RadioPage } from './pages/RadioPage';
import { RadioAdminPage } from './pages/RadioAdminPage';

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
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname === '/login' || location.pathname.startsWith('/radio/admin');

  return (
    <div className="flex flex-col min-h-dvh font-sans text-primary">
      <SEO />
      {!isAdminRoute && <Preloader />}
      {!isAdminRoute && <Header />}
      <CartDrawer />
      
      <main className="flex-1 relative z-10">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<CatalogPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          
          <Route path="/services" element={<ServiceOrderPage />} />
          <Route path="/services/order" element={<ServiceOrderPage />} />

          <Route path="/radio" element={<RadioPage />} />
          <Route path="/radio/admin" element={<RadioAdminPage />} />

          <Route path="/authors" element={<AuthorsPage />} />
          <Route path="/our-authors" element={<OurAuthorsPage />} />
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
