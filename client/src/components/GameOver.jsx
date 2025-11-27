import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useWebRTC } from '../contexts/WebRTCContext';
import './GameOver.css';

const GameOver = () => {
  const { gameState, room, player } = useGame();
  const { remoteStreams, localStream } = useWebRTC();
  const loserVideoRef = useRef(null);
  
  if (!gameState?.gameOver || !gameState?.loser) return null;

  const { loser, winners = [] } = gameState;
  const isLoser = loser?.id === player?.id;
  const isWinner = winners.some(w => w.id === player?.id);
  const myRank = winners.findIndex(w => w.id === player?.id) + 1;

  useEffect(() => {
    // WebRTC 스트림 할당 로직은 유지됩니다.
    if (loserVideoRef.current && loser) {
      if (loser.id === player?.id && localStream) {
        loserVideoRef.current.srcObject = localStream;
      } else if (remoteStreams[loser.id]) {
        loserVideoRef.current.srcObject = remoteStreams[loser.id];
      }
    }
  }, [loser, localStream, remoteStreams, player?.id]);

  return (
    <motion.div 
      className="game-over-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="game-over-backdrop" />
      
      <motion.div 
        className="game-over-content"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      >
        {/* 본인 결과 배너 */}
        <motion.div
          className={`my-result-banner ${isLoser ? 'loser' : 'winner'}`}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {isLoser ? '😱 당신이 도둑!' : `🎉 ${myRank}위 승리!`}
        </motion.div>

        {/* 패배자 얼굴 - 대문짝만하게 */}
        <motion.div
          className="loser-video-wrapper"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 150 }}
        >
          <div className="loser-video-container">
            <video
              ref={loserVideoRef}
              autoPlay
              playsInline
              muted={isLoser}
              className="loser-video"
            />
            {/* 스트림이 없을 경우 이니셜로 대체 */}
            {!remoteStreams[loser?.id] && loser?.id !== player?.id && (
              <div className="loser-video-placeholder">
                <span>{loser?.nickname?.charAt(0) || '?'}</span>
              </div>
            )}
          </div>
          <div className="loser-frame">
            <span className="loser-frame-text">🦹 도둑 🦹</span>
          </div>
          <motion.div 
            className="joker-badge-large"
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            🃏
          </motion.div>
        </motion.div>

        <motion.h2 
          className="loser-name"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {loser?.nickname} {isLoser && '(나)'}
        </motion.h2>

        {/* 승자 목록 */}
        {winners.length > 0 && (
          <motion.div
            className="winners-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <div className="winners-list">
              {winners.map((winner, index) => (
                <span 
                  key={winner.id} 
                  className={`winner-item ${winner.id === player?.id ? 'is-me' : ''}`}
                >
                  {index + 1}위 {winner.nickname}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        <motion.p
          className="return-notice"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          잠시 후 로비로...
        </motion.p>
      </motion.div>
    </motion.div>
  );
};

export default GameOver;