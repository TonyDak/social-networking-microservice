window.global = window;

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppWithProviders from './App.jsx'

createRoot(document.getElementById('root')).render(
  // <StrictMode>
    <AppWithProviders />
  // </StrictMode>,
)
