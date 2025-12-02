// IndianPokerManager.js - 인디언 포커 게임 관리자

class IndianPokerManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  // 방 생성
  createRoom(roomCode, player, gameType) {
    const room = {
      roomCode,
      gameType,
      status: 'waiting', // 'waiting', 'playing', 'betting', 'reveal', 'finished'
      players: [player],
      spectators: [],
      deck: [],
      pot: 0,
      currentBetAmount: 1,
      currentBetterId: null,
      firstBetterId: null, // 라운드 시작 시 첫 배팅자
      roundWinner: null,
      lastAction: null,
      gameState: null
    };
    this.rooms.set(roomCode, room);
    return room;
  }

  // 방 가져오기
  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  // 플레이어 추가
  addPlayerToRoom(roomCode, player) {
    const room = this.rooms.get(roomCode);
    if (room) {
      // 이미 2명이면 관전자로 추가
      if (room.players.length >= 2) {
        player.isSpectator = true;
        room.spectators.push(player);
      } else {
        player.isSpectator = false;
        room.players.push(player);
      }
    }
    return room;
  }

  // 준비 상태 토글
  toggleReady(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { room: null };

    const player = room.players.find(p => p.id === playerId);
    if (player && !player.isHost) {
      player.isReady = !player.isReady;
    }
    return { room };
  }

  // 게임 타입 변경
  changeGameType(roomCode, newGameType) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'waiting') return { success: false };

    room.gameType = newGameType;
    return { success: true, room };
  }

  // 덱 생성 (1-10 카드 2세트)
  createDeck() {
    const deck = [];
    for (let set = 0; set < 2; set++) {
      for (let value = 1; value <= 10; value++) {
        deck.push({
          value,
          suit: set === 0 ? 'hearts' : 'spades', 
          displayValue: value.toString()
        });
      }
    }
    return deck;
  }

  // 배열 섞기
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // 게임 시작
  startGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    // 플레이어가 정확히 2명인지 확인
    if (room.players.length !== 2) {
      return { success: false, error: '인디언 포커는 정확히 2명의 플레이어가 필요합니다.' };
    }

    room.status = 'playing';

    // 각 플레이어에게 30칩 부여
    room.players.forEach(player => {
      player.chips = 30;
      player.currentCard = null;
      player.totalBet = 0; // 현재 라운드에서 배팅한 총액
    });

    // 덱 생성
    room.deck = this.createDeck();
    this.shuffleArray(room.deck);

    // 첫 라운드 시작
    this.startNewRound(room);

    return { success: true, gameState: this.createGameState(room) };
  }


