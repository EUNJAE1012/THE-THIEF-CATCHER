import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import GameRoom from './pages/GameRoom';
import AdminDashboard from './pages/AdminDashboard';
import { useGame } from './contexts/GameContext';

function App() {
  const { room } = useGame();

  return (
    <>
      <div className="noise-overlay" />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/game/:roomCode" element={<GameRoom />} />
        <Route path="/adminnnnnn" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
