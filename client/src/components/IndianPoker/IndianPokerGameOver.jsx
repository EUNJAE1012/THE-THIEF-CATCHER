import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../contexts/GameContext';
import { useWebRTC } from '../../contexts/WebRTCContext';
import './IndianPokerGameOver.css'; // 위에 작성한 CSS 파일

// 인디언 포커 전용 조롱 문구 (텍스트만 변경)
const MOCK_MESSAGES = [
  "🤡 포커페이스 실패! 얼굴에 다 써있음 🤡",
  "😈 도박은 패가망신의 지름길입니다 📉",
  "👀 배팅 실화냐? 전재산 탕진ㅋㅋㅋ 🤪",
  "🚨 속보: 이 사람 칩 다 잃음 ㅋㅋ 🚨",
  "🦧 원숭이도 칩 관리는 이렇게 안 함 🐒",
  "🤦 아니 패를 안 보고 배팅을 해요? 🤦‍♂️",
  "📉 주식도 말아먹고 포커도 말아먹고 🤡🤡🤡",
  "🎰 강원랜드 출입금지 명단 예약 🎲",
  "🎯 칩을 상대방에게 기부하는 천사시네요 🏹",
  "ㅋㅋㅋㅋㅋㅋ 파산 축하 ^^7",
  "😈 당신의 게임 실력에 온 우주가 감탄합니다. 👽",
  "🤖 너 완전 핵심을 짚었어. 너 게임 100% 못해.🤸‍♂️",
  "🤷‍♀️ 전방에 힘찬 조롱 10초간 발사!!!! 💩",
  "👀 포브스 선정 올해 최악의 게이머 그것은 바로..👎",
  "속보) 대한민국 핵 보유국… 🇰🇷 얘 게임 개못핵 ㅋㅋ 💣💣💣",
  "🎪 너 재능있어. 더 열심히 해. 🤹",
  "😱 충격 실화 공포 패배 표정 박제 🎬",
  "🎭 아 그거 그렇게 하는거 아닌데, 아 그거 그렇게 하는거 아닌데 아 그거..🦶",
];


const SHAME_EMOJIS = ["💸", "📉", "🤮", "😱", "🤬", "💀", "🪦", "⚰️", "🤡", "👎", "🧱", "💩", "🧊"];