// 새 라운드 시작
  startNewRound(room) {
    // 이미 라운드가 시작되었는지 확인
    // 두 플레이어가 동시에 요청을 보내더라도 한 번만 실행되도록 함
    if (room.status === 'betting' && room.players.every(p => p.currentCard)) {
        return true; // 이미 시작되었으므로 성공으로 간주하고 true 반환
    }

    // 덱이 2장 미만이면 새로 생성
    if (room.deck.length < 2) {
      room.deck = this.createDeck();
      this.shuffleArray(room.deck);
    }

    // 스타트 배팅 (각 1칩)
    room.players.forEach(player => {
      if (player.chips >= 1) {
        player.chips -= 1;
        room.pot += 1;
        player.totalBet = 1;
      } else {
        // 칩이 부족하면 게임 종료 (패배)
        room.status = 'finished';
        return; // 여기서는 return만 하면 forEach 콜백만 종료됨에 주의 (전체 로직 흐름에는 영향 X)
      }
    });
    
    // 게임 종료 조건에 걸렸다면 false 반환
    if (room.status === 'finished') {
        return true; // 상태 업데이트를 위해 true 반환
    }

    // 카드 배분
    room.players.forEach(player => {
      player.currentCard = room.deck.pop();
    });

    // 첫 배팅자 결정 (무작위 또는 이전 라운드 승자)
    if (room.roundWinner) {
      room.currentBetterId = room.roundWinner;
    } else {
      const randomIndex = Math.floor(Math.random() * room.players.length);
      room.currentBetterId = room.players[randomIndex].id;
    }

    room.firstBetterId = room.currentBetterId;
    room.currentBetAmount = 1; // 스타트 배팅 금액
    room.status = 'betting';
    room.lastAction = null;

    // 반드시 true를 반환해야 index.js에서 if(success)를 통과함
    return true; 
  }

  // 배팅
  placeBet(roomCode, playerId, amount) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: '방을 찾을 수 없습니다.' };

    if (room.status !== 'betting') {
      return { success: false, error: '배팅 페이즈가 아닙니다.' };
    }

    if (room.currentBetterId !== playerId) {
      return { success: false, error: '당신의 차례가 아닙니다.' };
    }

    const player = room.players.find(p => p.id === playerId);
    const opponent = room.players.find(p => p.id !== playerId);

    if (!player) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }

    // 상대방이 이미 배팅한 금액
    const opponentBet = opponent.totalBet;
    const playerBet = player.totalBet;

    // 배팅 금액은 상대방보다 많아야 함
    const additionalBet = amount;
    const newTotalBet = playerBet + additionalBet;

    if (newTotalBet <= opponentBet) {
      return { success: false, error: '상대방보다 많은 금액을 배팅해야 합니다.' };
    }

    // 올인 처리
    const actualBet = Math.min(additionalBet, player.chips);
    player.chips -= actualBet;
    room.pot += actualBet;
    player.totalBet += actualBet;
    room.currentBetAmount = player.totalBet;

    room.lastAction = 'bet';

    // 다음 플레이어로 턴 이동
    room.currentBetterId = opponent.id;

    return {
      success: true,
      action: 'bet',
      gameState: this.createGameState(room)
    };
  }

  // 콜
  call(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: '방을 찾을 수 없습니다.' };

    if (room.status !== 'betting') {
      return { success: false, error: '배팅 페이즈가 아닙니다.' };
    }

    if (room.currentBetterId !== playerId) {
      return { success: false, error: '당신의 차례가 아닙니다.' };
    }

    const player = room.players.find(p => p.id === playerId);
    const opponent = room.players.find(p => p.id !== playerId);

    // 상대방과 같은 금액으로 맞춤
    const diff = opponent.totalBet - player.totalBet;
    const actualBet = Math.min(diff, player.chips);

    player.chips -= actualBet;
    room.pot += actualBet;
    player.totalBet += actualBet;

    room.lastAction = 'call';
    room.status = 'reveal';

    // 승자 결정
    const result = this.revealCards(room);

    return {
      success: true,
      action: 'call',
      ...result
    };
  }

  // 다이 (포기)
  die(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: '방을 찾을 수 없습니다.' };

    if (room.status !== 'betting') {
      return { success: false, error: '배팅 페이즈가 아닙니다.' };
    }

    if (room.currentBetterId !== playerId) {
      return { success: false, error: '당신의 차례가 아닙니다.' };
    }

    const player = room.players.find(p => p.id === playerId);
    const opponent = room.players.find(p => p.id !== playerId);

    room.lastAction = 'die';

    // 카드가 10이면 상대에게 칩 10개 추가 지급
    let penalty = 0;
    if (player.currentCard?.value === 10) {
      penalty = 10;
      const penaltyAmount = Math.min(penalty, player.chips);
      player.chips -= penaltyAmount;
      opponent.chips += penaltyAmount;
    }

    // 상대방이 pot 획득
    opponent.chips += room.pot;
    room.roundWinner = opponent.id;

    // 게임 종료 체크
    const gameOver = this.checkGameEnd(room);

    if (gameOver) {
      room.status = 'finished';
      return {
        success: true,
        action: 'die',
        penalty,
        gameOver: true,
        winner: gameOver.winner,
        gameState: this.createGameState(room)
      };
    }
    room.status = 'reveal';

    // 다음 라운드 준비
    // room.pot = 0;
    // room.players.forEach(p => p.totalBet = 0);

    // this.startNewRound(room);
    const cards = room.players.map(p => ({ playerId: p.id, card: p.currentCard }));
    const roundWinner = opponent; // 라운드 승자 (Die를 선언했으므로 상대방)
    
    return {
          success: true,
          action: 'die',
          penalty,
          gameOver: false,
          winner: roundWinner, 
          cards: cards,
          gameState: this.createGameState(room)
    };
  }

  // 카드 공개 및 승자 결정
  revealCards(room) {
    const player1 = room.players[0];
    const player2 = room.players[1];

    const card1Value = player1.currentCard.value;
    const card2Value = player2.currentCard.value;

    let winner = null;
    let isDraw = false;

    if (card1Value > card2Value) {
      winner = player1;
      player1.chips += room.pot;
      room.roundWinner = player1.id;
    } else if (card2Value > card1Value) {
      winner = player2;
      player2.chips += room.pot;
      room.roundWinner = player2.id;
    } else {
      // 무승부: pot을 다음 라운드로 이월
      isDraw = true;
      room.roundWinner = null; // 무작위 배팅 우선권
    }

    // 게임 종료 체크
    const gameOver = this.checkGameEnd(room);

    if (gameOver) {
      room.status = 'finished';
      return {
        winner: winner ? { id: winner.id, nickname: winner.nickname } : null,
        isDraw,
        gameOver: true,
        finalWinner: gameOver.winner,
        gameState: this.createGameState(room)
      };
    }

    // 무승부가 아니면 pot 초기화, 무승부면 이월
    if (!isDraw) {
      room.pot = 0;
    }

    room.players.forEach(p => p.totalBet = 0);

    // 다음 라운드 시작
    // this.startNewRound(room);

    return {
      winner: winner ? { id: winner.id, nickname: winner.nickname } : null,
      isDraw,
      gameOver: false,
      gameState: this.createGameState(room)
    };
  }

  // 게임 종료 확인
  checkGameEnd(room) {
    // 한 플레이어가 60칩 도달
    const winner = room.players.find(p => p.chips >= 60);
    if (winner) {
      return { winner: { id: winner.id, nickname: winner.nickname } };
    }

    // 한 플레이어가 1칩 미만 (스타트 배팅 불가)
    const loser = room.players.find(p => p.chips < 1);
    if (loser) {
      const winner = room.players.find(p => p.id !== loser.id);
      return { winner: { id: winner.id, nickname: winner.nickname } };
    }

    return null;
  }

  // 게임 상태 생성
  createGameState(room) {
    return {
      players: room.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        chips: p.chips,
        totalBet: p.totalBet,
        hasCard: !!p.currentCard
      })),
      spectators: room.spectators.map(s => ({
        id: s.id,
        nickname: s.nickname,
        isSpectator: true
      })),
      pot: room.pot,
      currentBetAmount: room.currentBetAmount,
      currentBetterId: room.currentBetterId,
      status: room.status,
      lastAction: room.lastAction
    };
  }

  // 플레이어 뷰 생성 (본인 카드는 안 보임, 상대 카드는 보임)
  getPlayerView(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    const opponent = room.players.find(p => p.id !== playerId);
    const gameState = this.createGameState(room);

    return {
      ...gameState,
      myCard: null, // 본인 카드는 보이지 않음
      opponentCard: opponent?.currentCard || null, // 상대 카드는 보임
      myChips: player?.chips || 0,
      opponentChips: opponent?.chips || 0
    };
  }

  // 게임 리셋
  resetGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.status = 'waiting';
    room.pot = 0;
    room.deck = [];
    room.currentBetAmount = 1;
    room.currentBetterId = null;
    room.firstBetterId = null;
    room.roundWinner = null;
    room.lastAction = null;

    room.players.forEach(player => {
      player.chips = 30;
      player.currentCard = null;
      player.totalBet = 0;
      if (!player.isHost) {
        player.isReady = false;
      }
    });

    return room;
  }

  // 플레이어 제거
  removePlayer(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { roomDeleted: false, room: null };

    // 관전자인지 확인
    const spectatorIndex = room.spectators.findIndex(s => s.id === playerId);
    if (spectatorIndex !== -1) {
      room.spectators.splice(spectatorIndex, 1);
      return { roomDeleted: false, room };
    }

    // 플레이어인 경우
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { roomDeleted: false, room };

    const removedPlayer = room.players[playerIndex];
    room.players.splice(playerIndex, 1);

    // 방이 비었으면 삭제
    if (room.players.length === 0 && room.spectators.length === 0) {
      this.rooms.delete(roomCode);
      return { roomDeleted: true, room: null };
    }

    // 방장이 나갔으면 다음 사람에게 방장 이전
    let newHost = null;
    if (removedPlayer.isHost && room.players.length > 0) {
      room.players[0].isHost = true;
      room.players[0].isReady = true;
      newHost = room.players[0];
    }

    // 게임 중이었다면 게임 종료
    if (room.status === 'playing' || room.status === 'betting') {
      room.status = 'waiting';
    }

    return { roomDeleted: false, room, newHost };
  }

  // 닉네임 변경
  changeNickname(roomCode, playerId, newNickname) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false };

    const player = room.players.find(p => p.id === playerId) ||
                   room.spectators.find(s => s.id === playerId);

    if (player) {
      player.nickname = newNickname;
      return { success: true, room };
    }

    return { success: false };
  }
}

module.exports = IndianPokerManager;
