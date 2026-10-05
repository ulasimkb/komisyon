import React from 'react'
import ReactDOM from 'react-dom/client'
import { LazyMotion, MotionConfig } from 'motion/react'
import App from './App'
import './styles.css'

// domMax: kanban kartlarının sütunlar arası geçişi için layout animasyonu gerekir.
// İlk açılışı büyütmemek için ayrı parça olarak sonradan yüklenir.
const loadMotionFeatures = () => import('./lib/motionFeatures').then(module => module.default)

// reducedMotion="user": işletim sisteminde hareket azaltıldıysa yalnızca saydamlık geçişi kalır.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </LazyMotion>
  </React.StrictMode>
)
