const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const GameManager = require('./game/GameManager');
const path = require('path');
const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',      // Vite dev server
      'https://localhost:3001',     // Local HTTPS
      'http://localhost',           // Local HTTP fallback
      'https://www.jomha.site',     // Production with www
      'https://jomha.site',         // Production without www
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

const gameManager = new GameManager(io);

// REST API endpoints
app.get('/api/room/:roomCode', (req, res) => {
  const room = gameManager.getRoom(req.params.roomCode);
  if (!room) {
    return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
  }
  if (room.players.length >= 6) {
    return res.status(400).json({ error: '방이 가득 찼습니다.' });
  }
  res.json({ 
    exists: true, 
    playerCount: room.players.length,
    gameType: room.gameType,
    status: room.status
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // 방 생성
  socket.on('create-room', ({ nickname, gameType = 'doduk' }, callback) => {
    const roomCode = generateRoomCode();
    const player = {
      id: socket.id,
      nickname: nickname || generateRandomNickname(),
      isHost: true,
      isReady: true,
      cards: [],
      isEliminated: false
    };
    
    gameManager.createRoom(roomCode, player, gameType);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerId = player.id;
    
    callback({ 
      success: true, 
      roomCode, 
      player,
      room: gameManager.getRoom(roomCode)
    });
  });

  // 방 참여
  socket.on('join-room', ({ roomCode, nickname }, callback) => {
    const room = gameManager.getRoom(roomCode);
    
    if (!room) {
      return callback({ success: false, error: '방을 찾을 수 없습니다.' });
    }
    if (room.players.length >= 6) {
      return callback({ success: false, error: '방이 가득 찼습니다.' });
    }
    if (room.status !== 'waiting') {
      return callback({ success: false, error: '게임이 이미 시작되었습니다.' });
    }

    const player = {
      id: socket.id,
      nickname: nickname || generateRandomNickname(),
      isHost: false,
      isReady: false,
      cards: [],
      isEliminated: false
    };

    gameManager.addPlayerToRoom(roomCode, player);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerId = player.id;

    callback({ 
      success: true, 
      player,
      room: gameManager.getRoom(roomCode)
    });

    // 다른 플레이어들에게 알림
    socket.to(roomCode).emit('player-joined', { 
      player, 
      room: gameManager.getRoom(roomCode) 
    });
  });

  // 방 나가기 (명시적)
  socket.on('leave-room', () => {
    const { roomCode, playerId } = socket;
    if (roomCode && playerId) {
      const result = gameManager.removePlayer(roomCode, playerId);
      socket.leave(roomCode);
      socket.roomCode = null;
      socket.playerId = null;
      
      if (result.roomDeleted) {
        console.log(`Room ${roomCode} deleted`);
      } else if (result.room) {
        io.to(roomCode).emit('player-left', { 
          playerId, 
          room: result.room,
          newHost: result.newHost
        });
      }
    }
  });

  // 닉네임 변경
  socket.on('change-nickname', ({ newNickname }, callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return callback({ success: false, error: '방에 참여하지 않았습니다.' });

    const room = gameManager.getRoom(roomCode);
    if (!room) return callback({ success: false, error: '방을 찾을 수 없습니다.' });

    // 게임 중에는 닉네임 변경 불가
    if (room.status === 'playing') {
      return callback({ success: false, error: '게임 중에는 닉네임을 변경할 수 없습니다.' });
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) return callback({ success: false, error: '플레이어를 찾을 수 없습니다.' });

    // 닉네임 유효성 검사
    if (!newNickname || newNickname.trim().length === 0) {
      return callback({ success: false, error: '닉네임을 입력해주세요.' });
    }
    if (newNickname.trim().length > 12) {
      return callback({ success: false, error: '닉네임은 12자 이하로 입력해주세요.' });
    }

    player.nickname = newNickname.trim();
    
    callback({ success: true, player });

    // 모든 플레이어에게 알림
    io.to(roomCode).emit('nickname-changed', {
      playerId,
      newNickname: player.nickname,
      room: gameManager.getRoom(roomCode)
    });
  });

  // 준비 상태 토글
  socket.on('toggle-ready', (callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return callback({ success: false, error: '방에 참여하지 않았습니다.' });

    const result = gameManager.toggleReady(roomCode, playerId);
    if (result.room) {
      const updatedPlayer = result.room.players.find(p => p.id === playerId);
      io.to(roomCode).emit('room-updated', { room: result.room });
      callback({ success: true, player: updatedPlayer });
    } else {
      callback({ success: false, error: '준비 상태 변경에 실패했습니다.' });
    }
  });

  // 게임 시작
  socket.on('start-game', (callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return;

    const room = gameManager.getRoom(roomCode);
    if (!room) return callback({ success: false, error: '방을 찾을 수 없습니다.' });

    const player = room.players.find(p => p.id === playerId);
    if (!player?.isHost) {
      return callback({ success: false, error: '방장만 게임을 시작할 수 있습니다.' });
    }

    if (room.players.length < 2) {
      return callback({ success: false, error: '최소 2명이 필요합니다.' });
    }

    const allReady = room.players.every(p => p.isHost || p.isReady);
    if (!allReady) {
      return callback({ success: false, error: '모든 플레이어가 준비해야 합니다.' });
    }

    const gameState = gameManager.startGame(roomCode);
    if (gameState) {
      // 각 플레이어에게 자신의 카드만 보이도록 전송
      room.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.id);
        if (playerSocket) {
          playerSocket.emit('game-started', {
            gameState: gameManager.getPlayerView(roomCode, p.id)
          });
        }
      });
      callback({ success: true });
    }
  });

  // 카드 뽑기
  socket.on('draw-card', ({ targetPlayerId, cardIndex }, callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return;

    const result = gameManager.drawCard(roomCode, playerId, targetPlayerId, cardIndex);
    if (result.success) {
      const room = gameManager.getRoom(roomCode);
      
      // 모든 플레이어에게 업데이트 전송
      room.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.id);
        if (playerSocket) {
          playerSocket.emit('card-drawn', {
            drawerId: playerId,
            targetId: targetPlayerId,
            cardIndex,
            drawnCard: p.id === playerId ? result.drawnCard : null,
            matchedCards: result.matchedCards,
            gameState: gameManager.getPlayerView(roomCode, p.id)
          });
        }
      });

      // 게임 종료 체크
      if (result.gameOver) {
        io.to(roomCode).emit('game-over', {
          loser: result.loser,
          winners: result.winners
        });
        
        // 자동으로 로비 복귀하지 않음 - 클라이언트에서 버튼으로 제어
      }

      callback({ success: true, result });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // 한번 더 하기 요청
  socket.on('request-play-again', (callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return callback({ success: false, error: '방에 참여하지 않았습니다.' });

    const room = gameManager.getRoom(roomCode);
    if (!room) return callback({ success: false, error: '방을 찾을 수 없습니다.' });

    // 게임 리셋
    const updatedRoom = gameManager.resetGame(roomCode);
    
    if (updatedRoom) {
      // 모든 플레이어 상태 확실히 초기화
      updatedRoom.players.forEach(p => {
        p.cards = [];
        p.isEliminated = false;
        p.isReady = p.isHost; // 방장만 준비완료
      });
      updatedRoom.status = 'waiting';
      updatedRoom.currentTurnId = null;
      updatedRoom.nextTargetId = null;
      
      // 요청한 플레이어에게 응답
      callback({ success: true, room: updatedRoom });
      
      // 모든 플레이어에게 로비 복귀 알림
      io.to(roomCode).emit('return-to-lobby', {
        room: updatedRoom
      });
    } else {
      callback({ success: false, error: '게임 리셋에 실패했습니다.' });
    }
  });

  // 카드 섞기
  socket.on('shuffle-cards', ({ targetPlayerId }, callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return callback({ success: false, error: '방에 참여하지 않았습니다.' });

    const result = gameManager.shuffleTargetCards(roomCode, playerId, targetPlayerId);
    if (result.success) {
      const room = gameManager.getRoom(roomCode);
      
      // 모든 플레이어에게 셔플 이벤트 전송
      room.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.id);
        if (playerSocket) {
          playerSocket.emit('cards-shuffled', {
            shufflerId: playerId,
            targetId: targetPlayerId,
            gameState: gameManager.getPlayerView(roomCode, p.id)
          });
        }
      });
      
      callback({ success: true });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // WebRTC 시그널링
  socket.on('webrtc-offer', ({ targetId, offer }) => {
    io.to(targetId).emit('webrtc-offer', { 
      senderId: socket.id, 
      offer 
    });
  });

  socket.on('webrtc-answer', ({ targetId, answer }) => {
    io.to(targetId).emit('webrtc-answer', { 
      senderId: socket.id, 
      answer 
    });
  });

  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc-ice-candidate', { 
      senderId: socket.id, 
      candidate 
    });
  });

  // 카드 호버 상태 브로드캐스트
  socket.on('card-hover', ({ cardIndex, targetPlayerId }) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return;
    
    socket.to(roomCode).emit('card-hover', {
      hoverPlayerId: playerId,
      targetPlayerId,
      cardIndex
    });
  });

  socket.on('card-hover-end', () => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return;
    
    socket.to(roomCode).emit('card-hover-end', {
      hoverPlayerId: playerId
    });
  });

  // 채팅
  socket.on('chat-message', ({ message }) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return;

    const room = gameManager.getRoom(roomCode);
    const player = room?.players.find(p => p.id === playerId);
    if (player) {
      io.to(roomCode).emit('chat-message', {
        senderId: playerId,
        senderNickname: player.nickname,
        message,
        timestamp: Date.now()
      });
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    const { roomCode, playerId } = socket;
    if (roomCode && playerId) {
      const result = gameManager.removePlayer(roomCode, playerId);
      if (result.roomDeleted) {
        console.log(`Room ${roomCode} deleted`);
      } else if (result.room) {
        io.to(roomCode).emit('player-left', { 
          playerId, 
          room: result.room,
          newHost: result.newHost
        });
      }
    }
    console.log(`Client disconnected: ${socket.id}`);
  });
});

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateRandomNickname() {
  const adjectives = ['행복한', '슬픈', '용감한', '빠른', '느린', '현명한', '멋진', '귀여운'];
  const nouns = ['호랑이', '토끼', '독수리', '고양이', '강아지', '곰', '여우', '늑대'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  
  // 로컬 IP 주소 출력
  const os = require('os');
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`LAN access: http://${iface.address}:${PORT}`);
      }
    });
  });
});
