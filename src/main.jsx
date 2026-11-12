import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Shopping from './Shopping.jsx'
import AuthGate from './AuthGate.jsx'

const isShopping = window.location.pathname.replace(/\/$/, '') === '/einkaufen';
if (isShopping) {
  document.title = 'Einkaufen';
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/shopping.webmanifest');
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'Einkaufen');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>{isShopping ? <Shopping /> : <App />}</AuthGate>
  </StrictMode>,
)

