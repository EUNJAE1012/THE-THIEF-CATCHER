import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useGame } from './GameContext';

const WebRTCContext = createContext(null);

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
};

export const WebRTCProvider = ({ children }) => {
  const { socket } = useSocket();
  const { room, player } = useGame();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState(null);
  
  const peerConnections = useRef({});

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // 미디어 스트림 초기화
// 미디어 스트림 초기화 - 컴포넌트 마운트 시 즉시 권한 요청
  useEffect(() => {
    let mounted = true;
    
    const initMedia = async () => {
      try {
        console.log('카메라/마이크 권한 요청 중...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
          audio: true
        });
        if (mounted) {
          console.log('미디어 스트림 획득 성공');
          setLocalStream(stream);
        }
      } catch (err) {
        console.error('미디어 접근 실패:', err);
        if (mounted) {
          setError('카메라/마이크 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.');
        }
      }
    };

    // 즉시 실행
    initMedia();

    return () => {
      mounted = false;
    };
  }, []);

  // 스트림 정리는 별도 useEffect로
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnections.current).forEach(pc => pc.close());
    };
  }, [localStream]);

  // WebRTC 시그널링 설정
  useEffect(() => {
    if (!socket || !localStream || !room) return;

    const createPeerConnection = (peerId) => {
      if (peerConnections.current[peerId]) {
        return peerConnections.current[peerId];
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', {
            targetId: peerId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({
          ...prev,
          [peerId]: event.streams[0]
        }));
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || 
            pc.iceConnectionState === 'closed') {
          setRemoteStreams(prev => {
            const newStreams = { ...prev };
            delete newStreams[peerId];
            return newStreams;
          });

          if (pc.iceConnectionState === 'closed') {
              delete peerConnections.current[peerId];
              console.log(`PeerConnection for ${peerId} implicitly closed.`);
          }
          
        }
      };

      peerConnections.current[peerId] = pc;
      return pc;
    };

    // 기존 플레이어들에게 연결 요청
    const initiateCalls = async () => {
      const otherPlayers = room?.players.filter(p => p.id !== player?.id) || [];
      
      for (const p of otherPlayers) {
        if (peerConnections.current[p.id]) {
            // console.log(`Skipping offer to existing peer: ${p.id}`);
            continue; 
        }
        const pc = createPeerConnection(p.id);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc-offer', { targetId: p.id, offer });
        } catch (err) {
          console.error('Offer 생성 실패:', err);
        }
      }
    };

    initiateCalls();

    const handlePlayerLeft = ({ playerId }) => {
        const pc = peerConnections.current[playerId];
        if (pc) {
            pc.close(); // 연결 닫기
            delete peerConnections.current[playerId]; // ref에서 인스턴스 제거
            
            // remoteStreams state 정리
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[playerId];
                return newStreams;
            });
            console.log(`PeerConnection for ${playerId} closed and removed due to player-left event.`);
        }
    };

    // Offer 수신
    const handleOffer = async ({ senderId, offer }) => {
      const pc = createPeerConnection(senderId);
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { targetId: senderId, answer });
      } catch (err) {
        console.error('Answer 생성 실패:', err);
      }
    };

    // Answer 수신
    const handleAnswer = async ({ senderId, answer }) => {
      const pc = peerConnections.current[senderId];
      if (pc) {
        try {
          await pc.setRemoteDescription(answer);
        } catch (err) {
          console.error('Answer 설정 실패:', err);
        }
      }
    };

    // ICE Candidate 수신
    const handleIceCandidate = async ({ senderId, candidate }) => {
      const pc = peerConnections.current[senderId];
      if (pc) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error('ICE Candidate 추가 실패:', err);
        }
      }
    };

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);

    socket.on('player-left', handlePlayerLeft);


    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('player-left', handlePlayerLeft);
    };
  }, [socket, localStream, room?.players, player?.id])

  // 마이크 토글
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // 비디오 토글
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const value = {
    localStream,
    remoteStreams,
    isMuted,
    isVideoOff,
    error,
    toggleMute,
    toggleVideo,
  };

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  );
};