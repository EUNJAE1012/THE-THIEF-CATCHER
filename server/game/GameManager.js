// GameManager.js - 도둑잡기 게임 관리자

class GameManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  // 방 생성
  createRoom(roomCode, player, gameType) {
    const room = {
      roomCode,
      gameType,
      status: 'waiting',
      players: [player],
      deck: [],
      currentTurnIndex: 0,
      currentTurnId: null,
      nextTargetId: null,
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
      room.players.push(player);
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

  // 게임 시작
  startGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.status = 'playing';
    
    // 덱 생성 (52장 + 조커 1장)
    const deck = this.createDeck();
    this.shuffleArray(deck);

    // 카드 분배
    const playerCount = room.players.length;
    room.players.forEach((player, index) => {
      player.cards = [];
      player.isEliminated = false;
    });

    // 카드를 플레이어들에게 분배
    let currentPlayer = 0;
    while (deck.length > 0) {
      room.players[currentPlayer].cards.push(deck.pop());
      currentPlayer = (currentPlayer + 1) % playerCount;
    }

    // 각 플레이어의 페어 카드 제거
    room.players.forEach(player => {
      player.cards = this.removePairs(player.cards);
    });

    // 카드가 없는 플레이어 제거 처리
    room.players.forEach(player => {
      if (player.cards.length === 0) {
        player.isEliminated = true;
      }
    });

    // 첫 번째 턴 설정
    room.currentTurnIndex = 0;
    room.currentTurnId = room.players[0].id;
    room.nextTargetId = this.getNextTarget(room, room.players[0].id);

    return this.createGameState(room);
  }

  // 덱 생성
  createDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];

    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value, isJoker: false });
      }
    }

    // 조커 추가
    deck.push({ suit: 'joker', value: 'JOKER', isJoker: true });

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

  // 페어 카드 제거
  removePairs(cards) {
    const valueGroups = {};
  
    // 값별로 그룹화
    cards.forEach((card, index) => {
      if (!card.isJoker) {
        if (!valueGroups[card.value]) {
          valueGroups[card.value] = [];
        }
        valueGroups[card.value].push(index);
      }
    });

    // 제거할 인덱스 수집 (2장씩 페어로 제거)
    const indicesToRemove = new Set();
    
    Object.values(valueGroups).forEach(indices => {
      // 2장씩 페어로 제거 (3장이면 2장 제거, 4장이면 4장 제거)
      const pairsToRemove = Math.floor(indices.length / 2) * 2;
      for (let i = 0; i < pairsToRemove; i++) {
        indicesToRemove.add(indices[i]);
      }
    });

    return cards.filter((_, index) => !indicesToRemove.has(index));
  }

  // 다음 타겟 플레이어 찾기
  getNextTarget(room, currentPlayerId) {
    const activePlayers = room.players.filter(p => !p.isEliminated && p.cards.length > 0);
    const currentIndex = activePlayers.findIndex(p => p.id === currentPlayerId);
    
    if (activePlayers.length <= 1) return null;
    
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    return activePlayers[nextIndex].id;
  }

  // 게임 상태 생성
  createGameState(room) {
    return {
      players: room.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        cardCount: p.cards.length,
        isEliminated: p.isEliminated
      })),
      currentTurnId: room.currentTurnId,
      nextTargetId: room.nextTargetId,
      status: room.status
    };
  }

  // 플레이어 뷰 생성 (본인 카드만 표시)
  getPlayerView(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    const gameState = this.createGameState(room);

    return {
      ...gameState,
      myCards: player ? player.cards : []
    };
  }

  // 카드 뽑기
  drawCard(roomCode, playerId, targetPlayerId, cardIndex) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: '방을 찾을 수 없습니다.' };

    // 현재 턴 확인
    if (room.currentTurnId !== playerId) {
      return { success: false, error: '당신의 차례가 아닙니다.' };
    }

    // 타겟 확인
    if (room.nextTargetId !== targetPlayerId) {
      return { success: false, error: '올바른 대상이 아닙니다.' };
    }

    const drawer = room.players.find(p => p.id === playerId);
    const target = room.players.find(p => p.id === targetPlayerId);

    if (!drawer || !target) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }

    if (cardIndex < 0 || cardIndex >= target.cards.length) {
      return { success: false, error: '유효하지 않은 카드 인덱스입니다.' };
    }

    // 카드 뽑기
    const drawnCard = target.cards.splice(cardIndex, 1)[0];
    drawer.cards.push(drawnCard);

    // 매칭 카드 확인 및 제거
    const matchedCards = [];
    if (!drawnCard.isJoker) {
      const matchingCards = drawer.cards.filter(c => !c.isJoker && c.value === drawnCard.value);
      if (matchingCards.length >= 2) {
        const pairsToRemove = Math.floor(matchingCards.length / 2) * 2;
        const cardsToRemove = matchingCards.slice(0, pairsToRemove);
        matchedCards.push(...cardsToRemove);
        
        let removeCount = pairsToRemove;
        drawer.cards = drawer.cards.filter(c => {
          if (c.isJoker) return true;
          if (c.value === drawnCard.value && removeCount > 0) {
            removeCount--;
            return false;
          }
          return true;
        });
      }
    }

    // 타겟 카드가 없으면 제거
    if (target.cards.length === 0) {
      target.isEliminated = true;
    }

    // 뽑은 사람 카드가 없으면 제거
    if (drawer.cards.length === 0) {
      drawer.isEliminated = true;
    }

    // 게임 종료 체크
    const activePlayers = room.players.filter(p => !p.isEliminated && p.cards.length > 0);
    
    if (activePlayers.length === 1) {
      // 마지막 남은 플레이어가 패배자 (조커 보유자)
      const loser = activePlayers[0];
      const winners = room.players
        .filter(p => p.id !== loser.id)
        .sort((a, b) => {
          // 먼저 탈락한 순서대로 (역순)
          const aIndex = room.players.findIndex(p => p.id === a.id);
          const bIndex = room.players.findIndex(p => p.id === b.id);
          return aIndex - bIndex;
        });

      room.status = 'finished';

      return {
        success: true,
        drawnCard,
        matchedCards,
        gameOver: true,
        loser: { id: loser.id, nickname: loser.nickname },
        winners: winners.map(w => ({ id: w.id, nickname: w.nickname }))
      };
    }

    // 다음 턴으로
    this.advanceTurn(room);

    return {
      success: true,
      drawnCard,
      matchedCards,
      gameOver: false
    };
  }

  // 타겟 카드 섞기
  shuffleTargetCards(roomCode, playerId, targetPlayerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: '방을 찾을 수 없습니다.' };

    // 현재 턴 확인
    if (room.currentTurnId !== playerId) {
      return { success: false, error: '당신의 차례가 아닙니다.' };
    }

    // 타겟 확인
    if (room.nextTargetId !== targetPlayerId) {
      return { success: false, error: '올바른 대상이 아닙니다.' };
    }

    const target = room.players.find(p => p.id === targetPlayerId);
    if (!target) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }

    // 카드 섞기
    this.shuffleArray(target.cards);

    return { success: true };
  }

  // 턴 진행
  advanceTurn(room) {
    const activePlayers = room.players.filter(p => !p.isEliminated && p.cards.length > 0);
    
    if (activePlayers.length <= 1) {
      return;
    }

    // 다음 턴 플레이어 찾기
    const currentIndex = activePlayers.findIndex(p => p.id === room.currentTurnId);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    
    room.currentTurnId = activePlayers[nextIndex].id;
    room.nextTargetId = this.getNextTarget(room, room.currentTurnId);
  }

  // 게임 리셋
  resetGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.status = 'waiting';
    room.players.forEach(player => {
      player.cards = [];
      player.isEliminated = false;
      if (!player.isHost) {
        player.isReady = false;
      }
    });
    room.currentTurnId = null;
    room.nextTargetId = null;

    return room;
  }

  // 플레이어 제거
  removePlayer(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { roomDeleted: false, room: null };

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { roomDeleted: false, room };

    const removedPlayer = room.players[playerIndex];
    room.players.splice(playerIndex, 1);

    // 방이 비었으면 삭제
    if (room.players.length === 0) {
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

    // 게임 중이었다면 턴 처리
    if (room.status === 'playing') {
      if (room.currentTurnId === playerId) {
        this.advanceTurn(room);
      }
      if (room.nextTargetId === playerId) {
        room.nextTargetId = this.getNextTarget(room, room.currentTurnId);
      }
    }

    return { roomDeleted: false, room, newHost };
  }
}

module.exports = GameManager;