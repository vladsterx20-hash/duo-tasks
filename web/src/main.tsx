import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WebApp from '@twa-dev/sdk';
import App from './App';
import './styles.css';

WebApp.ready();
WebApp.expand();
try {
  WebApp.disableVerticalSwipes(); // чтобы pull-to-refresh не закрывал приложение
} catch {
  /* старые клиенты */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
