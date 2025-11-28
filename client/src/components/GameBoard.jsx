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
  const [stageTransition, setStageTransition] = useState(null); 
  const targetVideoRef = useRef(null);
  const drawerVideoRef = useRef(null); 

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
      console.error('ì¹´ë“œ ë½‘ê¸° ì‹¤íŒ¨:', error);
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
                        <span className="drawer-action">ì´(ê°€) ì„ íƒ ì¤‘...</span>
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
            
                {/* ížŒíŠ¸ */}
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
                  {isMyTurn ? 'ë‚´ ì°¨ë¡€' : currentTurnPlayer?.nickname}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // ë‚˜ë¨¸ì§€ ì…€ë“¤...
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

      
    </div>
  );
};

export default GameBoard;