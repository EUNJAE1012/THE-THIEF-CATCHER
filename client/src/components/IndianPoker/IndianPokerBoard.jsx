import React, { useState, useEffect, useRef } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { useGame } from '../../contexts/GameContext';

import { useSocket } from '../../contexts/SocketContext';

import { useWebRTC } from '../../contexts/WebRTCContext';

import { useBackgroundMusic } from '../../hooks/useBackgroundMusic';

import Card from "../common/Card";

import IndianPokerGameOver from './IndianPokerGameOver';

import './IndianPokerBoard.css';



const IndianPokerBoard = () => {

  const { gameState: globalGameState, player, room } = useGame();

  const { socket } = useSocket();

  const { remoteStreams, localStream } = useWebRTC();

 

  // 로컬 게임 상태 (서버 지연시간 동안 UI 반응성을 위해 내부 상태 유지 및 병합)

  const [localGameState, setLocalGameState] = useState(globalGameState);

 

  const [betAmount, setBetAmount] = useState(0);

  const [minBetAmount, setMinBetAmount] = useState(0);

  const [maxBetAmount, setMaxBetAmount] = useState(0);

 

  const [actionMessage, setActionMessage] = useState(null);

  const [revealData, setRevealData] = useState(null);

  const [isGameOver, setIsGameOver] = useState(false);

  const [finalWinner, setFinalWinner] = useState(null);

  const [revealLock, setRevealLock] = useState(false);



  const opponentVideoRef = useRef(null);

  const myVideoRef = useRef(null);

  const constraintsRef = useRef(null);

 

  const [lastRoundMyCard, setLastRoundMyCard] = useState(null);

  const [lastRoundOpponentCard, setLastRoundOpponentCard] = useState(null);







  // 배경 음악

  useBackgroundMusic('/sounds/main-theme.mp3', localGameState ? true : false, true, 0.3);



  // 글로벌 상태가 변하면 로컬 상태 동기화 (단, Reveal 중이 아닐 때만)

  useEffect(() => {

    if (globalGameState && !revealData) {

      setLocalGameState(globalGameState);

    }

  }, [globalGameState, revealData]);



  // 소켓 이벤트 리스너

  useEffect(() => {

    if (!socket) return;



    const handleStateUpdate = ({ gameState }) => {
      // 새 라운드 시작 신호
      const isNewRound = gameState.status === 'betting';

      if (isNewRound) {
        setRevealLock(false);   
        setRevealData(null);    
      }

      // revealLock이면 상태 무시하지만, 새 라운드라면 강제로 업데이트
      if (!revealLock || isNewRound) {
        setLocalGameState(gameState);
      }
    };




    // 액션 알림 (Bet, Call, Die)

    const handleAction = (data) => {
      const { action, playerId, amount, penalty } = data;
      let message = '';

      const isMe = playerId === player.id;

      const actorName = isMe ? '나' : (opponent?.nickname || '상대');



      switch (action) {

        case 'bet':

          message = `${actorName}: ${amount}칩 베팅!`;

          // 효과음 재생 로직 추가 가능

          break;

        case 'call':

          message = `${actorName}: 콜! (승부)`;

          break;

        case 'die':

          message = `${actorName}: 다이... (포기)`;
          
          if (penalty > 0) message += ` ☠️ 페널티 -${penalty}`;

          handleReveal({
            winner: data.winner,
            isDraw: false,
            cards: data.cards,
            gameOver: data.gameOver,
            finalWinner: data.finalWinner
          });
          break;

        default:

          break;

      }

      setActionMessage(message);

      setTimeout(() => setActionMessage(null), 2000);

    };



    // 카드 공개 및 라운드 결과 (Reveal)

    const handleReveal = ({ winner, isDraw, cards, gameOver, finalWinner: gameWinner }) => {

          setRevealLock(true);

          setRevealData({ winner, isDraw, cards });



          const myReveal = cards.find(c => c.playerId === player.id);

          const opReveal = cards.find(c => c.playerId !== player.id);



          setLastRoundMyCard(myReveal.card);

          setLastRoundOpponentCard(opReveal.card);



          // 3초 후 서버에 다음 라운드 요청

          setTimeout(() => {

              if (!gameOver) {

                  socket.emit("indian-poker-next-round");

              } else {
                // 3.5초 후 reveal 종료 (게임 오버 시)
                setTimeout(() => {
                    setRevealData(null);
                    setRevealLock(false);
                    setFinalWinner(gameWinner);
                    setIsGameOver(true);
                }, 500); // 3초 + 500ms
            } 

          }, 3000);

      };



    socket.on('indian-poker-state-update', handleStateUpdate);

    socket.on('indian-poker-action', handleAction);

    socket.on('indian-poker-reveal', handleReveal);

   

    // 게임 오버 별도 처리

    socket.on('game-over', ({ winner }) => {

      setFinalWinner(winner);

      setIsGameOver(true);

    });



    return () => {

      socket.off('indian-poker-state-update', handleStateUpdate);

      socket.off('indian-poker-action', handleAction);

      socket.off('indian-poker-reveal', handleReveal);

      socket.off('game-over');

    };

  }, [socket, player, revealData]);



  // 비디오 스트림 연결

  useEffect(() => {

    if (myVideoRef.current && localStream) {

      myVideoRef.current.srcObject = localStream;

    }

  }, [localStream]);



  useEffect(() => {

    if (opponentVideoRef.current && opponent && remoteStreams[opponent.id]) {

      opponentVideoRef.current.srcObject = remoteStreams[opponent.id];

    }

  }, [localGameState, remoteStreams]);



  if (!localGameState || !player) return <div className="loading">게임 로딩 중...</div>;



  const { players = [], pot = 0, currentBetterId, status } = localGameState;

  const me = players.find(p => p.id === player.id);

  const opponent = players.find(p => p.id !== player.id);



  const isMyTurn = currentBetterId === player.id && status === 'betting' && !revealData;

  const myCard = localGameState.myCard;

  const opponentCard = localGameState.opponentCard;



  // Reveal 모드일 때 보여줄 카드 정보 찾기

  let revealMyCard = null;

  let revealOpponentCard = null;

 

  if (revealData) {

    const myReveal = revealData.cards.find(c => c.playerId === player.id);

    const opReveal = revealData.cards.find(c => c.playerId !== player.id);

    revealMyCard = myReveal ? myReveal.card : null;

    revealOpponentCard = opReveal ? opReveal.card : null;

  }



  // 배팅 금액 계산 로직

  // 최소 배팅액: (상대 총 배팅 - 내 총 배팅) + 1. 즉, 상대를 넘어서야 함.

  useEffect(() => {

    if (isMyTurn && me && opponent) {

      const callCost = opponent.totalBet - me.totalBet; // 콜 비용

      const minRaise = 1;

      // 내 칩이 콜 비용보다 적으면 올인밖에 못함

      if (me.chips <= callCost) {

        // 사실상 콜(올인)만 가능하거나 다이

        setMinBetAmount(me.chips);

        setMaxBetAmount(me.chips);

        setBetAmount(me.chips);

      } else {

        // 콜 비용을 내고 +1 이상 더 배팅해야 '베팅(Raise)'이 됨

        // 하지만 서버 placeBet 로직은 `amount` 파라미터가 "이번 턴에 추가로 낼 칩"임.

        // 그리고 player.totalBet + amount > opponent.totalBet 이어야 함.

        // 즉 amount > opponent.totalBet - me.totalBet

        const minBet = (opponent.totalBet - me.totalBet) + 1;

        setMinBetAmount(minBet);

        setMaxBetAmount(me.chips); // 가진 전재산까지 배팅 가능

        setBetAmount(minBet);

      }

    }

  }, [isMyTurn, me?.totalBet, me?.chips, opponent?.totalBet]);





  const handleBet = () => {

    if (!isMyTurn) return;

    socket.emit('indian-poker-bet', { amount: betAmount }, (res) => {

      if (!res.success) alert(res.error);

    });

  };



  const handleCall = () => {

    if (!isMyTurn) return;

    socket.emit('indian-poker-call', (res) => {

      if (!res.success) alert(res.error);

    });

  };



  const handleDie = () => {

    if (!isMyTurn) return;

    socket.emit('indian-poker-die', (res) => {

      if (!res.success) alert(res.error);

    });

  };



  return (

    <div className="indian-poker-board" ref={constraintsRef}>

      {/* 게임 오버 화면 */}

      <AnimatePresence>

        {isGameOver && (

          <IndianPokerGameOver

            winner={finalWinner}

            isMe={finalWinner?.id === player.id}

            onClose={() => setIsGameOver(false)}

          />

        )}

      </AnimatePresence>







      {/* POT 영역 */}

      <div className="center-area">

        <motion.div

          className="pot-display"

          animate={{ scale: [1, 1.05, 1] }}

          transition={{ duration: 0.5, repeat: pot > 0 ? Infinity : 0, repeatDelay: 2 }}

        >

          <div className="pot-label">배팅 테이블</div>

          <div className="pot-amount">

            <span className="chip-icon">🪙</span>

            <span className="pot-value">{pot}</span>

          </div>

        </motion.div>



        {/* 턴 표시 */}

        {!revealData && status === 'betting' && (

          <div className={`turn-indicator ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>

            {isMyTurn ? '나의 턴!' : '상대 생각 중...'}

          </div>

        )}

      </div>



<div className="middle-column">

      {/* 상대방 영역 (12시) */}

      <div className={`player-area opponent-area ${currentBetterId === opponent?.id ? 'active-turn' : ''}`}>



        <div className="video-container">

          <video ref={opponentVideoRef} autoPlay playsInline className="player-video" />

          {!remoteStreams[opponent?.id] && (

            <div className="video-placeholder"><span>{opponent?.nickname?.charAt(0)}</span></div>

          )}

         

          {/* 상대 카드는 항상 보임 (Reveal 때는 결과 카드 사용) */}

          <div className="card-overlay">

            <Card

              card={

                revealData

                  ? (revealOpponentCard || lastRoundOpponentCard)

                  : opponentCard

              }

              size="medium"

            />



          </div>

         
          <div className="player-info">

          <span className="player-nickname">{opponent?.nickname || '상대'}</span>

          <div className="chips-display">

            <span className="chip-icon">🪙</span>

            <span className="chip-count">{opponent?.chips || 0}</span>

            <span className="bet-status">

              (Bet: {opponent?.totalBet || 0})

            </span>

          </div>

          </div>

          {/* 승리/패배 표시 (Reveal 시) */}

          {revealData && (

            <motion.div

              initial={{ opacity: 0, scale: 0.5 }}

              animate={{ opacity: 1, scale: 1 }}

              className="round-result-badge"

            >

              {revealData.isDraw ? "무승부" : (revealData.winner?.id === opponent.id ? "WIN 👑" : "LOSE 😭")}

            </motion.div>

          )}

        </div>

       


      </div>

      {/* 본인 영역 (6시) */}

      <div className={`player-area my-area ${isMyTurn ? 'active-turn' : ''}`}>
                  
          <div className="video-container">

            <video ref={myVideoRef} autoPlay playsInline muted className="player-video" />

            {!localStream && (

              <div className="video-placeholder"><span>{me?.nickname?.charAt(0)}</span></div>

            )}

         

          {/* 내 카드: 평소엔 뒷면, Reveal 때는 앞면 공개 */}

          <div className="card-overlay">

            {revealData ? (

              <motion.div

                initial={{ rotateY: 180 }}

                animate={{ rotateY: 0 }}

                transition={{ duration: 0.6 }}

              >

                <Card

                  card={

                    revealData

                      ? (revealMyCard || lastRoundMyCard)

                      : myCard

                  }

                  size="medium"

                />

              </motion.div>

            ) : (

              <Card isBack={true} size="medium" />

            )}

          </div>

          <div className="player-info">

          <span className="player-nickname">{me?.nickname || '나'}</span>

          <div className="chips-display">

            <span className="chip-icon">🪙</span>

            <span className="chip-count">{me?.chips || 0}</span>

            <span className="bet-status">

              (Bet: {me?.totalBet || 0})

            </span>

          </div>

         </div>

          {/* 승리/패배 표시 (Reveal 시) */}

          {revealData && (

            <motion.div

              initial={{ opacity: 0, scale: 0.5 }}

              animate={{ opacity: 1, scale: 1 }}

              className="round-result-badge"

            >

              {revealData.isDraw ? "무승부" : (revealData.winner?.id === me.id ? "WIN 👑" : "LOSE 😭")}

            </motion.div>

          )}

        </div>



       



      </div>

</div>

      {/* 배팅 UI (내 턴일 때만 표시) */}

      <AnimatePresence>

        {isMyTurn && (

          <motion.div

            className="betting-ui"

            initial={{ opacity: 0, y: 50 }}

            animate={{ opacity: 1, y: 0 }}

            exit={{ opacity: 0, y: 50 }}

            drag

            dragMomentum={false}

            dragElastic={0}

            dragConstraints={constraintsRef}

          >

            <div className="bet-controls">

              {/* 베팅 조절 슬라이더 */}

              <div className="bet-slider-container">

                 <input

                   type="range"

                   min={minBetAmount}

                   max={maxBetAmount}

                   value={betAmount}

                   onChange={(e) => setBetAmount(parseInt(e.target.value))}

                   disabled={minBetAmount >= maxBetAmount}

                   className="bet-range"

                 />

              </div>



              <div className="bet-amount-selector">

                <button

                  className="bet-adjust-btn"

                  onClick={() => setBetAmount(Math.max(minBetAmount, betAmount - 1))}

                  disabled={betAmount <= minBetAmount}

                >

                  -

                </button>

                <div className="bet-amount-display">

                  <span className="chip-icon">🪙</span>

                  <span>{betAmount}</span>

                </div>

                <button

                  className="bet-adjust-btn"

                  onClick={() => setBetAmount(Math.min(maxBetAmount, betAmount + 1))}

                  disabled={betAmount >= maxBetAmount}

                >

                  +

                </button>

              </div>



              <div className="action-buttons">

                <button className="action-btn die-btn" onClick={handleDie}>

                  다이 (Die)

                </button>

                <button className="action-btn call-btn" onClick={handleCall}>

                  콜 (Call)

                </button>

                <button

                  className="action-btn bet-btn"

                  onClick={handleBet}

                  disabled={me.chips < minBetAmount}

                >

                  베팅 (Bet)

                </button>

              </div>

              <div className="bet-info-text">

                {betAmount === me.chips ? '올인!' : `${betAmount}개 더 걸기`}

              </div>

            </div>

          </motion.div>

        )}

      </AnimatePresence>



      {/* 액션 메시지 (Check! Call! Die!) */}

      <AnimatePresence>

        {actionMessage && (

          <motion.div

            className="action-message"

            initial={{ scale: 0, opacity: 0 }}

            animate={{ scale: 1, opacity: 1 }}

            exit={{ scale: 0, opacity: 0 }}

            transition={{ type: 'spring', stiffness: 300, damping: 20 }}

          >

            <span className="action-text">{actionMessage}</span>

          </motion.div>

        )}

      </AnimatePresence>

    </div>

  );

};

export default IndianPokerBoard; 