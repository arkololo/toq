import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initializeAuthentication } from './auth/keycloak'
import './styles/global.css'

async function render() {
  const authenticated = await initializeAuthentication()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App authenticated={authenticated} />
    </StrictMode>,
  )
}

void render()
