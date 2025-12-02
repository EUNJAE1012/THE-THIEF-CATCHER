import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../contexts/GameContext';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useBackgroundMusic } from '../../hooks/useBackgroundMusic';
import './GameOver.css';

// 조롱 문구들
const MOCK_MESSAGES = [
  "🤡 응 너가 범인이야~~~ 🤡",
  "👶 잘 모르시나본데 조커🃏를 들고있으면 지는거에요. 이 게임이 어렵나?🧠",
  "😈 당신의 게임 실력에 온 우주가 감탄합니다. 👽",
  "🤖 너 완전 핵심을 짚었어. 너 게임 100% 못해.🤸‍♂️",
  "🤷‍♀️ 전방에 힘찬 조롱 10초간 발사!!!! 💩",
  "👀 포브스 선정 올해 최악의 게이머 그것은 바로..👎",
  "🚨 속보 이 사람 게임 개 못 함🤾‍♂️",
  "😱 충격 실화 공포 패배 표정 박제 🎬",
  "🎭 아 그거 그렇게 하는거 아닌데, 아 그거 그렇게 하는거 아닌데 아 그거..🦶",
  "🦧 원숭이도 이것보단 잘해요 🐒",
  "🤦 아 진짜 이걸 못해요...? 🤦‍♂️",
  "📉 주식보다 더 떨어진 게임 실력 🤡🤡🤡",
  "🎪 너 재능있어. 더 열심히 해. 🤹",
  "🎰 운빨도 실력이죠? 근데 둘 다 없네 🎲",
  "ㅋㅋㅋㅋㅋㅋ",
  "🎯 과녁을 다 피해가는 신기한 능력 🏹",
  "속보) 대한민국 핵 보유국… 🇰🇷 얘 게임 개못핵 ㅋㅋ 💣💣💣",
];

const SHAME_EMOJIS = ["😂", "🤣", "😆", "🤭", "😹", "💀", "🪦", "⚰️", "🎪", "🤡", "👎", "🫵", "😝", "🤪"];

