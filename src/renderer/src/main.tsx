import '@fontsource/chakra-petch/600.css' // 로고 워드마크 폰트(오프라인 번들)
import '@fontsource/chakra-petch/700.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
