import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RadioAdminPanel } from './RadioAdminPanel';

/**
 * Standalone radio admin at /radio/admin — gated only by the radio password
 * (independent of the site CMS login). Reuses the RadioAdminPanel overlay.
 */
export const RadioAdminPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <RadioAdminPanel
      onClose={() => navigate('/radio')}
      onChatCleared={() => {}}
      onPinChanged={() => {}}
      onAnnounced={() => {}}
    />
  );
};
