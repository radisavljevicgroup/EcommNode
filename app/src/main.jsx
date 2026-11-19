import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installApiCache } from './lib/apiCache'
import { installResponsiveTables } from './lib/responsiveTables'
import { installOrderChangeWatcher } from './lib/orderChanges'

installApiCache()
installOrderChangeWatcher()
installResponsiveTables()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
