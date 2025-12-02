// GameManagerFactory.js - 게임 타입에 따라 적절한 게임 매니저 반환

const DodukGameManager = require('./DodukGameManager');
const IndianPokerManager = require('./IndianPokerManager');

class GameManagerFactory {
  constructor(io) {
    this.io = io;
    this.dodukManager = new DodukGameManager(io);
    this.indianPokerManager = new IndianPokerManager(io);
  }

  // 게임 타입에 따른 매니저 반환
  getManager(gameType) {
    switch (gameType) {
      case 'doduk':
        return this.dodukManager;
      case 'indian-poker':
        return this.indianPokerManager;
      default:
        return this.dodukManager;
    }
  }

  // 방 코드로 게임 타입 찾기
  getGameTypeByRoomCode(roomCode) {
    const dodukRoom = this.dodukManager.getRoom(roomCode);
    if (dodukRoom) return 'doduk';

    const indianPokerRoom = this.indianPokerManager.getRoom(roomCode);
    if (indianPokerRoom) return 'indian-poker';

    return null;
  }

  // 방 가져오기 (모든 매니저에서 검색)
  getRoom(roomCode) {
    const dodukRoom = this.dodukManager.getRoom(roomCode);
    if (dodukRoom) return { room: dodukRoom, gameType: 'doduk', manager: this.dodukManager };

    const indianPokerRoom = this.indianPokerManager.getRoom(roomCode);
    if (indianPokerRoom) return { room: indianPokerRoom, gameType: 'indian-poker', manager: this.indianPokerManager };

    return null;
  }

  // 방 생성
  createRoom(roomCode, player, gameType) {
    const manager = this.getManager(gameType);
    return manager.createRoom(roomCode, player, gameType);
  }

  // 플레이어 추가
  addPlayerToRoom(roomCode, player) {
    const result = this.getRoom(roomCode);
    if (!result) return null;

    return result.manager.addPlayerToRoom(roomCode, player);
  }

  // 플레이어 제거
  removePlayer(roomCode, playerId) {
    const result = this.getRoom(roomCode);
    if (!result) return { roomDeleted: false, room: null };

    return result.manager.removePlayer(roomCode, playerId);
  }

  // 게임 시작
  startGame(roomCode) {
    const result = this.getRoom(roomCode);
    if (!result) return null;

    return result.manager.startGame(roomCode);
  }

  // 준비 상태 토글
  toggleReady(roomCode, playerId) {
    const result = this.getRoom(roomCode);
    if (!result) return { room: null };

    return result.manager.toggleReady(roomCode, playerId);
  }

  // 게임 타입 변경
  changeGameType(roomCode, newGameType) {
    const currentResult = this.getRoom(roomCode);
    if (!currentResult || currentResult.room.status !== 'waiting') {
      return { success: false, error: '게임 타입을 변경할 수 없습니다.' };
    }

    // 게임 타입이 같으면 무시
    if (currentResult.gameType === newGameType) {
      return { success: true, room: currentResult.room };
    }

    // 현재 매니저에서 방 제거
    const room = currentResult.room;
    currentResult.manager.rooms.delete(roomCode);

    // 새 매니저로 방 이동
    const newManager = this.getManager(newGameType);
    room.gameType = newGameType;
    newManager.rooms.set(roomCode, room);

    return { success: true, room };
  }

  // 닉네임 변경
  changeNickname(roomCode, playerId, newNickname) {
    const result = this.getRoom(roomCode);
    if (!result) return { success: false };

    return result.manager.changeNickname(roomCode, playerId, newNickname);
  }
}

module.exports = GameManagerFactory;
