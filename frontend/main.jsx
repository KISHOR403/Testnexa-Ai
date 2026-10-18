import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/premium-redesign.css'
import './styles/responsive-system.css'
import './styles/TestSignalLoader.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SettingsProvider>
  </StrictMode>,
)

