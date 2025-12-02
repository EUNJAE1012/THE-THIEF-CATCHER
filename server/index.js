const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const GameManagerFactory = require('./game/GameManagerFactory');
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

const gameManagerFactory = new GameManagerFactory(io);

// REST API endpoints
app.get('/api/room/:roomCode', (req, res) => {
  const result = gameManagerFactory.getRoom(req.params.roomCode);
  if (!result) {
    return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
  }
  const { room, gameType } = result;

  // 게임 타입별로 인원 제한 확인
  const maxPlayers = gameType === 'indian-poker' ? 2 : 6;
  if (room.players.length >= maxPlayers) {
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
      chips: gameType === 'indian-poker' ? 30 : 0,
      isEliminated: false,
      isSpectator: false
    };

    gameManagerFactory.createRoom(roomCode, player, gameType);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerId = player.id;

    const result = gameManagerFactory.getRoom(roomCode);
    callback({
      success: true,
      roomCode,
      player,
      room: result.room
    });
  });

  // 방 참여
  socket.on('join-room', ({ roomCode, nickname }, callback) => {
    const result = gameManagerFactory.getRoom(roomCode);

    if (!result) {
      return callback({ success: false, error: '방을 찾을 수 없습니다.' });
    }

    const { room, gameType } = result;
    const maxPlayers = gameType === 'indian-poker' ? 2 : 6;

    if (room.status !== 'waiting') {
      return callback({ success: false, error: '게임이 이미 시작되었습니다.' });
    }

    const player = {
      id: socket.id,
      nickname: nickname || generateRandomNickname(),
      isHost: false,
      isReady: false,
      cards: [],
      chips: gameType === 'indian-poker' ? 30 : 0,
      isEliminated: false,
      isSpectator: room.players.length >= maxPlayers
    };

    gameManagerFactory.addPlayerToRoom(roomCode, player);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerId = player.id;

    const updatedResult = gameManagerFactory.getRoom(roomCode);
    callback({
      success: true,
      player,
      room: updatedResult.room
    });

    // 다른 플레이어들에게 알림
    socket.to(roomCode).emit('player-joined', {
      player,
      room: updatedResult.room
    });
  });

  // 게임 타입 변경
  socket.on('change-game-type', ({ newGameType }, callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return callback({ success: false, error: '방에 참여하지 않았습니다.' });

    const result = gameManagerFactory.changeGameType(roomCode, newGameType);
    if (result.success) {
      io.to(roomCode).emit('game-type-changed', {
        gameType: newGameType,
        room: result.room
      });
      callback({ success: true, room: result.room });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // 방 나가기 (명시적)
  socket.on('leave-room', () => {
    const { roomCode, playerId } = socket;
    if (roomCode && playerId) {
      const result = gameManagerFactory.removePlayer(roomCode, playerId);
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

    const result = gameManagerFactory.changeNickname(roomCode, playerId, newNickname);
    if (result.success) {
      io.to(roomCode).emit('nickname-changed', {
        playerId,
        newNickname,
        room: result.room
      });
      callback({ success: true });
    } else {
      callback({ success: false, error: '닉네임 변경에 실패했습니다.' });
    }
  });

  // 준비 상태 토글
  socket.on('toggle-ready', (callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return callback({ success: false, error: '방에 참여하지 않았습니다.' });

    const result = gameManagerFactory.toggleReady(roomCode, playerId);
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

    const roomResult = gameManagerFactory.getRoom(roomCode);
    if (!roomResult) return callback({ success: false, error: '방을 찾을 수 없습니다.' });

    const { room, gameType, manager } = roomResult;
    const player = room.players.find(p => p.id === playerId);
    if (!player?.isHost) {
      return callback({ success: false, error: '방장만 게임을 시작할 수 있습니다.' });
    }

    // 게임 타입별 인원 체크
    if (gameType === 'indian-poker') {
      if (room.players.length !== 2) {
        return callback({ success: false, error: '인디언 포커는 정확히 2명이 필요합니다.' });
      }
    } else {
      if (room.players.length < 2) {
        return callback({ success: false, error: '최소 2명이 필요합니다.' });
      }
    }

    const allReady = room.players.every(p => p.isHost || p.isReady);
    if (!allReady) {
      return callback({ success: false, error: '모든 플레이어가 준비해야 합니다.' });
    }

    const gameState = gameManagerFactory.startGame(roomCode);
    if (gameState) {
      // 각 플레이어에게 자신의 뷰 전송
      room.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.id);
        if (playerSocket) {
          playerSocket.emit('game-started', {
            gameState: manager.getPlayerView(roomCode, p.id)
          });
        }
      });

      // 관전자에게도 게임 시작 알림
      if (room.spectators) {
        room.spectators.forEach(s => {
          const spectatorSocket = io.sockets.sockets.get(s.id);
          if (spectatorSocket) {
            spectatorSocket.emit('game-started', {
              gameState: manager.createGameState(room)
            });
          }
        });
      }

      callback({ success: true });
    }
  });

  // === 도둑잡기 이벤트 ===

  // 카드 뽑기
  socket.on('draw-card', ({ targetPlayerId, cardIndex }, callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return;

    const roomResult = gameManagerFactory.getRoom(roomCode);
    if (!roomResult || roomResult.gameType !== 'doduk') return;

    const { room, manager } = roomResult;
    const result = manager.drawCard(roomCode, playerId, targetPlayerId, cardIndex);

    if (result.success) {
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
            gameState: manager.getPlayerView(roomCode, p.id)
          });
        }
      });

      // 게임 종료 체크
      if (result.gameOver) {
        io.to(roomCode).emit('game-over', {
          loser: result.loser,
          winners: result.winners
        });
      }

      callback({ success: true, result });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // 카드 섞기
  socket.on('shuffle-cards', ({ targetPlayerId }, callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return callback({ success: false, error: '방에 참여하지 않았습니다.' });

    const roomResult = gameManagerFactory.getRoom(roomCode);
    if (!roomResult || roomResult.gameType !== 'doduk') return;

    const { room, manager } = roomResult;
    const result = manager.shuffleTargetCards(roomCode, playerId, targetPlayerId);

    if (result.success) {
      room.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.id);
        if (playerSocket) {
          playerSocket.emit('cards-shuffled', {
            shufflerId: playerId,
            targetId: targetPlayerId,
            gameState: manager.getPlayerView(roomCode, p.id)
          });
        }
      });

      callback({ success: true });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // === 인디언 포커 이벤트 ===

  // 배팅
  socket.on('indian-poker-bet', ({ amount }, callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return;

    const roomResult = gameManagerFactory.getRoom(roomCode);
    if (!roomResult || roomResult.gameType !== 'indian-poker') return;

    const { room, manager } = roomResult;
    const result = manager.placeBet(roomCode, playerId, amount);

    if (result.success) {
      io.to(roomCode).emit('indian-poker-action', {
        action: 'bet',
        playerId,
        amount,
        gameState: manager.createGameState(room)
      });

      // 각 플레이어에게 개별 뷰 전송
      room.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.id);
        if (playerSocket) {
          playerSocket.emit('indian-poker-state-update', {
            gameState: manager.getPlayerView(roomCode, p.id)
          });
        }
      });

      callback({ success: true, gameState: result.gameState });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // 콜
  socket.on('indian-poker-call', (callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return;

    const roomResult = gameManagerFactory.getRoom(roomCode);
    if (!roomResult || roomResult.gameType !== 'indian-poker') return;

    const { room, manager } = roomResult;
    const result = manager.call(roomCode, playerId);

    if (result.success) {
      // 콜 액션 브로드캐스트
      io.to(roomCode).emit('indian-poker-action', {
        action: 'call',
        playerId
      });

      // 카드 공개
      setTimeout(() => {
        io.to(roomCode).emit('indian-poker-reveal', {
          winner: result.winner,
          isDraw: result.isDraw,
          cards: room.players.map(p => ({
            playerId: p.id,
            card: p.currentCard
          }))
        });

        if (result.gameOver) {
          io.to(roomCode).emit('game-over', {
            winner: result.finalWinner
          });
        } else {
          // 새 라운드 시작
          setTimeout(() => {
            room.players.forEach(p => {
              const playerSocket = io.sockets.sockets.get(p.id);
              if (playerSocket) {
                playerSocket.emit('indian-poker-state-update', {
                  gameState: manager.getPlayerView(roomCode, p.id)
                });
              }
            });
          }, 2000);
        }
      }, 1000);

      callback({ success: true });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // 다이
    socket.on('indian-poker-die', (callback) => {
        const { roomCode, playerId } = socket;
        if (!roomCode) return;

        const roomResult = gameManagerFactory.getRoom(roomCode);
        if (!roomResult || roomResult.gameType !== 'indian-poker') return;

        const { room, manager } = roomResult;
        
        // NOTE: manager.die는 칩 정산 후 room.status를 'reveal'로 변경해야 함.
        const result = manager.die(roomCode, playerId);

        if (result.success) {
          // 1. 다이 액션 브로드캐스트 (액션 메시지 표시)
          io.to(roomCode).emit('indian-poker-action', {
            action: 'die',
            playerId,
            penalty: result.penalty,
            cards: result.cards,
            winner: result.winner,
            gameOver: result.gameOver,
            finalWinner: result.finalWinner
          });

          // 이 이벤트가 클라이언트의 handleReveal 함수를 실행시킵니다.
          io.to(roomCode).emit('indian-poker-reveal', {
            winner: result.winner,
            isDraw: false,
            cards: result.cards, // manager.die에서 모든 플레이어의 카드 정보가 반환되었다고 가정
            gameOver: result.gameOver, // 게임 종료 여부
            finalWinner: result.finalWinner
          });

          callback({ success: true });
        } else {
          callback({ success: false, error: result.error });
        }
    });


  
  // === 공통 이벤트 ===

  // 한번 더 하기 요청
  socket.on('request-play-again', (callback) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return callback({ success: false, error: '방에 참여하지 않았습니다.' });

    const roomResult = gameManagerFactory.getRoom(roomCode);
    if (!roomResult) return callback({ success: false, error: '방을 찾을 수 없습니다.' });

    const { room, manager } = roomResult;
    const updatedRoom = manager.resetGame(roomCode);

    if (updatedRoom) {
      callback({ success: true, room: updatedRoom });

      io.to(roomCode).emit('return-to-lobby', {
        room: updatedRoom
      });
    } else {
      callback({ success: false, error: '게임 리셋에 실패했습니다.' });
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

  socket.on("indian-poker-next-round", (callback) => {
    const { roomCode } = socket;
    
    // 1. 방어 및 GameManager 인스턴스 획득 (ReferenceError 방지)
    if (!roomCode) {
        return callback && callback({ success: false, error: "방 코드가 없습니다." });
    }

    const roomResult = gameManagerFactory.getRoom(roomCode);
    
    if (!roomResult || roomResult.gameType !== 'indian-poker') {
        return callback && callback({ success: false, error: "유효하지 않은 방 또는 게임 타입입니다." });
    }

    // ⭐️ 핵심 수정: room과 manager를 구조분해 할당하여 사용합니다.
    const { room, manager } = roomResult;

    // 2. 새 라운드 시작
    // GameManager가 roomCode를 인자로 받는다고 가정합니다.
    const success = manager.startNewRound(room); 

    if (success) {
        // 3. 각 플레이어에게 맞춤형 뷰 전송 (상태 불일치/카드 누락 해결)
        room.players.forEach(p => {
            const playerSocket = io.sockets.sockets.get(p.id);
            if (playerSocket) {
                playerSocket.emit('indian-poker-state-update', {
                    // ⭐️ getPlayerView를 사용하여 상대방 카드만 보이게 합니다.
                    gameState: manager.getPlayerView(roomCode, p.id) 
                });
            }
        });
        
            // 클라이언트 콜백이 있다면 성공 알림
            callback && callback({ success: true });
        } else {
            callback && callback({ success: false, error: "새 라운드 시작에 실패했습니다." });
        }
    });

  // 채팅
  socket.on('chat-message', ({ message }) => {
    const { roomCode, playerId } = socket;
    if (!roomCode) return;

    const roomResult = gameManagerFactory.getRoom(roomCode);
    if (!roomResult) return;

    const { room } = roomResult;
    const player = room.players.find(p => p.id === playerId) ||
                   (room.spectators && room.spectators.find(s => s.id === playerId));

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
      const result = gameManagerFactory.removePlayer(roomCode, playerId);
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
