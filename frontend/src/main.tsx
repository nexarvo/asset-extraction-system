import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReduxProvider } from './providers/ReduxProvider'
import { AppRoutes } from './routes/AppRoutes'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReduxProvider>
      <AppRoutes />
    </ReduxProvider>
  </StrictMode>,
)