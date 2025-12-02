import React, { useRef, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useWebRTC } from '../../contexts/WebRTCContext';
import './VideoGrid.css';

const VideoGrid = () => {
  const { room, player } = useGame();
  const { 
    localStream, 
    remoteStreams, 
    isMuted, 
    isVideoOff, 
    error,
    toggleMute, 
    toggleVideo 
  } = useWebRTC();
  
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const getPlayerById = (id) => {
    return room?.players.find(p => p.id === id);
  };

  return (
    <div className="video-grid-container">
      <div className="video-header">
        <span className="video-title">참가자</span>
        <div className="video-controls">
          <button 
            className={`control-btn ${isMuted ? 'active' : ''}`}
            onClick={toggleMute}
            title={isMuted ? '마이크 켜기' : '마이크 끄기'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          <button 
            className={`control-btn ${isVideoOff ? 'active' : ''}`}
            onClick={toggleVideo}
            title={isVideoOff ? '카메라 켜기' : '카메라 끄기'}
          >
            {isVideoOff ? '📷' : '🎥'}
          </button>
        </div>
      </div>

      {error && (
        <div className="video-error">
          <p>{error}</p>
        </div>
      )}

      <div className="video-tiles">
        {/* 내 비디오 */}
        <div className="video-tile my-video">
          <video 
            ref={localVideoRef}
            autoPlay 
            muted 
            playsInline
            className={isVideoOff ? 'video-off' : ''}
          />
          <div className="video-label">
            <span>{player?.nickname} (나)</span>
            {isMuted && <span className="muted-icon">🔇</span>}
          </div>
          {isVideoOff && (
            <div className="video-placeholder">
              <span>{player?.nickname?.charAt(0)}</span>
            </div>
          )}
        </div>

        {/* 다른 플레이어들의 비디오 */}
        {Object.entries(remoteStreams).map(([peerId, stream]) => {
          const peerPlayer = getPlayerById(peerId);
          return (
            <div key={peerId} className="video-tile">
              <video
                id={`remote-video-${peerId}`}
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && el.srcObject !== stream) el.srcObject = stream;
                }}
              />
              <div className="video-label">
                <span>{peerPlayer?.nickname || '알 수 없음'}</span>
              </div>
            </div>
          );
        })}

        {/* 스트림이 없는 플레이어들 (플레이스홀더) */}
        {room?.players
          .filter(p => p.id !== player?.id && !remoteStreams[p.id])
          .map(p => (
            <div key={p.id} className="video-tile no-stream">
              <div className="video-placeholder">
                <span>{p.nickname?.charAt(0)}</span>
              </div>
              <div className="video-label">
                <span>{p.nickname}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default VideoGrid;