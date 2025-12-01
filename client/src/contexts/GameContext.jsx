import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useSocket } from './SocketContext';

const GameContext = createContext(null);

const initialState = {
  player: null,
  room: null,
  gameState: null,
  isInGame: false,
  chatMessages: [],
  error: null,
  hoverState: null,
  showGameOver: false,
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_PLAYER':
      return { ...state, player: action.payload };

    case 'SET_ROOM':
      return { ...state, room: action.payload };

    case 'UPDATE_ROOM':
      return { ...state, room: action.payload };

    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload, isInGame: true, showGameOver: false };

    case 'UPDATE_GAME_STATE':
      return { ...state, gameState: action.payload };

    case 'SET_GAME_OVER':
      return {
        ...state,
        gameState: {
          ...state.gameState,
          gameOver: true,
          loser: action.payload.loser,
          winners: action.payload.winners
        },
        showGameOver: true
      };

    case 'HIDE_GAME_OVER':
      return { ...state, showGameOver: false };

    // 호버 상태
    case 'SET_HOVER':
      return { ...state, hoverState: action.payload };

    case 'CLEAR_HOVER':
      return { ...state, hoverState: null };

    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.payload].slice(-100)
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'RESET_GAME':
      return {
        ...state,
        gameState: null,
        isInGame: false,
        hoverState: null,
        error: null,
        showGameOver: false
      };

    case 'RETURN_TO_LOBBY':
      // 게임 종료 후 로비로 복귀 (한 번에 모든 상태 업데이트)
      return {
        ...state,
        gameState: null,
        isInGame: false,
        hoverState: null,
        error: null,
        showGameOver: false,
        room: action.payload.room,
        player: action.payload.room.players.find(p => p.id === action.payload.playerId) || state.player
      };

    case 'LEAVE_ROOM':
      return {
        ...initialState,
      };

    default:
      return state;
  }
}

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

