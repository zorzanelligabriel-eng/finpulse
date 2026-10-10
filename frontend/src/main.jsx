import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { MarketProvider } from './context/MarketContext';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MarketProvider>
          <App />
        </MarketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
