import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { SocketProvider } from './contexts/SocketContext'
import { GameProvider } from './contexts/GameContext'
import { WebRTCProvider } from './contexts/WebRTCContext'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SocketProvider>
        <GameProvider>
          <WebRTCProvider>
            <App />
          </WebRTCProvider>
        </GameProvider>
      </SocketProvider>
    </BrowserRouter>
  </React.StrictMode>,
)