const GameOver = () => {
  const navigate = useNavigate();
  const { gameState, room, player, playAgain, leaveRoom, showGameOver } = useGame();
  const { remoteStreams, localStream } = useWebRTC();
  const loserVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const [mockPhase, setMockPhase] = useState(0);
  const [confetti, setConfetti] = useState([]);
  const [fallingMessages, setFallingMessages] = useState([]);
  const [captureNotice, setCaptureNotice] = useState(null);
  const [hasCaptured, setHasCaptured] = useState(false);

  // Background music: play game-end music on loop when game over is shown
  useBackgroundMusic('/sounds/game-end.mp3', showGameOver, true, 0.4);

  const { loser, winners = [] } = gameState || {};
  const isLoser = loser?.id === player?.id;

  // 비디오 스트림 연결
  useEffect(() => {
    if (!showGameOver) return; 
    if (!loserVideoRef.current) return;
    if (!loser) return;

      if (loser.id === player?.id && localStream) {
        loserVideoRef.current.srcObject = localStream;
      } else if (remoteStreams[loser.id]) {
        loserVideoRef.current.srcObject = remoteStreams[loser.id];
      }
    
  }, [loser, localStream, remoteStreams, player?.id]);

  // 패배자 얼굴 캡쳐 함수 (isLoser일 때만 실행)
  const captureLoserFace = useCallback(() => {
    const video = loserVideoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState < 2) {
      console.log('Video not ready for capture');
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // 비디오 프레임 그리기
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 수치스러운 프레임 추가
    ctx.fillStyle = 'rgba(196, 30, 58, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 상단 WANTED 텍스트
    ctx.fillStyle = '#c41e3a';
    ctx.fillRect(0, 0, canvas.width, 60);
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('🚨 WANTED 🚨', canvas.width / 2, 45);
    
    // 하단 정보
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#d4af37';
    ctx.fillText('🃏 도둑: ' + (loser?.nickname || '') + ' 🃏', canvas.width / 2, canvas.height - 45);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(new Date().toLocaleString('ko-KR'), canvas.width / 2, canvas.height - 15);
    
    // 조커 이모지 추가
    ctx.font = '60px Arial';
    ctx.fillText('🃏', 30, 100);
    ctx.fillText('🃏', canvas.width - 70, 100);
    
    // 다운로드
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '도둑_' + (loser?.nickname || 'unknown') + '_' + Date.now() + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setCaptureNotice('📸 수치스러운 순간이 저장되었습니다!');
        setTimeout(() => setCaptureNotice(null), 3000);
      }
    }, 'image/png');
  }, [loser]);

  // 3초 후 캡쳐 (isLoser일 때만 실행)
  useEffect(() => {
    if (isLoser && !hasCaptured) {
      const captureTimer = setTimeout(() => {
        setCaptureNotice('📸 3... 2... 1... 찰칵!');
        setTimeout(() => {
          captureLoserFace();
          setHasCaptured(true);
        }, 1000);
      }, 3000);
      return () => clearTimeout(captureTimer);
    }
  }, [captureLoserFace, hasCaptured, isLoser]); // isLoser를 의존성 배열에 추가

  // 조롱 페이즈 타이머 (10초 카운트다운)
  useEffect(() => {
    if (mockPhase < 11) {
      const timer = setTimeout(() => {
        setMockPhase(prev => prev + 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mockPhase]);

  // 떨어지는 조롱 메시지 생성 - 비처럼 계속 생성 (모든 플레이어가 볼 수 있음)
  useEffect(() => {
    if (mockPhase >= 11) return; // mockPhase가 11 이상이면 실행하지 않음
    
    // 초기 메시지들 생성
    const initialMessages = [];
    for (let i = 0; i < 15; i++) {
      initialMessages.push({
        id: Date.now() + i,
        text: MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)],
        x: Math.random() * 90 + 5, // 5% ~ 95%
        size: Math.random() * 14 + 14, // 14px ~ 28px
        duration: Math.random() * 6 + 8, // 8s ~ 14s (더 천천히)
        delay: Math.random() * 3, // 시작 딜레이
        rotation: Math.random() * 20 - 10, // -10deg ~ 10deg
      });
    }
    setFallingMessages(initialMessages);

    // 주기적으로 새 메시지 추가
    const interval = setInterval(() => {
      const newMessage = {
        id: Date.now() + Math.random(),
        text: MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)],
        x: Math.random() * 90 + 5,
        size: Math.random() * 14 + 14,
        duration: Math.random() * 6 + 8,
        delay: 0,
        rotation: Math.random() * 20 - 10,
      };
      
      setFallingMessages(prev => {
        // 오래된 메시지 정리 (최대 40개)
        const filtered = prev.length > 40 ? prev.slice(-30) : prev;
        return [...filtered, newMessage];
      });
    }, 500); // 0.5초마다 새 메시지
    
    return () => clearInterval(interval);
  }, [mockPhase]); // mockPhase만 의존성으로 관리

  // 컨페티 생성 (isLoser일 때만 실행)
  useEffect(() => {
    if (!isLoser) return;
    const newConfetti = [];
    for (let i = 0; i < 60; i++) {
      newConfetti.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 4,
        emoji: SHAME_EMOJIS[Math.floor(Math.random() * SHAME_EMOJIS.length)],
        size: 20 + Math.random() * 40,
      });
    }
    setConfetti(newConfetti);
  }, [isLoser]); // isLoser를 의존성 배열에 추가

  const handlePlayAgain = () => {
    playAgain();
  };

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  const countdown = 10 - mockPhase;
  const showButtons = mockPhase >= 11;

  // Early return 조건: hooks는 모두 호출된 이후에 실행
  if (!gameState?.gameOver || !gameState?.loser || !showGameOver) return null;

  return (
    <motion.div
      className="game-over-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="game-over-backdrop" />
      
      {/* ⚠️ 패배자에게만 캡쳐용 캔버스/알림, 조롱 애니메이션/메시지를 렌더링하도록 조건 추가 */}
      {isLoser && <canvas ref={canvasRef} style={{ display: 'none' }} />}
      
      <AnimatePresence>
        {captureNotice && (
          <motion.div
            className="capture-notice"
            initial={{ opacity: 0, scale: 0.5, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -50 }}
          >
            {captureNotice}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 컨페티 (조롱용 이모지 비) */}
      <div className="confetti-container">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="confetti-piece"
            style={{ 
              left: c.x + '%', 
              fontSize: c.size,
              animationDuration: c.duration + 's',
              animationDelay: c.delay + 's',
            }}
          >
            {c.emoji}
          </div>
        ))}
      </div>

      {/* 떨어지는 조롱 메시지들 - CSS 애니메이션 사용 */}
      <div className="falling-messages-container">
        {fallingMessages.map((msg) => (
          <div
            key={msg.id}
            className="falling-mock-message"
            style={{
              left: msg.x + '%',
              fontSize: msg.size + 'px',
              animationDuration: msg.duration + 's',
              animationDelay: msg.delay + 's',
              '--rotation': msg.rotation + 'deg',
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <motion.div 
        className="game-over-content"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      >
        
        {/* === [헤더 타이틀: 승리자/패배자 분기] === */}
        {!isLoser ? (
          // 승리자 화면: "승리!" 메시지를 표시합니다.
          <motion.div 
            className="winner-celebration"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1.0 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <span className="winner-icon">🎉</span>
            <span className="winner-text">승리!</span> {/* 텍스트를 "승리!"로 수정 */}
            <span className="winner-icon">🥳</span>
          </motion.div>
        ) : (
          // 패배자 화면
          <motion.div 
            className="breaking-news"
            animate={{ 
              scale: [1, 1.02, 1],
              boxShadow: [
                '0 0 20px rgba(196, 30, 58, 0.5)',
                '0 0 40px rgba(196, 30, 58, 0.8)',
                '0 0 20px rgba(196, 30, 58, 0.5)'
              ]
            }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <span className="news-icon">📺</span>
            <span className="news-text">긴급속보</span>
            <span className="news-icon">🚨</span>
          </motion.div>
        )}

        {/* 도둑 발견 타이틀 (모두에게 보임) */}
        <motion.h1 
          className="thief-title"
          animate={{ 
            scale: [1, 1.05, 1],
            textShadow: [
              '0 0 20px rgba(196, 30, 58, 0.5)',
              '0 0 40px rgba(196, 30, 58, 1)',
              '0 0 20px rgba(196, 30, 58, 0.5)'
            ]
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          🦹 도둑 검거! 🦹
        </motion.h1>

        {/* 패배자 대형 캠 화면 (모두에게 보임) */}
        <motion.div
          className="loser-spotlight"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 150 }}
        >
          {/* 회전하는 경고 테두리 */}
          <motion.div 
            className="warning-border"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* 비디오 컨테이너 */}
          <div className="loser-video-wrapper">
            <video
              ref={loserVideoRef}
              autoPlay
              playsInline
              muted={isLoser}
              className="loser-video"
            />
            {!remoteStreams[loser?.id] && loser?.id !== player?.id && (
              <div className="loser-video-placeholder">
                <span>{loser?.nickname?.charAt(0) || '?'}</span>
              </div>
            )}
            
            {/* 수배 프레임 */}
            <div className="wanted-frame">
              <div className="wanted-top">WANTED</div>
              <div className="wanted-bottom">도둑 현상수배</div>
            </div>
            
            {/* 조커 이모지 애니메이션 */}
            <motion.div 
              className="joker-spin"
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              🃏
            </motion.div>
          </div>

          {/* 수치 레이저 빔 효과 */}
          <div className="shame-lasers">
            <div className="laser laser-1" />
            <div className="laser laser-2" />
            <div className="laser laser-3" />
            <div className="laser laser-4" />
          </div>
        </motion.div>

        {/* 패배자 이름 (모두에게 보임) */}
        <motion.div 
          className="loser-name-container"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <span className="loser-name">
            {loser?.nickname} {isLoser && '(당신!)'}
          </span>
        </motion.div>

        {/* 카운트다운 또는 버튼 (모두에게 보임) */}
        {!showButtons ? (
          <motion.div 
            className="shame-countdown"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <span className="countdown-label">
              {isLoser ? '🔥 조롱 타임 🔥' : '🥳 다음 라운드 준비 🥳'} {/* 승리자도 카운트다운이 돌아가지만 조롱 타임 라벨 대신 다른 라벨 표시 */}
            </span>
            <span className="countdown-number">{countdown > 0 ? countdown : '😈'}</span>
          </motion.div>
        ) : (
          <motion.div 
            className="action-buttons"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <button className="play-again-btn" onClick={handlePlayAgain}>
              🔄 한번 더 하기
            </button>
            <button className="exit-btn" onClick={handleLeave}>
              🚪 나가기
            </button>
          </motion.div>
        )}

        {/* 승자 목록 (작게) (모두에게 보임) */}
        {winners.length > 0 && (
          <motion.div
            className="winners-mini"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <span className="winners-label">👑 승자들:</span>
            {winners.map((w, idx) => (
              <span 
                key={w.id} 
                className={'winner-name ' + (w.id === player?.id ? 'is-me' : '')}
              >
                {idx + 1}위 {w.nickname}
              </span>
            ))}
          </motion.div>
        )}

        {/* 본인이 패배자일 때 추가 메시지 */}
        {isLoser && (
          <motion.div 
            className="self-shame-message"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            💀 당신의 얼굴이 전국에 생중계되고 있습니다 💀
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default GameOver;