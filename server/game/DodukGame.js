class DodukGame {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      cards: [],
      isEliminated: false,
      finishOrder: null
    }));
    this.currentTurnIndex = 0;
    this.turnOrder = [];
    this.winners = [];
    this.loser = null;
    this.gameOver = false;
  }

initialize() {
    // 53장의 카드 덱 생성 (조커 포함)
    const deck = this.createDeck();
    
    // 카드 셔플
    this.shuffleDeck(deck);
    
    // 플레이어들에게 카드 분배
    this.distributeCards(deck);
    
    // 초기 짝 제거 - 짝이 더 이상 없을 때까지 반복
    let pairsRemoved = true;
    while (pairsRemoved) {
      pairsRemoved = false;
      this.players.forEach(player => {
        const removed = this.removePairs(player);
        if (removed.length > 0) {
          pairsRemoved = true;
        }
      });
    }
    
    // 턴 순서 설정 (랜덤 시작)
    this.turnOrder = this.players.map(p => p.id);
    this.currentTurnIndex = Math.floor(Math.random() * this.turnOrder.length);
    
    // 초기 짝 제거 후 카드가 없는 플레이어 체크
    this.checkWinners();
  }

  createDeck() {
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];

    // 52장의 일반 카드
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          id: `${suit}-${value}`,
          suit,
          value,
          isJoker: false
        });
      }
    }

    // 조커 1장
    deck.push({
      id: 'joker',
      suit: 'joker',
      value: 'JOKER',
      isJoker: true
    });

    return deck;
  }

  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  shuffleCards(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  distributeCards(deck) {
    let playerIndex = 0;
    while (deck.length > 0) {
      this.players[playerIndex].cards.push(deck.pop());
      playerIndex = (playerIndex + 1) % this.players.length;
    }
  }

  removePairs(player) {
    const valueCounts = new Map();
    const removedCards = [];

    // 각 값의 카드 수 계산
    player.cards.forEach(card => {
      if (!card.isJoker) {
        const count = valueCounts.get(card.value) || [];
        count.push(card);
        valueCounts.set(card.value, count);
      }
    });

    // 2장 이상이면 짝수 개수만큼 제거 (2장→2장, 3장→2장, 4장→4장)
    valueCounts.forEach((cards, value) => {
      if (cards.length >= 2) {
        const pairsToRemove = Math.floor(cards.length / 2) * 2;
        removedCards.push(...cards.slice(0, pairsToRemove));
      }
    });

    // 플레이어의 카드에서 제거
    player.cards = player.cards.filter(card => 
      !removedCards.some(rc => rc.id === card.id)
    );

    return removedCards;
  }

  getCurrentTurnPlayer() {
    const currentPlayerId = this.turnOrder[this.currentTurnIndex];
    return this.players.find(p => p.id === currentPlayerId);
  }

  getNextTarget() {
    // 현재 플레이어의 다음 플레이어 (탈락하지 않은)
    const activePlayers = this.players.filter(p => !p.isEliminated);
    const currentPlayer = this.getCurrentTurnPlayer();
    const currentIndex = activePlayers.findIndex(p => p.id === currentPlayer.id);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    return activePlayers[nextIndex];
  }

  drawCard(drawerId, targetId, cardIndex) {
    const drawer = this.players.find(p => p.id === drawerId);
    const target = this.players.find(p => p.id === targetId);

    if (!drawer || !target) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }

    const currentTurnPlayer = this.getCurrentTurnPlayer();
    if (currentTurnPlayer.id !== drawerId) {
      return { success: false, error: '당신의 턴이 아닙니다.' };
    }

    if (target.isEliminated || target.cards.length === 0) {
      return { success: false, error: '상대방에게 카드가 없습니다.' };
    }

    if (cardIndex < 0 || cardIndex >= target.cards.length) {
      return { success: false, error: '잘못된 카드 인덱스입니다.' };
    }

    // 카드 뽑기
    const drawnCard = target.cards.splice(cardIndex, 1)[0];
    
    // 무작위 위치에 카드 삽입
    const randomInsertIndex = Math.floor(Math.random() * (drawer.cards.length + 1));
    drawer.cards.splice(randomInsertIndex, 0, drawnCard);
    
    // 카드 섞기
    this.shuffleCards(drawer.cards);

    // 짝 제거 - 뽑은 사람(drawer) 체크
    const drawerMatchedCards = this.removePairs(drawer);
    
    // 짝 제거 - 뽑힌 사람(target)도 체크 (카드가 빠져서 새로운 짝이 생길 수 있음)
    const targetMatchedCards = this.removePairs(target);

    // 승자 체크
    this.checkWinners();

    // 게임 종료 체크
    const gameOver = this.checkGameOver();

    // 다음 턴으로
    if (!gameOver) {
      this.advanceTurn();
    }

    return {
      success: true,
      drawnCard,
      matchedCards: {
        drawer: drawerMatchedCards,
        target: targetMatchedCards
      },
      gameOver,
      loser: this.loser,
      winners: this.winners
    };
  }

  checkWinners() {
    this.players.forEach(player => {
      if (!player.isEliminated && player.cards.length === 0) {
        player.isEliminated = true;
        player.finishOrder = this.winners.length + 1;
        this.winners.push({
          id: player.id,
          nickname: player.nickname,
          order: player.finishOrder
        });
        
        // 턴 순서에서 제거
        const turnIndex = this.turnOrder.indexOf(player.id);
        if (turnIndex !== -1) {
          this.turnOrder.splice(turnIndex, 1);
          if (this.currentTurnIndex >= this.turnOrder.length) {
            this.currentTurnIndex = 0;
          }
        }
      }
    });
  }

  checkGameOver() {
    const activePlayers = this.players.filter(p => !p.isEliminated);
    
    if (activePlayers.length === 1) {
      // 마지막 남은 플레이어가 패배자
      const loserPlayer = activePlayers[0];
      this.loser = {
        id: loserPlayer.id,
        nickname: loserPlayer.nickname
      };
      this.gameOver = true;
      return true;
    }
    
    return false;
  }

  advanceTurn() {
    if (this.turnOrder.length === 0) return;
    
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
    
    // 현재 턴 플레이어가 탈락했으면 다음으로
    let attempts = 0;
    while (attempts < this.turnOrder.length) {
      const currentPlayer = this.getCurrentTurnPlayer();
      if (!currentPlayer.isEliminated && currentPlayer.cards.length > 0) {
        break;
      }
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
      attempts++;
    }
  }

  removePlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.isEliminated = true;
      // 해당 플레이어의 카드를 다른 플레이어에게 분배하거나 버림
      const activePlayers = this.players.filter(p => !p.isEliminated && p.id !== playerId);
      if (activePlayers.length > 0 && player.cards.length > 0) {
        let idx = 0;
        player.cards.forEach(card => {
          activePlayers[idx % activePlayers.length].cards.push(card);
          idx++;
        });
        player.cards = [];
        // 새로 받은 카드로 짝 제거
        activePlayers.forEach(p => this.removePairs(p));
      }
    }
    
    // 턴 순서 업데이트
    const turnIndex = this.turnOrder.indexOf(playerId);
    if (turnIndex !== -1) {
      this.turnOrder.splice(turnIndex, 1);
      if (this.currentTurnIndex >= this.turnOrder.length) {
        this.currentTurnIndex = 0;
      }
    }
  }

  getState() {
    return {
      players: this.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        cardCount: p.cards.length,
        isEliminated: p.isEliminated,
        finishOrder: p.finishOrder
      })),
      currentTurnId: this.getCurrentTurnPlayer()?.id,
      nextTargetId: this.getNextTarget()?.id,
      winners: this.winners,
      loser: this.loser,
      gameOver: this.gameOver
    };
  }

  getPlayerView(playerId) {
    const player = this.players.find(p => p.id === playerId);
    const state = this.getState();
    
    return {
      ...state,
      myCards: player ? player.cards : [],
      players: this.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        cardCount: p.cards.length,
        isEliminated: p.isEliminated,
        finishOrder: p.finishOrder,
        // 다른 플레이어의 카드는 숨김
        cards: p.id === playerId ? p.cards : p.cards.map(() => ({ hidden: true }))
      }))
    };
  }
}

module.exports = DodukGame;
