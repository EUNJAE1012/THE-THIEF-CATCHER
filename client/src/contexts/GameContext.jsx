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
      return { ...state, gameState: action.payload, isInGame: true };
    
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
        } 
      };
    
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
        error: null
      };
    
    case 'LEAVE_ROOM':
      return { 
        ...initialState,
        player: state.player ? { ...state.player, isHost: false, isReady: false } : null
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
      // 플레이어 정보도 업데이트 (ready 상태 동기화)
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
      // 본인이 새 방장이 되었는지 확인
      if (newHost && newHost.id === socket.id) {
        dispatch({ type: 'SET_PLAYER', payload: newHost });
      }
    });

    // Game events
    socket.on('game-started', ({ gameState }) => {
      dispatch({ type: 'SET_GAME_STATE', payload: gameState });
    });

    socket.on('card-drawn', ({ gameState }) => {
      dispatch({ type: 'UPDATE_GAME_STATE', payload: gameState });
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

    // return-to-lobby 이벤트 핸들러 수정
    socket.on('return-to-lobby', ({ room }) => {
      console.log('Returning to lobby', room);
      
      // 게임 상태 완전 초기화
      dispatch({ type: 'RESET_GAME' });
      
      // 약간의 딜레이 후 방 정보 업데이트 (상태 충돌 방지)
      setTimeout(() => {
        dispatch({ type: 'UPDATE_ROOM', payload: room });
        
        const updatedPlayer = room.players.find(p => p.id === socket.id);
        if (updatedPlayer) {
          dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
        }
      }, 100);
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
    toggleReady,
    startGame,
    drawCard,
    shuffleTargetCards,
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