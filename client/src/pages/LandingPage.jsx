import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isConnected } = useSocket();
  const { createRoom, joinRoom, error, clearError } = useGame();

  const [selectedGame, setSelectedGame] = useState('doduk'); // 'doduk' or 'indian-poker'
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleCreateRoom = async () => {
    if (!isConnected) {
      setLocalError('서버에 연결 중입니다...');
      return;
    }
    
    setIsLoading(true);
    setLocalError('');
    
    try {
      const response = await createRoom(nickname || null, selectedGame);
      navigate(`/game/${response.roomCode}`);
    } catch (err) {
      setLocalError(err || '방 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const gameInfo = {
    doduk: {
      title: '도둑잡기',
      subtitle: 'THE THIEF CATCHER',
      players: '2~6인',
      description: '조커를 마지막까지 들고 있는 자가 도둑이다'
    },
    'indian-poker': {
      title: '인디언 포커',
      subtitle: 'INDIAN POKER',
      players: '2인',
      description: '상대의 카드만 보이는 치열한 심리전'
    }
  };

  const handleJoinRoom = async () => {
    if (!isConnected) {
      setLocalError('서버에 연결 중입니다...');
      return;
    }
    
    if (!roomCode.trim()) {
      setLocalError('방 코드를 입력해주세요.');
      return;
    }
    
    setIsLoading(true);
    setLocalError('');
    
    try {
      await joinRoom(roomCode.toUpperCase(), nickname || null);
      navigate(`/game/${roomCode.toUpperCase()}`);
    } catch (err) {
      setLocalError(err || '방 참여에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-container">
      {/* Atmospheric background elements */}
      <div className="bg-smoke smoke-1" />
      <div className="bg-smoke smoke-2" />
      <div className="bg-smoke smoke-3" />
      <div className="bg-gradient" />
      <div className="bg-vignette" />
      
      {/* Decorative card elements */}
      <div className="floating-card card-1">♠</div>
      <div className="floating-card card-2">♥</div>
      <div className="floating-card card-3">♦</div>
      <div className="floating-card card-4">♣</div>
      
      {/* Main content */}
      <motion.div 
        className="landing-content"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Game Selection Tabs */}
        <motion.div
          className="game-tabs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <button
            className={`game-tab ${selectedGame === 'doduk' ? 'active' : ''}`}
            onClick={() => setSelectedGame('doduk')}
          >
            도둑잡기
          </button>
          <button
            className={`game-tab ${selectedGame === 'indian-poker' ? 'active' : ''}`}
            onClick={() => setSelectedGame('indian-poker')}
          >
            인디언<br/> 포커
          </button>
        </motion.div>

        {/* Logo/Title */}
        <div className="title-section">
          <motion.div
            className="title-decoration"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          />
          <motion.h1
            className="main-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            key={selectedGame}
          >
            {gameInfo[selectedGame].title}
          </motion.h1>
          <motion.p
            className="subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            key={`${selectedGame}-subtitle`}
          >
            {gameInfo[selectedGame].subtitle}
          </motion.p>
          <motion.div
            className="title-decoration bottom"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          />
        </div>

        {/* Connection status */}
        <motion.div 
          className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <span className="status-dot" />
          {isConnected ? '서버 연결됨' : '연결 중...'}
        </motion.div>

        {/* Input section */}
        <motion.div 
          className="input-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div className="input-wrapper">
            <label htmlFor="nickname">닉네임</label>
            <input
              id="nickname"
              type="text"
              placeholder="입력하지 않으면 랜덤 생성"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
            />
          </div>
        </motion.div>

        {/* Error message */}
        <AnimatePresence>
          {(localError || error) && (
            <motion.div 
              className="error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {localError || error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buttons */}
        <motion.div 
          className="button-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <button 
            className="primary-button"
            onClick={handleCreateRoom}
            disabled={isLoading || !isConnected}
          >
            <span className="button-icon">🎴</span>
            <span className="button-text">방 생성</span>
            <span className="button-shine" />
          </button>
          
          <button 
            className="secondary-button"
            onClick={() => setShowJoinModal(true)}
            disabled={isLoading || !isConnected}
          >
            <span className="button-icon">🚪</span>
            <span className="button-text">방 참여</span>
          </button>
        </motion.div>

        {/* Game info */}
        <motion.div
          className="game-info"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          key={`${selectedGame}-info`}
        >
          <p>{gameInfo[selectedGame].players} 실시간 멀티플레이어 카드 게임</p>
          <p className="info-detail">{gameInfo[selectedGame].description}</p>
        </motion.div>
      </motion.div>

      {/* Join Room Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowJoinModal(false)}
          >
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>방 참여</h2>
              <div className="modal-input-wrapper">
                <label htmlFor="roomCode">방 코드</label>
                <input
                  id="roomCode"
                  type="text"
                  placeholder="6자리 코드 입력"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  autoFocus
                />
              </div>
              
              {localError && (
                <div className="modal-error">{localError}</div>
              )}
              
              <div className="modal-buttons">
                <button 
                  className="modal-cancel"
                  onClick={() => {
                    setShowJoinModal(false);
                    setLocalError('');
                    setRoomCode('');
                  }}
                >
                  취소
                </button>
                <button 
                  className="modal-confirm"
                  onClick={handleJoinRoom}
                  disabled={isLoading}
                >
                  {isLoading ? '참여 중...' : '참여하기'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;
