import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import './Lobby.css';

const Lobby = () => {
  const navigate = useNavigate();
  const { room, player, toggleReady, startGame, leaveRoom, changeNickname, error, clearError } = useGame();
  const [isStarting, setIsStarting] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');

  const handleToggleReady = async () => {
    if (isTogglingReady) return;
    setIsTogglingReady(true);
    setLocalError('');
    try {
      await toggleReady();
    } catch (err) {
      setLocalError(err || '준비 상태 변경에 실패했습니다.');
    } finally {
      setIsTogglingReady(false);
    }
  };

  const handleStartGame = async () => {
    setIsStarting(true);
    setLocalError('');
    try {
      await startGame();
    } catch (err) {
      setLocalError(err || '게임 시작에 실패했습니다.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    navigate('/');
  };

  const handleNicknameEdit = () => {
    setNewNickname(player?.nickname || '');
    setIsEditingNickname(true);
  };

  const handleNicknameSubmit = async () => {
    if (!newNickname.trim() || newNickname.trim() === player?.nickname) {
      setIsEditingNickname(false);
      return;
    }
    try {
      await changeNickname(newNickname.trim());
      setIsEditingNickname(false);
    } catch (err) {
      setLocalError(err || '닉네임 변경에 실패했습니다.');
    }
  };

  const handleNicknameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNicknameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingNickname(false);
    }
  };

  const allReady = room.players.every(p => p.isHost || p.isReady);
  const canStart = player?.isHost && room.players.length >= 2 && allReady;

  // 현재 플레이어의 준비 상태 (room에서 가져옴)
  const currentPlayer = room.players.find(p => p.id === player?.id);
  const isReady = currentPlayer?.isReady || false;

  return (
    <div className="lobby">
      <div className="lobby-content">
        <div className="lobby-header">
          <h2>대기실</h2>
          <p className="game-type">도둑잡기</p>
        </div>

        {/* Player List */}
        <div className="player-list">
          <h3>플레이어 ({room.players.length}/6)</h3>
          <div className="player-grid">
            {room.players.map((p, index) => (
              <motion.div
                key={p.id}
                className={`player-slot ${p.id === player?.id ? 'is-me' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="player-avatar">
                  {p.nickname.charAt(0)}
                </div>
                <div className="player-details">
                  {p.id === player?.id && isEditingNickname ? (
                    <div className="nickname-edit">
                      <input
                        type="text"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        onKeyDown={handleNicknameKeyDown}
                        onBlur={handleNicknameSubmit}
                        maxLength={12}
                        autoFocus
                        className="nickname-input"
                      />
                    </div>
                  ) : (
                    <span 
                      className={`player-nickname ${p.id === player?.id ? 'editable' : ''}`}
                      onClick={p.id === player?.id ? handleNicknameEdit : undefined}
                    >
                      {p.nickname}
                      {p.id === player?.id && ' (나)'}
                      {p.id === player?.id && <span className="edit-icon">✏️</span>}
                    </span>
                  )}
                  <div className="player-badges">
                    {p.isHost && <span className="badge host">방장</span>}
                    {!p.isHost && (
                      <motion.span 
                        className={`badge ${p.isReady ? 'ready' : 'waiting'}`}
                        key={`ready-${p.id}-${p.isReady}`}
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500 }}
                      >
                        {p.isReady ? '✔ 준비 완료' : '대기 중'}
                      </motion.span>
                    )}
                  </div>
                </div>
                {/* 준비 상태 인디케이터 */}
                {!p.isHost && (
                  <div className={`ready-indicator ${p.isReady ? 'ready' : ''}`}>
                    {p.isReady ? '✔' : '○'}
                  </div>
                )}
              </motion.div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: 6 - room.players.length }).map((_, index) => (
              <div key={`empty-${index}`} className="player-slot empty">
                <div className="player-avatar empty">?</div>
                <div className="player-details">
                  <span className="player-nickname">빈 슬롯</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {(localError || error) && (
            <motion.div 
              className="lobby-error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {localError || error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons - 상단으로 이동 */}
        <div className="lobby-actions">
          {player?.isHost ? (
            <motion.button
              className="start-button"
              onClick={handleStartGame}
              disabled={!canStart || isStarting}
              whileHover={canStart ? { scale: 1.02 } : {}}
              whileTap={canStart ? { scale: 0.98 } : {}}
            >
              {isStarting ? '시작 중...' : 
               !allReady ? '⏳ 모든 플레이어 준비 필요' :
               room.players.length < 2 ? '👥 최소 2명 필요' :
               '🎮 게임 시작'}
            </motion.button>
          ) : (
            <motion.button
              className={`ready-button ${isReady ? 'is-ready' : ''}`}
              onClick={handleToggleReady}
              disabled={isTogglingReady}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={isReady ? 'ready' : 'not-ready'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {isTogglingReady ? '처리 중...' :
                   isReady ? '❌ 준비 취소' : '✔ 준비 완료'}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          )}
        </div>

        {/* Ready Status Summary */}
        <div className="ready-status-summary">
          <span className="ready-count">
            준비 완료: {room.players.filter(p => p.isHost || p.isReady).length} / {room.players.length}
          </span>
          {!allReady && room.players.length >= 2 && (
            <span className="waiting-message">
              {room.players.filter(p => !p.isHost && !p.isReady).map(p => p.nickname).join(', ')}님의 준비를 기다리는 중...
            </span>
          )}
        </div>

        {/* Share Link - 상단으로 이동 */}
        <div className="share-section">
          <p>친구를 초대하세요!</p>
          <div className="share-link">
            <input 
              type="text" 
              value={`${window.location.origin}/game/${room.roomCode}`}
              readOnly
            />
            <button onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/game/${room.roomCode}`);
            }}>
              복사
            </button>
          </div>
        </div>

        {/* Exit Button */}
        <div className="exit-section">
          <button className="exit-button" onClick={handleLeaveRoom}>
            🚪 나가기
          </button>
        </div>

        {/* Game Rules - 하단으로 이동 */}
        <div className="game-rules">
          <h3>게임 규칙</h3>
          <ul>
            <li>53장의 카드(조커 포함)를 모든 플레이어에게 분배합니다.</li>
            <li>같은 숫자의 카드가 2장 또는 4장이면 버립니다.</li>
            <li>차례대로 옆 사람의 카드를 한 장씩 뽑습니다.</li>
            <li>모든 카드를 버리면 승리! 조커를 끝까지 가진 사람이 도둑입니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Lobby;