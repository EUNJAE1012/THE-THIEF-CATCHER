import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useWebRTC } from '../contexts/WebRTCContext';
import Card from './Card';
import './GameBoard.css';

const GameBoard = () => {
  const { 
    gameState, 
    player, 
    drawCard, 
    sendCardHover, 
    sendCardHoverEnd, 
    hoverState 
  } = useGame();
  const { remoteStreams } = useWebRTC();
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawAnimation, setDrawAnimation] = useState(null);
  const [drawnCardData, setDrawnCardData] = useState(null);
  const [localHoverIndex, setLocalHoverIndex] = useState(null); 
  const [jokerPulled, setJokerPulled] = useState(false); 
  const [cardShuffleKey, setCardShuffleKey] = useState(0);
  const [stageTransition, setStageTransition] = useState(null); // 스테이지 전환 애니메이션
  const targetVideoRef = useRef(null);
  const drawerVideoRef = useRef(null); // 뽑는 사람 비디오

  if (!gameState) return null;

  const { players, currentTurnId, nextTargetId, myCards } = gameState;
  const isMyTurn = currentTurnId === player?.id;
  const targetPlayer = players.find(p => p.id === nextTargetId);
  const currentTurnPlayer = players.find(p => p.id === currentTurnId);
  
  // 내가 타겟인지 (다른 사람이 내 카드를 뽑는 상황)
  const amITarget = nextTargetId === player?.id;

  // 스테이지 전환 애니메이션 트리거
  useEffect(() => {
    if (targetPlayer) {
      setStageTransition('entering');
      const timer = setTimeout(() => setStageTransition(null), 500);
      return () => clearTimeout(timer);
    }
  }, [nextTargetId]);

  // VVV 이 두 useEffect 훅을 제거하거나 주석 처리하여, 아래 renderGridCell의 ref callback으로 대체합니다.
  /*
  // 타겟 플레이어 비디오 스트림 연결 (삭제 또는 주석 처리)
  useEffect(() => {
    const videoEl = targetVideoRef.current;
    if (videoEl && targetPlayer && !amITarget && remoteStreams[targetPlayer.id]) {
      videoEl.srcObject = remoteStreams[targetPlayer.id];
    }
  }, [targetPlayer, remoteStreams, amITarget]);

  // 뽑는 사람(drawer) 비디오 스트림 연결 (내가 타겟일 때) (삭제 또는 주석 처리)
  useEffect(() => {
    const videoEl = drawerVideoRef.current;
    if (videoEl && currentTurnPlayer && amITarget && remoteStreams[currentTurnPlayer.id]) {
      videoEl.srcObject = remoteStreams[currentTurnPlayer.id];
    }
  }, [currentTurnPlayer, remoteStreams, amITarget]);
  */
  // ^^^ 이 두 useEffect 훅을 제거하거나 주석 처리하여, 아래 renderGridCell의 ref callback으로 대체합니다.

  // 플레이어별 위치 계산
  const playerPositions = useMemo(() => {
    const positions = [1, 2, 3, 4, 6, 7, 9]; 
    const activePlayers = players.filter(p => !p.isEliminated);
    
    const sortedPlayers = [...activePlayers].sort((a, b) => {
      if (a.id === player?.id) return 1;
      if (b.id === player?.id || b.isEliminated) return -1;
      return a.nickname.localeCompare(b.nickname);
    }).filter(p => p.id !== player?.id);
    
    const map = { 8: players.find(p => p.id === player?.id) }; 

    for (let i = 0; i < sortedPlayers.length; i++) {
      map[positions[i]] = sortedPlayers[i];
    }

    return map;
  }, [players, player?.id]);

  // 카드 뽑기
  const handleDrawCard = async (cardIndex) => {
    if (!isMyTurn || !targetPlayer || isDrawing) return;
    setIsDrawing(true);
    setDrawAnimation({ targetPlayerId: targetPlayer.id, cardIndex }); 
    setDrawnCardData(null);

    try {
      const response = await drawCard(targetPlayer.id, cardIndex);
      
      if (response.success) {
        setDrawnCardData(response.result.drawnCard);
        
        await new Promise(resolve => setTimeout(resolve, 600)); 
        
        setCardShuffleKey(prev => prev + 1);

        if (response.result.drawnCard && response.result.drawnCard.isJoker) {
          setJokerPulled(true);
          setTimeout(() => setJokerPulled(false), 2000);
        }
      }
      
    } catch (error) {
      console.error('카드 뽑기 실패:', error);
    } finally {
      setDrawAnimation(null); 
      setDrawnCardData(null); 
      setIsDrawing(false);
    }
  };

  const renderGridCell = (position) => {
    const cellPlayer = playerPositions[position];

    // Position 5: 중앙 스테이지
    if (position === 5) {
      const canInteract = isMyTurn && !isDrawing;
      const centerCards = amITarget ? myCards : null;
      const centerCardCount = amITarget ? myCards.length : (targetPlayer?.cardCount || 0);
      
      return (
        <div className={`grid-cell center-cell ${(isMyTurn || amITarget) && targetPlayer ? 'focused' : ''}`}>
          <AnimatePresence mode="wait">
            {targetPlayer ? (
              <motion.div
                key={`target-${nextTargetId}`}
                className="target-area"
                initial={{ opacity: 0, scale: 0.8, y: amITarget ? 100 : 0 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: amITarget ? 100 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                {/* 비디오 컨테이너 */}
                <div className="target-video-container">
                  {amITarget ? (
                    // 내가 타겟일 때 - 뽑는 사람 얼굴 표시 (Drawer's video)
                    <>
                      <video
                        // Ref Callback으로 변경 (drawerVideoRef 유지)
                        ref={(el) => {
                          drawerVideoRef.current = el; // useRef 업데이트
                          const stream = currentTurnPlayer ? remoteStreams[currentTurnPlayer.id] : null;
                          if (el && stream && el.srcObject !== stream) {
                            el.srcObject = stream;
                          } else if (el && !stream && el.srcObject) {
                            el.srcObject = null; // 스트림이 없으면 해제
                          }
                        }}
                        autoPlay
                        playsInline
                        className="target-video"
                      />
                      {!remoteStreams[currentTurnPlayer?.id] && (
                        <div className="video-placeholder-overlay">
                          <span>{currentTurnPlayer?.nickname?.charAt(0)}</span>
                        </div>
                      )}
                      <div className="drawer-label">
                        <span className="drawer-name">{currentTurnPlayer?.nickname}</span>
                        <span className="drawer-action">이(가) 선택 중...</span>
                      </div>
                    </>
                  ) : (
                    // 내가 뽑는 사람일 때 - Target's video
                    <>
                      <video
                        // Ref Callback으로 변경 (targetVideoRef 유지)
                        ref={(el) => {
                          targetVideoRef.current = el; // useRef 업데이트
                          const stream = targetPlayer ? remoteStreams[targetPlayer.id] : null;
                          if (el && stream && el.srcObject !== stream) {
                            el.srcObject = stream;
                          } else if (el && !stream && el.srcObject) {
                            el.srcObject = null; // 스트림이 없으면 해제
                          }
                        }}
                        autoPlay
                        playsInline
                        className="target-video"
                      />
                      {!remoteStreams[targetPlayer.id] && (
                        <div className="video-placeholder-overlay">
                          <span>{targetPlayer.nickname?.charAt(0)}</span>
                        </div>
                      )}
                      <div className="target-video-label">
                        <span className="target-name">{targetPlayer.nickname}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* 카드 오버레이 - 캠 위에 */}
                <motion.div 
                  key={cardShuffleKey} 
                  className="target-cards-overlay-container"
                  initial={amITarget ? { y: 150, opacity: 0 } : { opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.1 }}
                >
                  {(() => {
                    const cardCount = centerCardCount;
                    const maxFanAngle = Math.min(50, cardCount * 7); 
                    const rotationStep = cardCount > 1 ? maxFanAngle / (cardCount - 1) : 0;
                    const startRotation = -maxFanAngle / 2;
                    const maxOffset = 20; 

                    return Array.from({ length: cardCount }).map((_, idx) => {
                      const rotation = startRotation + idx * rotationStep;
                      const offsetRatio = Math.abs(rotation) / (maxFanAngle / 2 || 1); 
                      const offsetY = maxOffset * (1 - Math.cos(offsetRatio * Math.PI / 2)); 
                      
                      const isLocalHovering = localHoverIndex === idx;
                      const isOtherHovering = hoverState && 
                        hoverState.cardIndex === idx &&
                        hoverState.hoverPlayerId !== player?.id;
                      
                      const isDrawingCard = drawAnimation && 
                        drawAnimation.cardIndex === idx;
                      
                      const isDrawnCardVisual = isDrawingCard && drawnCardData;
                      const showFront = amITarget || isDrawnCardVisual;
                      const cardData = amITarget ? centerCards[idx] : (isDrawnCardVisual ? drawnCardData : null);

                      return (
                        <motion.div
                          key={`${cardShuffleKey}-${idx}`}
                          className={`target-card-wrapper 
                            ${isOtherHovering ? 'other-hovering' : ''}
                            ${isLocalHovering ? 'local-hovering' : ''}
                          `}
                          initial={{ opacity: 0, y: 50, scale: 0.8 }}
                          animate={isDrawingCard ? {
                            opacity: 0,
                            scale: 1.5,
                            y: -200,
                            rotate: 0,
                          } : {
                            opacity: 1,
                            y: offsetY,
                            rotate: rotation,
                            scale: 1
                          }}
                          transition={isDrawingCard ? { 
                            duration: 0.5,
                            ease: 'easeOut'
                          } : {
                            duration: 0.3,
                            delay: idx * 0.02
                          }}
                          whileHover={canInteract ? { 
                            scale: 1.1, 
                            y: offsetY - 15,
                            transition: { duration: 0.15 }
                          } : {}} 
                          onClick={canInteract ? () => handleDrawCard(idx) : undefined} 
                          onMouseEnter={canInteract ? () => {
                            setLocalHoverIndex(idx);
                            sendCardHover(idx, targetPlayer.id);
                          } : undefined}
                          onMouseLeave={canInteract ? () => {
                            setLocalHoverIndex(null);
                            sendCardHoverEnd();
                          } : undefined}
                          style={{ 
                            zIndex: isLocalHovering || isOtherHovering ? 100 : idx, 
                            transformOrigin: 'bottom center', 
                          }}
                        >
                          <Card 
                            card={cardData}
                            isBack={!showFront} 
                            size="medium" 
                            isClickable={canInteract} 
                          />
                          
                          {isOtherHovering && (
                            <div className="hover-indicator">
                              {players.find(p => p.id === hoverState.hoverPlayerId)?.nickname}
                            </div>
                          )}
                        </motion.div>
                      );
                    });
                  })()}
                </motion.div>

                {/* 조커 알림 - 카드 위에 표시 */}
                <AnimatePresence>
                  {jokerPulled && (
                    <motion.div
                      className="joker-alert-inline"
                      initial={{ scale: 0, opacity: 0, y: 20 }}
                      animate={{ scale: [0, 1.2, 1], opacity: 1, y: 0 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <span className="joker-icon-inline">🃏</span>
                      <span className="joker-text-inline">조커!</span>
                    </motion.div>
                  )}
                </AnimatePresence>
            
                {/* 힌트 */}
                {isMyTurn && !amITarget && (
                  <div className="center-hint-area">
                    <p className="draw-hint">선택하세요</p>
                  </div>
                )}
              </motion.div>
            ) : ( 
              <motion.div
                key="no-target"
                className="waiting-turn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="turn-indicator">
                  {isMyTurn ? '내 차례' : currentTurnPlayer?.nickname}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // 나머지 셀들...
    if (cellPlayer) {
      if (cellPlayer.id === nextTargetId && position !== 8) { 
        return (
          <div className="grid-cell empty-cell transitioning">
            <motion.div 
              className="empty-slot"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0.3 }}
              transition={{ duration: 0.3 }}
            >
              <span className="empty-icon">↑</span>
            </motion.div>
          </div>
        );
      }
      
      if (cellPlayer.id === player?.id) {
        const cardCount = myCards.length;
        
        if (amITarget) {
          return (
            <div className={`grid-cell my-cell pos-${position} is-target`}>
              <div className="player-info-container">
                <span className="player-nickname">{cellPlayer.nickname} (나)</span>
              </div>
              <motion.div 
                className="my-cards-hint"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ↑ 중앙에서 선택됨
              </motion.div>
            </div>
          );
        }
        
        return (
          <div className={`grid-cell my-cell pos-${position}`}>
            <div className="player-info-container">
              <span className="player-nickname">{cellPlayer.nickname} (나)</span>
            </div>
            <div className="my-cards-container">
              {cardCount > 0 ? (
                myCards.map((card, idx) => (
                  <motion.div
                    key={`my-card-${idx}-${card.suit}-${card.value}`}
                    className="my-card-wrapper"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: idx * 0.02 }}
                    style={{ zIndex: idx }}
                  >
                    <Card card={card} size="small" />
                  </motion.div>
                ))
              ) : (
                <div className="eliminated-badge">🎉 승리</div>
              )}
            </div>
            {cellPlayer.id === currentTurnId && (
              <div className="current-turn-indicator">
                <span>내 차례</span>
              </div>
            )}
          </div>
        );
      }
      
      const cardCount = cellPlayer.cardCount;

      return (
        <div className={`grid-cell other-cell pos-${position}`}>
          <div className="player-video-container">
            {remoteStreams[cellPlayer.id] ? (
              <video
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && el.srcObject !== remoteStreams[cellPlayer.id]) {
                    el.srcObject = remoteStreams[cellPlayer.id];
                  }
                }}
              />
            ) : (
              <div className="video-placeholder">
                <span>{cellPlayer.nickname?.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="player-info-container">
            <span className="player-nickname">{cellPlayer.nickname}</span>
            <div className="card-count-display">
              {cardCount > 0 ? (
                <span className="card-count-text">🃏 {cardCount}</span>
              ) : (
                <span className="eliminated-text">완료</span>
              )}
            </div>
            {cellPlayer.id === currentTurnId && (
              <div className="current-turn-indicator">
                <span>차례</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid-cell empty-cell">
        <div className="empty-slot">
          <span className="empty-icon">♦</span>
        </div>
      </div>
    );
  };

  return (
    <div className="game-board">
      <div className="board-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(position => (
          <div key={position} className={`grid-position pos-${position}`}>
            {renderGridCell(position)}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isMyTurn && !targetPlayer && (
          <motion.div 
            className="turn-overlay"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            내 차례
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {jokerPulled && (
          <motion.div
            className="joker-alert"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.1, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <span className="joker-icon">🃏</span>
            <span className="joker-text">조커!</span>
          </motion.div>
        )}
      </AnimatePresence>

      
    </div>
  );
};

export default GameBoard;