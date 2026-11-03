import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Poppins local para a arte do crachá (a CSP não deixa buscar fontes de fora)
import '@fontsource/poppins/300.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
