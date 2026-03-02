import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <App />
          <Toaster richColors position="top-right" />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
