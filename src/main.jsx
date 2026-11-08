import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Shopping from './Shopping.jsx'
import AuthGate from './AuthGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>{window.location.pathname.replace(/\/$/,'') === '/einkaufen' ? <Shopping /> : <App />}</AuthGate>
  </StrictMode>,
)