const IndianPokerGameOver = ({ winner, isMe, onClose }) => {
  const navigate = useNavigate();
  // useGame에서 player와 room 정보를 가져옵니다.
  const { player, room } = useGame();
  const { remoteStreams, localStream } = useWebRTC();
  
  const loserVideoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [mockPhase, setMockPhase] = useState(0);
  const [confetti, setConfetti] = useState([]);
  const [fallingMessages, setFallingMessages] = useState([]);
  const [captureNotice, setCaptureNotice] = useState(null);
  const [hasCaptured, setHasCaptured] = useState(false);

  // 패배자 찾기 로직: winner가 아니면 loser로 간주
  // room.players에서 winner가 아닌 사람을 찾음
  const loser = room?.players?.find(p => p.id !== winner?.id);
  const isLoser = loser?.id === player?.id;

  // 비디오 스트림 연결
  useEffect(() => {
    if (!loserVideoRef.current) return;
    if (!loser) return;

    // 내가 패배자면 로컬 스트림, 남이 패배자면 리모트 스트림
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
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // 비디오 프레임 그리기
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 붉은 필터 (파산 느낌)
    ctx.fillStyle = 'rgba(100, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 상단 텍스트 (BANKRUPT)
    ctx.fillStyle = '#c41e3a';
    ctx.fillRect(0, 0, canvas.width, 60);
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('💸 BANKRUPT 💸', canvas.width / 2, 45);
    
    // 하단 정보
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#d4af37';
    ctx.fillText('🚫 파산자: ' + (loser?.nickname || 'Unknown') + ' 🚫', canvas.width / 2, canvas.height - 45);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Total Loss: ALL-IN (' + new Date().toLocaleDateString() + ')', canvas.width / 2, canvas.height - 15);
    
    // 도장 쾅
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-30 * Math.PI / 180);
    ctx.font = '100px Arial';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.fillText('파 산', 0, 0);
    ctx.restore();

    // 다운로드
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '파산_' + (loser?.nickname || 'unknown') + '_' + Date.now() + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setCaptureNotice('📸 파산 인증샷이 저장되었습니다 ^^');
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
  }, [captureLoserFace, hasCaptured, isLoser]);

  // 조롱 페이즈 타이머 (10초 카운트다운)
  useEffect(() => {
    if (mockPhase < 11) {
      const timer = setTimeout(() => {
        setMockPhase(prev => prev + 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mockPhase]);

  // 떨어지는 조롱 메시지 생성
  useEffect(() => {
    if (mockPhase >= 11) return;
    
    const initialMessages = [];
    for (let i = 0; i < 15; i++) {
      initialMessages.push({
        id: Date.now() + i,
        text: MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)],
        x: Math.random() * 90 + 5,
        size: Math.random() * 14 + 14,
        duration: Math.random() * 6 + 8,
        delay: Math.random() * 3,
        rotation: Math.random() * 20 - 10,
      });
    }
    setFallingMessages(initialMessages);

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
        const filtered = prev.length > 40 ? prev.slice(-30) : prev;
        return [...filtered, newMessage];
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [mockPhase]);

  // 컨페티 생성 (패배자에게 쏟아짐)
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
  }, [isLoser]);

  const countdown = 10 - mockPhase;
  const showButtons = mockPhase >= 11;

  return (
    <motion.div
      className="game-over-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="game-over-backdrop" />
      
      {/* 캡쳐용 캔버스 (숨김) */}
      {isLoser && <canvas ref={canvasRef} style={{ display: 'none' }} />}
      
      {/* 캡쳐 알림 메시지 */}
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

      {/* 떨어지는 텍스트 메시지 */}
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
        
        {/* === 헤더: 승리자 축하 vs 패배자 속보 === */}
        {isMe ? (
          <motion.div 
            className="winner-celebration"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1.0 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <span className="winner-icon">🎉</span>
            <span className="winner-text">승리! 칩 획득!</span>
            <span className="winner-icon">💰</span>
          </motion.div>
        ) : (
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
            <span className="news-text">긴급속보: 전재산 탕진</span>
            <span className="news-icon">🚨</span>
          </motion.div>
        )}

        {/* 메인 타이틀 (파산 확정) */}
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
          {isMe ? "💰 인생역전! 💰" : "📉 파산 확정! 📉"}
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
              muted={isLoser} // 내가 패배자면 내 소리 뮤트
              className="loser-video"
            />
            {/* 캠이 없을 때 대체 화면 */}
            {((!localStream && isLoser) || (!remoteStreams[loser?.id] && !isLoser)) && (
              <div className="loser-video-placeholder">
                <span>{loser?.nickname?.charAt(0) || '?'}</span>
              </div>
            )}
            
            {/* 수배 프레임 -> 파산 프레임으로 텍스트 변경 */}
            <div className="wanted-frame">
              <div className="wanted-top">BANKRUPT</div>
              <div className="wanted-bottom">신용불량 주의</div>
            </div>
            
            {/* 회전하는 아이콘 (조커 대신 칩/돈) */}
            <motion.div 
              className="joker-spin"
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              💸
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

        {/* 패배자 이름 */}
        <motion.div 
          className="loser-name-container"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <span className="loser-name">
            {loser?.nickname} {isLoser && '(당신입니다)'}
          </span>
        </motion.div>

        {/* 카운트다운 또는 버튼 */}
        {!showButtons ? (
          <motion.div 
            className="shame-countdown"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <span className="countdown-label">
              {isLoser ? '🔥 조롱 타임 🔥' : '🥳 승리의 춤을 추세요 🥳'}
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
            <button className="play-again-btn" onClick={onClose}>
              🔄 로비로 돌아가기
            </button>
          </motion.div>
        )}

        {/* 본인이 패배자일 때 추가 메시지 */}
        {isLoser && (
          <motion.div 
            className="self-shame-message"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            💀 파산 소식이 전국에 퍼지고 있습니다 💀
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default IndianPokerGameOver;