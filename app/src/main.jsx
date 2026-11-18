import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installApiCache } from './lib/apiCache'
import { installResponsiveTables } from './lib/responsiveTables'

installApiCache()
installResponsiveTables()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
