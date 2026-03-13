import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ProductTourProvider } from './context/ProductTourContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { TenantProvider } from './context/TenantContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <TenantProvider>
            <ProductTourProvider>
              <App />
              <Toaster richColors position="top-right" />
            </ProductTourProvider>
          </TenantProvider>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
