import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Lobby from '../components/Lobby';
import GameBoard from '../components/GameBoard';
import Chat from '../components/Chat';
import VideoGrid from '../components/VideoGrid';
import GameOver from '../components/GameOver';
import './GameRoom.css';

const GameRoom = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { room, player, gameState, isInGame, joinRoom, error, showGameOver } = useGame();
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    // URL로 직접 접근한 경우 방에 참여 시도
    if (isConnected && !room && !isJoining && roomCode) {
      const attemptJoin = async () => {
        setIsJoining(true);
        try {
          // 이미 닉네임이 있으면 사용, 없으면 null (랜덤 생성)
          const savedNickname = sessionStorage.getItem('nickname');
          await joinRoom(roomCode, savedNickname);
        } catch (err) {
          setJoinError(err || '방 참여에 실패했습니다.');
          setTimeout(() => navigate('/'), 3000);
        } finally {
          setIsJoining(false);
        }
      };
      attemptJoin();
    }
  }, [isConnected, room, roomCode, isJoining]);

  // 에러 상태
  if (joinError) {
    return (
      <div className="game-room error-state">
        <div className="error-container">
          <h2>😞 오류</h2>
          <p>{joinError}</p>
          <p className="redirect-message">잠시 후 홈으로 이동합니다...</p>
        </div>
      </div>
    );
  }

  // 로딩 상태
  if (isJoining || !room) {
    return (
      <div className="game-room loading-state">
        <div className="loading-container">
          <div className="loading-cards">
            <span className="loading-card">♠</span>
            <span className="loading-card">♥</span>
            <span className="loading-card">♦</span>
            <span className="loading-card">♣</span>
          </div>
          <p>방에 입장하는 중...</p>
        </div>
      </div>
    );
  }

  const isGameOver = showGameOver && gameState?.gameOver && gameState?.loser;

  return (
    <div className="game-room">
      <div className="room-header">
        <div className="room-info">
          <span className="room-code-label">방 코드</span>
          <span className="room-code">{room.roomCode}</span>
          <button 
            className="copy-button"
            onClick={() => {
              navigator.clipboard.writeText(room.roomCode);
            }}
          >
            복사
          </button>
        </div>
        <div className="player-info">
          <span className="player-name">{player?.nickname}</span>
          {player?.isHost && <span className="host-badge">방장</span>}
        </div>
      </div>

      <div className="room-content">
        <AnimatePresence mode="wait">
          {!isInGame ? (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lobby-wrapper"
            >
              <Lobby />
            </motion.div>
          ) : (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="game-wrapper"
            >
              <GameBoard />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sidebar">
          <VideoGrid />
          <Chat />
        </div>
      </div>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {isGameOver && <GameOver />}
      </AnimatePresence>
    </div>
  );
};

export default GameRoom;