export const GameProvider = ({ children }) => {
  const { socket, isConnected } = useSocket();
  const [state, dispatch] = useReducer(gameReducer, initialState);

  useEffect(() => {
    if (!socket) return;

    // Room updates
    socket.on('room-updated', ({ room }) => {
      dispatch({ type: 'UPDATE_ROOM', payload: room });
      // 플레이어 정보 업데이트 (ready 상태 등기화)
      const updatedPlayer = room.players.find(p => p.id === socket.id);
      if (updatedPlayer) {
        dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
      }
    });

    socket.on('player-joined', ({ player, room }) => {
      dispatch({ type: 'UPDATE_ROOM', payload: room });
    });

    socket.on('player-left', ({ playerId, room, newHost }) => {
      dispatch({ type: 'UPDATE_ROOM', payload: room });

      // 모든 플레이어가 room 데이터에서 자신의 최신 정보로 업데이트
      const updatedPlayer = room.players.find(p => p.id === socket.id);
      if (updatedPlayer) {
        dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
      }
    });

    // Game events
    socket.on('game-started', ({ gameState }) => {
      dispatch({ type: 'SET_GAME_STATE', payload: gameState });
    });

    socket.on('card-drawn', ({ gameState, matchedCards }) => {
      dispatch({ type: 'UPDATE_GAME_STATE', payload: { ...gameState, matchedCards } });
      dispatch({ type: 'CLEAR_HOVER' });
    });

    // 카드 셔플 이벤트
    socket.on('cards-shuffled', ({ gameState }) => {
      dispatch({ type: 'UPDATE_GAME_STATE', payload: gameState });
    });

    socket.on('game-over', ({ loser, winners }) => {
      dispatch({
        type: 'SET_GAME_OVER',
        payload: { loser, winners }
      });
    });

    // return-to-lobby 이벤트 핸들러
    socket.on('return-to-lobby', ({ room }) => {
      console.log('Returning to lobby', room);

      // 게임 상태 초기화 및 방 정보 업데이트를 한 번의 dispatch로 처리
      dispatch({
        type: 'RETURN_TO_LOBBY',
        payload: { room, playerId: socket.id }
      });
    });

    // 호버 이벤트 추가
    socket.on('card-hover', ({ hoverPlayerId, targetPlayerId, cardIndex }) => {
      dispatch({
        type: 'SET_HOVER',
        payload: { hoverPlayerId, targetPlayerId, cardIndex }
      });
    });

    socket.on('card-hover-end', () => {
      dispatch({ type: 'CLEAR_HOVER' });
    });

    // Chat
    socket.on('chat-message', (message) => {
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
    });

    // Nickname changed
    socket.on('nickname-changed', ({ playerId, newNickname, room }) => {
      dispatch({ type: 'UPDATE_ROOM', payload: room });
      if (playerId === socket.id) {
        const updatedPlayer = room.players.find(p => p.id === socket.id);
        if (updatedPlayer) {
          dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
        }
      }
    });

    return () => {
      socket.off('room-updated');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('game-started');
      socket.off('card-drawn');
      socket.off('cards-shuffled');
      socket.off('game-over');
      socket.off('return-to-lobby');
      socket.off('chat-message');
      socket.off('card-hover');
      socket.off('card-hover-end');
      socket.off('nickname-changed');
    };
  }, [socket]);

  // Actions
  const createRoom = (nickname, gameType = 'doduk') => {
    return new Promise((resolve, reject) => {
      socket.emit('create-room', { nickname, gameType }, (response) => {
        if (response.success) {
          dispatch({ type: 'SET_PLAYER', payload: response.player });
          dispatch({ type: 'SET_ROOM', payload: response.room });
          resolve(response);
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.error });
          reject(response.error);
        }
      });
    });
  };

  const joinRoom = (roomCode, nickname) => {
    return new Promise((resolve, reject) => {
      socket.emit('join-room', { roomCode, nickname }, (response) => {
        if (response.success) {
          dispatch({ type: 'SET_PLAYER', payload: response.player });
          dispatch({ type: 'SET_ROOM', payload: response.room });
          resolve(response);
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.error });
          reject(response.error);
        }
      });
    });
  };

  const leaveRoom = () => {
    if (socket && state.room) {
      socket.emit('leave-room');
    }
    dispatch({ type: 'LEAVE_ROOM' });
  };

  const toggleReady = () => {
    return new Promise((resolve) => {
      socket.emit('toggle-ready', (response) => {
        if (response.success && response.player) {
          dispatch({ type: 'SET_PLAYER', payload: response.player });
        }
        resolve(response);
      });
    });
  };

  const startGame = () => {
    return new Promise((resolve, reject) => {
      socket.emit('start-game', (response) => {
        if (response.success) {
          resolve(response);
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.error });
          reject(response.error);
        }
      });
    });
  };

  const drawCard = (targetPlayerId, cardIndex) => {
    return new Promise((resolve, reject) => {
      socket.emit('draw-card', { targetPlayerId, cardIndex }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.error });
          reject(response.error);
        }
      });
    });
  };

  const shuffleTargetCards = (targetPlayerId) => {
    return new Promise((resolve, reject) => {
      socket.emit('shuffle-cards', { targetPlayerId }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.error });
          reject(response.error);
        }
      });
    });
  };

  const changeNickname = (newNickname) => {
    return new Promise((resolve, reject) => {
      socket.emit('change-nickname', { newNickname }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.error });
          reject(response.error);
        }
      });
    });
  };

  const playAgain = () => {
    // return-to-lobby 이벤트 핸들러가 게임 상태를 초기화하므로 여기서는 하지 않음
    socket.emit('request-play-again', (response) => {
      if (response.success) {
        // 서버에서 받은 방 정보로 업데이트
        dispatch({ type: 'UPDATE_ROOM', payload: response.room });
        const updatedPlayer = response.room.players.find(p => p.id === socket.id);
        if (updatedPlayer) {
          dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
        }
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || '다시 시작에 실패했습니다.' });
      }
    });
  };

  const sendChatMessage = (message) => {
    socket.emit('chat-message', { message });
  };

  const sendCardHover = (cardIndex, targetPlayerId) => {
    socket.emit('card-hover', { cardIndex, targetPlayerId });
  };

  const sendCardHoverEnd = () => {
    socket.emit('card-hover-end');
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    isConnected,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    startGame,
    drawCard,
    shuffleTargetCards,
    changeNickname,
    playAgain,
    sendChatMessage,
    sendCardHover,
    sendCardHoverEnd,
    clearError,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
