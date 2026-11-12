import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Shopping from './Shopping.jsx'
import AuthGate from './AuthGate.jsx'

const isShopping = document.documentElement.dataset.app === 'shopping' ||
  window.location.pathname.replace(/\/$/, '') === '/einkaufen';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>{isShopping ? <Shopping /> : <App />}</AuthGate>
  </StrictMode>,
)
