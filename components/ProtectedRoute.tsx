
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../AppContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useApp();
  const location = useLocation();

  if (!isAdmin) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
