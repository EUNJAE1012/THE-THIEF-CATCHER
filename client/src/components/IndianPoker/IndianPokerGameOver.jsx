import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import './IndianPokerBoard.css';

const IndianPokerGameOver = ({ winner, isMe, onClose }) => {
  const navigate = useNavigate();

  return (
    <div className="game-over-overlay">
      <motion.div 
        className="game-over-card"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.8 }}
      >
        <div className="result-header">
          {isMe ? "🎉 승리! 🎉" : "💀 패배... 💀"}
        </div>
        
        <div className="winner-display">
          <div className="winner-avatar">
            {winner?.nickname?.charAt(0) || '?'}
          </div>
          <div className="winner-name">
            {winner?.nickname}
          </div>
          <div className="winner-title">
            최종 우승자
          </div>
        </div>

        <div className="game-over-actions">
          <button 
            className="lobby-btn"
            onClick={() => navigate('/')}
          >
            로비로 돌아가기
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default IndianPokerGameOver;