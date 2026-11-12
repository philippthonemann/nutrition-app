import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Shopping from './Shopping.jsx'
import AuthGate from './AuthGate.jsx'

const isShopping = window.location.pathname.replace(/\/$/, '') === '/einkaufen';
if (isShopping) {
  document.title = 'Einkaufen';
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#9db3bb');
  document.querySelector('link[rel="icon"]')?.setAttribute('href', '/shopping-icon-32.png');
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', '/shopping-icon-180.png');
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/shopping.webmanifest');
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'Einkaufen');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>{isShopping ? <Shopping /> : <App />}</AuthGate>
  </StrictMode>,
)
