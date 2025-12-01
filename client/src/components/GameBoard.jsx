import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useWebRTC } from '../contexts/WebRTCContext';
import { useBackgroundMusic } from '../hooks/useBackgroundMusic';
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
  const [targetHoverIndex, setTargetHoverIndex] = useState(null); // 뽑히는 사람의 hovering
  const [jokerPulled, setJokerPulled] = useState(false);
  const [cardShuffleKey, setCardShuffleKey] = useState(0);
  const [stageTransition, setStageTransition] = useState(null);
  const [collidingPairs, setCollidingPairs] = useState([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const targetVideoRef = useRef(null);
  const drawerVideoRef = useRef(null);
  const matchSoundRef = useRef(null);

  // Background music: play main theme during gameplay
  useBackgroundMusic('/sounds/main-theme.mp3', true, true, 0.3);

  if (!gameState) return null;

  const { players, currentTurnId, nextTargetId, myCards } = gameState;
  const isMyTurn = currentTurnId === player?.id;
  const targetPlayer = players.find(p => p.id === nextTargetId);
  const currentTurnPlayer = players.find(p => p.id === currentTurnId);
  

  const amITarget = nextTargetId === player?.id;

  useEffect(() => {
    if (targetPlayer) {
      setStageTransition('entering');
      const timer = setTimeout(() => setStageTransition(null), 500);
      return () => clearTimeout(timer);
    }
  }, [nextTargetId]);

  // matchedCards 감지 및 충돌 애니메이션 트리거
  useEffect(() => {
    if (gameState.matchedCards && gameState.matchedCards.length > 0) {
      // 카드를 2개씩 쌍으로 그룹화
      const pairs = [];
      for (let i = 0; i < gameState.matchedCards.length; i += 2) {
        if (i + 1 < gameState.matchedCards.length) {
          pairs.push([gameState.matchedCards[i], gameState.matchedCards[i + 1]]);
        }
      }

      if (pairs.length > 0) {
        setCollidingPairs(pairs);
        setCurrentPairIndex(0);
      }
    }
  }, [gameState.matchedCards]);

  // 순차적으로 페어 애니메이션 실행
  useEffect(() => {
    if (collidingPairs.length === 0) return;

    if (currentPairIndex < collidingPairs.length) {
      // 각 페어 애니메이션 후 다음 페어로
      const timer = setTimeout(() => {
        setCurrentPairIndex(prev => prev + 1);
      }, 1100); // 애니메이션 시간 + 여유

      return () => clearTimeout(timer);
    } else {
      // 모든 애니메이션 완료 후 상태 초기화
      setCollidingPairs([]);
      setCurrentPairIndex(0);
    }
  }, [currentPairIndex, collidingPairs]);

  // 충돌 시점에 사운드 재생
  useEffect(() => {
    if (collidingPairs.length > 0 && currentPairIndex < collidingPairs.length) {
      const soundTimer = setTimeout(() => {
        if (matchSoundRef.current) {
          matchSoundRef.current.currentTime = 0;
          matchSoundRef.current.play().catch(err => console.log('Sound play failed:', err));
        }
      }, 400); // 충돌 시점에 재생

      return () => clearTimeout(soundTimer);
    }
  }, [currentPairIndex, collidingPairs]);

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

    if (position === 5) {
      const canInteract = isMyTurn && !isDrawing;
      const canHoverAsTarget = amITarget && !isDrawing; // 뽑히는 사람도 hovering 가능
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
                <div className="target-video-container">
                  {amITarget ? (
                    // (Drawer's video)
                    <>
                      <video
                        // Ref Callback
                        ref={(el) => {
                          drawerVideoRef.current = el; 
                          const stream = currentTurnPlayer ? remoteStreams[currentTurnPlayer.id] : null;
                          if (el && stream && el.srcObject !== stream) {
                            el.srcObject = stream;
                          } else if (el && !stream && el.srcObject) {
                            el.srcObject = null; 
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
                        <span className="drawer-action">이(가) 선택중...</span>
                      </div>
                    </>
                  ) : (
                    // Target's video
                    <>
                      <video

                        ref={(el) => {
                          targetVideoRef.current = el; 
                          const stream = targetPlayer ? remoteStreams[targetPlayer.id] : null;
                          if (el && stream && el.srcObject !== stream) {
                            el.srcObject = stream;
                          } else if (el && !stream && el.srcObject) {
                            el.srcObject = null;
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
                      const isTargetHovering = targetHoverIndex === idx; // 뽑히는 사람의 hovering
                      
                      // 다른 사람의 hovering 감지 (뽑는 사람 또는 뽑히는 사람 모두)
                      const isOtherHovering = hoverState && 
                        hoverState.cardIndex === idx &&
                        hoverState.targetPlayerId === targetPlayer?.id &&
                        hoverState.hoverPlayerId !== player?.id;
                      
                      const isDrawingCard = drawAnimation && 
                        drawAnimation.cardIndex === idx;
                      
                      const isDrawnCardVisual = isDrawingCard && drawnCardData;
                      const showFront = amITarget || isDrawnCardVisual;
                      const cardData = amITarget ? centerCards[idx] : (isDrawnCardVisual ? drawnCardData : null);

                      // 뽑히는 사람의 hovering 시 위로 올라가는 효과
                      let hoverOffsetY = 0;
                      if (isTargetHovering && canHoverAsTarget) {
                        hoverOffsetY = -30; // 본인이 hovering - 30px 위로
                      } else if (isOtherHovering && hoverState.hoverPlayerId === targetPlayer?.id) {
                        hoverOffsetY = -30; // target이 hovering하는 것을 drawer가 봄 - 30px 위로
                      }

                      return (
                        <motion.div
                          key={`${cardShuffleKey}-${idx}`}
                          className={`target-card-wrapper 
                            ${isOtherHovering ? 'other-hovering' : ''}
                            ${isLocalHovering ? 'local-hovering' : ''}
                            ${isTargetHovering ? 'target-hovering' : ''}
                          `}
                          initial={{ opacity: 0, y: 50, scale: 0.8 }}
                          animate={isDrawingCard ? {
                            opacity: 0,
                            scale: 1.5,
                            y: -200,
                            rotate: 0,
                          } : {
                            opacity: 1,
                            y: offsetY + hoverOffsetY,
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
                          onMouseEnter={
                            canInteract ? () => {
                              setLocalHoverIndex(idx);
                              sendCardHover(idx, targetPlayer.id);
                            } : canHoverAsTarget ? () => {
                              setTargetHoverIndex(idx);
                              sendCardHover(idx, targetPlayer.id); // 서버로 전송
                            } : undefined
                          }
                          onMouseLeave={
                            canInteract ? () => {
                              setLocalHoverIndex(null);
                              sendCardHoverEnd();
                            } : canHoverAsTarget ? () => {
                              setTargetHoverIndex(null);
                              sendCardHoverEnd(); // 서버로 전송
                            } : undefined
                          }
                          style={{ 
                            zIndex: isLocalHovering || isOtherHovering || isTargetHovering ? 100 : idx, 
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
                              {hoverState.hoverPlayerId === targetPlayer?.id ? ' 👆' : ''}
                            </div>
                          )}
                        </motion.div>
                      );
                    });
                  })()}
                </motion.div>

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
                      <span className="joker-text-inline">조커 뽑았다!</span>
                    </motion.div>
                  )}
                </AnimatePresence>
            
                {/* 힌트 */}
                {isMyTurn && !amITarget && (
                  <div className="center-hint-area">
                    <p className="draw-hint">카드를 클릭하여 뽑으세요</p>
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
              <span className="empty-icon">→</span>
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
                <span className="player-nickname">{cellPlayer.nickname} (Me)</span>
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
              <span className="player-nickname">{cellPlayer.nickname} (Me)</span>
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
                <div className="eliminated-badge">🎉 승리!</div>
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
          <span className="empty-icon">텅</span>
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
            className="joker-alert-fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="joker-icons-container">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="joker-icon-huge"
                  initial={{ scale: 0, rotate: -180, y: 100 }}
                  animate={{ 
                    scale: [0, 1.3, 1], 
                    rotate: [i === 1 ? 0 : (i === 0 ? -15 : 15), i === 1 ? 0 : (i === 0 ? -10 : 10)],
                    y: 0 
                  }}
                  transition={{ 
                    delay: i * 0.1, 
                    type: 'spring', 
                    stiffness: 300, 
                    damping: 12 
                  }}
                >
                  🃏
                </motion.div>
              ))}
            </div>
            <motion.div 
              className="joker-text-huge"
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: [0, 1.2, 1], y: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 15 }}
            >
              조커!
            </motion.div>
            <motion.div 
              className="joker-subtext"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              조커 카드를 뽑았습니다!
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 카드 충돌 애니메이션 오버레이 */}
      <AnimatePresence mode="wait">
        {collidingPairs.length > 0 && currentPairIndex < collidingPairs.length && (
          <motion.div
            className="collision-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {collidingPairs[currentPairIndex].map((card, idx) => (
              <motion.div
                key={`colliding-${currentPairIndex}-${idx}`}
                className="colliding-card"
                initial={{
                  x: idx === 0 ? -200 : 200,
                  y: 100,
                  scale: 1,
                  opacity: 1
                }}
                animate={{
                  x: 0,
                  y: 0,
                  scale: [1, 1, 1.3, 0],
                  opacity: [1, 1, 1, 0],
                  rotate: [0, 0, 360, 360],
                  filter: [
                    'drop-shadow(0 0 0px gold)',
                    'drop-shadow(0 0 0px gold)',
                    'drop-shadow(0 0 30px gold)',
                    'drop-shadow(0 0 0px gold)'
                  ]
                }}
                transition={{
                  duration: 1.0,
                  times: [0, 0.4, 0.6, 1],
                  ease: ['easeOut', 'easeInOut', 'easeIn']
                }}
              >
                <Card card={card} size="small" />
              </motion.div>
            ))}

            {/* 충돌 시 반짝임 효과 */}
            <motion.div
              className="sparkle-burst"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2, 0], opacity: [0, 1, 0] }}
              transition={{ delay: 0.4, duration: 0.4 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 오디오 요소 */}
      <audio
        ref={matchSoundRef}
        src="/sounds/card-match.mp3"
        preload="auto"
      />

    </div>
  );
};

export default GameBoard;